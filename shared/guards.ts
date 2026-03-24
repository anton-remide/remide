/**
 * System Guards — process locks, retry logic, and limit enforcement.
 *
 * Prevents parallel worker runs, enforces batch caps,
 * and adds exponential-backoff retry for Supabase operations.
 *
 * Usage:
 *   import { acquireLock, releaseLock, withRetry, enforceBatchLimit } from '../shared/guards.js';
 *
 *   const lock = acquireLock('enrichment');
 *   try { ... } finally { releaseLock(lock); }
 */

import { existsSync, writeFileSync, unlinkSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { logger } from './logger.js';

const SCOPE = 'guards';
const LOCK_DIR = join(process.cwd(), '.locks');

/* ── System Limits (CLAUDE.md documented) ── */

export const SYSTEM_LIMITS = {
  /** Max entities per enrichment batch */
  ENRICHMENT_MAX_BATCH: 50_000,
  /** Max entities per quality worker batch */
  QUALITY_MAX_BATCH: 50_000,
  /** Max entities per verify worker batch */
  VERIFY_MAX_BATCH: 20_000,
  /** Supabase write batch size (rows per upsert) */
  SUPABASE_WRITE_BATCH: 50,
  /** Max retry attempts for Supabase operations */
  MAX_RETRIES: 3,
  /** Base delay for exponential backoff (ms) */
  RETRY_BASE_DELAY_MS: 1_000,
  /** Max worker runtime before forced exit (ms) — 6 hours */
  MAX_WORKER_RUNTIME_MS: 6 * 60 * 60 * 1_000,
  /** Lock stale threshold — locks older than this are considered dead (ms) — 7 hours */
  LOCK_STALE_MS: 7 * 60 * 60 * 1_000,
} as const;

/* ── Batch Limit Enforcement ── */

/**
 * Enforce a maximum batch size. Clamps the requested limit to the system max.
 * Logs a warning if the requested limit exceeds the cap.
 */
export function enforceBatchLimit(
  requested: number,
  maxAllowed: number,
  workerName: string,
): number {
  if (requested > maxAllowed) {
    logger.warn(SCOPE, `${workerName}: requested limit ${requested} exceeds max ${maxAllowed}, clamping to ${maxAllowed}`);
    return maxAllowed;
  }
  return requested;
}

/* ── Process Lock (file-based) ── */

interface LockInfo {
  pid: number;
  worker: string;
  startedAt: string;
}

function lockPath(workerName: string): string {
  return join(LOCK_DIR, `${workerName}.lock`);
}

/**
 * Acquire a process lock for a worker. Prevents parallel runs of the same worker.
 * Returns the lock file path if acquired, throws if another instance is running.
 */
export function acquireLock(workerName: string): string {
  // Ensure lock directory exists
  if (!existsSync(LOCK_DIR)) {
    mkdirSync(LOCK_DIR, { recursive: true });
  }

  const path = lockPath(workerName);

  // Check for existing lock
  if (existsSync(path)) {
    try {
      const existing: LockInfo = JSON.parse(readFileSync(path, 'utf-8'));
      const lockAge = Date.now() - new Date(existing.startedAt).getTime();

      // Check if lock is stale (process died without cleanup)
      if (lockAge > SYSTEM_LIMITS.LOCK_STALE_MS) {
        logger.warn(SCOPE, `Stale lock found for ${workerName} (PID ${existing.pid}, age ${Math.round(lockAge / 60_000)}min). Removing.`);
        unlinkSync(path);
      } else {
        throw new Error(
          `Worker "${workerName}" is already running (PID ${existing.pid}, started ${existing.startedAt}). ` +
          `If this is stale, delete ${path} manually.`
        );
      }
    } catch (err) {
      if (err instanceof SyntaxError) {
        // Corrupt lock file — remove it
        logger.warn(SCOPE, `Corrupt lock file for ${workerName}, removing.`);
        unlinkSync(path);
      } else {
        throw err;
      }
    }
  }

  // Write lock
  const info: LockInfo = {
    pid: process.pid,
    worker: workerName,
    startedAt: new Date().toISOString(),
  };
  writeFileSync(path, JSON.stringify(info, null, 2));
  logger.info(SCOPE, `Lock acquired for ${workerName} (PID ${process.pid})`);

  return path;
}

/**
 * Release a process lock. Should be called in a finally block.
 */
export function releaseLock(lockFilePath: string): void {
  try {
    if (existsSync(lockFilePath)) {
      unlinkSync(lockFilePath);
      logger.debug(SCOPE, `Lock released: ${lockFilePath}`);
    }
  } catch (err) {
    logger.warn(SCOPE, `Failed to release lock ${lockFilePath}: ${err}`);
  }
}

/* ── Supabase Retry with Exponential Backoff ── */

/**
 * Execute an async operation with retry and exponential backoff.
 * Useful for Supabase API calls that may fail transiently.
 *
 * @param fn - The async function to retry
 * @param label - Human-readable label for logging
 * @param maxRetries - Max attempts (default: SYSTEM_LIMITS.MAX_RETRIES)
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxRetries = SYSTEM_LIMITS.MAX_RETRIES,
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const isLastAttempt = attempt === maxRetries;

      if (isLastAttempt) {
        logger.error(SCOPE, `${label}: all ${maxRetries} attempts failed. Last error: ${lastError.message}`);
        throw lastError;
      }

      const delay = SYSTEM_LIMITS.RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
      logger.warn(SCOPE, `${label}: attempt ${attempt}/${maxRetries} failed (${lastError.message}). Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // TypeScript safety — should never reach here
  throw lastError ?? new Error('withRetry: unexpected state');
}

/* ── Runtime Timeout ── */

/**
 * Set a maximum runtime for a worker. Logs and exits if exceeded.
 * Returns a cleanup function to call when the worker finishes normally.
 */
export function setRuntimeTimeout(
  workerName: string,
  maxMs = SYSTEM_LIMITS.MAX_WORKER_RUNTIME_MS,
): () => void {
  const timer = setTimeout(() => {
    logger.error(SCOPE, `${workerName}: max runtime of ${Math.round(maxMs / 60_000)}min exceeded. Force exiting.`);
    process.exit(1);
  }, maxMs);

  // Don't block Node.js from exiting
  timer.unref();

  return () => clearTimeout(timer);
}
