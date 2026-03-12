/**
 * Verify Worker — DNS Resolution + HTTP Liveness Check
 *
 * Checks entity websites to determine dns_status:
 * - alive:      DNS resolves AND HTTP 2xx/3xx
 * - dead:       DNS fails OR HTTP timeout/error
 * - no_website: No website URL in entity data
 * - unknown:    Not yet checked
 *
 * Re-checks entities where dns_checked_at is null or older than 30 days.
 *
 * Usage:
 *   npx tsx workers/verify/run.ts                      # Default: 500 entities
 *   npx tsx workers/verify/run.ts --limit 1000         # Custom batch
 *   npx tsx workers/verify/run.ts --country DE         # Single country
 *   npx tsx workers/verify/run.ts --force              # Re-check all (ignore dns_checked_at)
 *   DRY_RUN=true npx tsx workers/verify/run.ts         # Validate without writing
 *
 * Env vars:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Related: DATA-004, S4.9, S4.12
 */

import { promises as dns } from 'node:dns';
import { config } from '../../shared/config.js';
import { getSupabase } from '../../shared/supabase.js';
import { logger, sendTelegramAlert } from '../../shared/logger.js';
import { SYSTEM_LIMITS, enforceBatchLimit, acquireLock, releaseLock, setRuntimeTimeout, withRetry } from '../../shared/guards.js';

const SCOPE = 'verify';
const DEFAULT_LIMIT = 500;
const RECHECK_DAYS = 30;
const DNS_TIMEOUT_MS = 5_000;
const HTTP_TIMEOUT_MS = 10_000;
const CONCURRENCY = 10;  // Parallel DNS checks

/* ── Types ── */

interface EntityToVerify {
  id: string;
  name: string;
  country_code: string;
  website: string | null;
  dns_status: string | null;
}

interface VerifyResult {
  id: string;
  dns_status: 'alive' | 'dead' | 'no_website';
  http_status?: number;
  error?: string;
}

interface RunStats {
  total: number;
  alive: number;
  dead: number;
  noWebsite: number;
  errors: number;
  durationMs: number;
}

/* ── CLI args ── */

function parseArgs(): { country: string | null; limit: number; force: boolean } {
  const args = process.argv.slice(2);
  let country: string | null = null;
  let limit = DEFAULT_LIMIT;
  const force = args.includes('--force');

  const countryIdx = args.indexOf('--country');
  if (countryIdx !== -1 && args[countryIdx + 1]) {
    country = args[countryIdx + 1].toUpperCase();
  }

  const limitIdx = args.indexOf('--limit');
  if (limitIdx !== -1 && args[limitIdx + 1]) {
    limit = parseInt(args[limitIdx + 1], 10);
    if (isNaN(limit) || limit <= 0) limit = DEFAULT_LIMIT;
  }

  return { country, limit, force };
}

/* ── URL helpers ── */

const INVALID_WEBSITES = new Set([
  '', 'N/A', 'n/a', 'Not available', 'not available', '-', 'none', 'None', '.', 'TBD',
]);

function normalizeUrl(url: string): string | null {
  let u = url.trim();
  if (INVALID_WEBSITES.has(u)) return null;
  if (u.length < 4) return null;

  // Handle pipe-separated alternatives
  if (u.includes('|')) u = u.split(/\s*\|\s*/)[0].trim();

  // Fix double-protocol
  u = u.replace(/^https?:\/\/https?\.\/?\/*/i, 'https://');

  // Ensure protocol
  if (!u.startsWith('http://') && !u.startsWith('https://')) {
    u = 'https://' + u;
  }

  try {
    new URL(u); // Validate
    return u.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

/* ── DNS + HTTP checks ── */

async function checkDns(hostname: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DNS_TIMEOUT_MS);

    await dns.resolve4(hostname);
    clearTimeout(timeout);
    return true;
  } catch {
    return false;
  }
}

async function checkHttp(url: string): Promise<{ alive: boolean; status?: number; error?: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);

    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RemiDe-Verify/1.0)',
      },
    });

    clearTimeout(timeout);

    // 2xx, 3xx = alive. 4xx/5xx = consider alive (server responding)
    // Only truly "dead" if DNS fails or connection refused
    return { alive: true, status: response.status };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    // Connection refused, timeout, etc = dead
    if (msg.includes('abort') || msg.includes('timeout')) {
      return { alive: false, error: 'timeout' };
    }
    if (msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND')) {
      return { alive: false, error: msg.split(':')[0] };
    }

    // Try GET as fallback (some servers reject HEAD)
    try {
      const controller2 = new AbortController();
      const timeout2 = setTimeout(() => controller2.abort(), HTTP_TIMEOUT_MS);

      const response2 = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller2.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; RemiDe-Verify/1.0)',
        },
      });

      clearTimeout(timeout2);
      return { alive: true, status: response2.status };
    } catch (err2) {
      const msg2 = err2 instanceof Error ? err2.message : String(err2);
      return { alive: false, error: msg2.substring(0, 100) };
    }
  }
}

async function verifyEntity(entity: EntityToVerify): Promise<VerifyResult> {
  // No website → no_website
  if (!entity.website || INVALID_WEBSITES.has(entity.website.trim())) {
    return { id: entity.id, dns_status: 'no_website' };
  }

  const url = normalizeUrl(entity.website);
  if (!url) {
    return { id: entity.id, dns_status: 'no_website' };
  }

  try {
    const hostname = new URL(url).hostname;

    // Step 1: DNS check
    const dnsOk = await checkDns(hostname);
    if (!dnsOk) {
      return { id: entity.id, dns_status: 'dead', error: `DNS failed: ${hostname}` };
    }

    // Step 2: HTTP check
    const httpResult = await checkHttp(url);
    if (httpResult.alive) {
      return { id: entity.id, dns_status: 'alive', http_status: httpResult.status };
    } else {
      return { id: entity.id, dns_status: 'dead', error: httpResult.error };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { id: entity.id, dns_status: 'dead', error: msg.substring(0, 100) };
  }
}

/* ── Supabase operations ── */

async function fetchEntities(
  country: string | null,
  limit: number,
  force: boolean,
): Promise<EntityToVerify[]> {
  const sb = getSupabase();

  const PAGE_SIZE = 1000;
  const allEntities: EntityToVerify[] = [];
  let offset = 0;

  while (allEntities.length < limit) {
    const pageLimit = Math.min(PAGE_SIZE, limit - allEntities.length);

    let query = sb.from('entities')
      .select('id,name,country_code,website,dns_status');

    if (!force) {
      // Only check entities that haven't been checked or need re-check
      const cutoff = new Date(Date.now() - RECHECK_DAYS * 24 * 60 * 60 * 1000).toISOString();
      query = query.or(`dns_checked_at.is.null,dns_checked_at.lt.${cutoff}`);
    }

    if (country) {
      query = query.eq('country_code', country);
    }

    // Skip garbage entities
    query = query.neq('is_garbage', true);

    query = query.order('country_code').range(offset, offset + pageLimit - 1);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch entities (offset ${offset}): ${error.message}`);

    const rows = data ?? [];
    if (rows.length === 0) break;

    for (const row of rows) {
      allEntities.push({
        id: row.id as string,
        name: row.name as string,
        country_code: row.country_code as string,
        website: (row.website as string | null) ?? null,
        dns_status: (row.dns_status as string | null) ?? null,
      });
    }

    offset += rows.length;
    if (rows.length < pageLimit) break;
  }

  return allEntities;
}

async function writeResults(
  results: VerifyResult[],
  dryRun: boolean,
): Promise<{ written: number; errors: string[] }> {
  const sb = getSupabase();
  const now = new Date().toISOString();
  let written = 0;
  const errors: string[] = [];

  for (let i = 0; i < results.length; i++) {
    const r = results[i];

    const updates: Record<string, unknown> = {
      dns_status: r.dns_status,
      dns_checked_at: now,
      last_verified_at: now,
    };

    if (dryRun) {
      logger.debug(SCOPE, `[DRY-RUN] ${r.id}: ${r.dns_status}${r.error ? ` (${r.error})` : ''}`);
      written++;
      continue;
    }

    const { error } = await sb.from('entities').update(updates).eq('id', r.id);

    if (error) {
      errors.push(`${r.id}: ${error.message}`);
    } else {
      written++;
    }

    // Progress
    if (i > 0 && i % 500 === 0) {
      logger.info(SCOPE, `  ...wrote ${i}/${results.length}`);
    }
  }

  return { written, errors };
}

async function logVerifyRun(stats: RunStats, errors: string[]): Promise<void> {
  const sb = getSupabase();

  const status = stats.errors > stats.total * 0.1 ? 'error' : stats.errors > 0 ? 'partial' : 'success';

  const { error } = await sb.from('scrape_runs').insert({
    registry_id: 'verify-worker',
    status,
    entities_found: stats.total,
    entities_new: stats.alive,
    entities_updated: stats.dead,
    entities_removed: stats.noWebsite,
    duration_ms: stats.durationMs,
    error_message: errors.length > 0 ? errors.slice(0, 5).join('; ') : null,
    warnings: [`alive:${stats.alive}, dead:${stats.dead}, no_website:${stats.noWebsite}`],
    delta_percent: 0,
    created_at: new Date().toISOString(),
  });

  if (error) {
    logger.debug(SCOPE, `Scrape run log skipped: ${error.message}`);
  }
}

/* ── Parallel execution helper ── */

async function runBatch<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number,
  onProgress?: (completed: number, total: number) => void,
): Promise<R[]> {
  const results: R[] = [];
  let completed = 0;

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
    completed += batchResults.length;
    if (onProgress) onProgress(completed, items.length);
  }

  return results;
}

/* ── Main ── */

async function main() {
  const startTime = Date.now();
  const { country, limit: rawLimit, force } = parseArgs();
  const dryRun = config.flags.dryRun;

  // Enforce system limits + acquire process lock + set runtime timeout
  const limit = enforceBatchLimit(rawLimit, SYSTEM_LIMITS.VERIFY_MAX_BATCH, SCOPE);
  const lockFile = acquireLock(SCOPE);
  const clearRuntimeTimeout = setRuntimeTimeout(SCOPE);

  logger.info(SCOPE, '═══════════════════════════════════════════');
  logger.info(SCOPE, '  Verify Worker — DNS + HTTP Liveness');
  logger.info(SCOPE, '═══════════════════════════════════════════');
  logger.info(SCOPE, `Config: country=${country ?? 'all'}, limit=${limit}, force=${force}, dryRun=${dryRun}`);
  logger.info(SCOPE, `Re-check interval: ${RECHECK_DAYS} days, concurrency: ${CONCURRENCY}`);

  // 1. Fetch entities
  logger.info(SCOPE, 'Fetching entities to verify...');
  const entities = await fetchEntities(country, limit, force);
  logger.info(SCOPE, `Found ${entities.length} entities to verify`);

  if (entities.length === 0) {
    logger.info(SCOPE, 'No entities need verification. Done.');
    return;
  }

  // Country breakdown
  const countryBreakdown = new Map<string, number>();
  entities.forEach(e => {
    countryBreakdown.set(e.country_code, (countryBreakdown.get(e.country_code) ?? 0) + 1);
  });
  const breakdown = [...countryBreakdown.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([code, count]) => `${code}:${count}`)
    .join(', ');
  logger.info(SCOPE, `Countries (top 10): ${breakdown}`);

  // 2. Verify entities (DNS + HTTP) with concurrency
  logger.info(SCOPE, 'Running DNS + HTTP checks...');
  const stats: RunStats = {
    total: entities.length,
    alive: 0,
    dead: 0,
    noWebsite: 0,
    errors: 0,
    durationMs: 0,
  };

  const results = await runBatch(
    entities,
    verifyEntity,
    CONCURRENCY,
    (completed, total) => {
      if (completed % 100 === 0 || completed === total) {
        logger.info(SCOPE, `  Verified ${completed}/${total}`);
      }
    },
  );

  // Count results
  for (const r of results) {
    switch (r.dns_status) {
      case 'alive': stats.alive++; break;
      case 'dead': stats.dead++; break;
      case 'no_website': stats.noWebsite++; break;
    }
  }

  // 3. Write results
  logger.info(SCOPE, 'Writing results to Supabase...');
  const { written, errors } = await writeResults(results, dryRun);

  // 4. Log run
  stats.errors = errors.length;
  stats.durationMs = Date.now() - startTime;
  await logVerifyRun(stats, errors);

  // 5. Summary
  logger.info(SCOPE, '');
  logger.info(SCOPE, '═══════════════════════════════════════════');
  logger.info(SCOPE, '  Verify Worker Complete');
  logger.info(SCOPE, '═══════════════════════════════════════════');
  logger.info(SCOPE, `  Total:       ${stats.total}`);
  logger.info(SCOPE, `  ✅ Alive:     ${stats.alive} (${((stats.alive / stats.total) * 100).toFixed(1)}%)`);
  logger.info(SCOPE, `  💀 Dead:      ${stats.dead} (${((stats.dead / stats.total) * 100).toFixed(1)}%)`);
  logger.info(SCOPE, `  🚫 No website: ${stats.noWebsite} (${((stats.noWebsite / stats.total) * 100).toFixed(1)}%)`);
  logger.info(SCOPE, `  DB writes:   ${written}`);
  logger.info(SCOPE, `  Errors:      ${stats.errors}`);
  logger.info(SCOPE, `  Duration:    ${(stats.durationMs / 1000).toFixed(1)}s`);
  logger.info(SCOPE, '═══════════════════════════════════════════');

  // 6. Alert if many dead
  if (stats.dead > stats.total * 0.3 && stats.total > 50) {
    await sendTelegramAlert(
      SCOPE,
      `High dead rate: ${stats.dead}/${stats.total} (${((stats.dead / stats.total) * 100).toFixed(0)}%)`,
      true,
    );
  }

  // 7. Cleanup
  clearRuntimeTimeout();
  releaseLock(lockFile);
}

main().catch(async (err) => {
  logger.error(SCOPE, `Fatal: ${err.message}`);
  await sendTelegramAlert(SCOPE, `Fatal error: ${err.message}`);
  process.exit(1);
});
