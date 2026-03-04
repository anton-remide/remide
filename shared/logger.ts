/**
 * Structured logger with optional Telegram alert integration.
 *
 * Uses shared config for Telegram credentials instead of raw process.env.
 * Same API as parsers/core/logger.ts for easy migration.
 *
 * Usage:
 *   import { logger } from '../shared/logger.js';
 *   logger.info('enrichment', 'Starting enrichment worker...');
 */

import { config } from './config.js';
import type { LogLevel } from './types.js';

/* ── Formatting ── */

function timestamp(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function formatMessage(level: LogLevel, scope: string, message: string): string {
  return `[${timestamp()}] [${level.toUpperCase()}] [${scope}] ${message}`;
}

/* ── Console logging ── */

export function log(level: LogLevel, scope: string, message: string): void {
  const formatted = formatMessage(level, scope, message);
  switch (level) {
    case 'error':
      console.error(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    case 'debug':
      if (config.flags.debug) console.debug(formatted);
      break;
    default:
      console.log(formatted);
  }
}

/* ── Telegram alerts ── */

export async function sendTelegramAlert(
  scope: string,
  message: string,
  isAnomaly = false
): Promise<void> {
  const { botToken, chatId, enabled } = config.telegram;

  if (!enabled || !botToken || !chatId) {
    log('debug', scope, 'Telegram not configured, skipping alert');
    return;
  }

  // Skip in dry-run mode
  if (config.flags.dryRun) {
    log('info', scope, `[DRY-RUN] Would send Telegram alert: ${message}`);
    return;
  }

  const emoji = isAnomaly ? '\u26a0\ufe0f' : '\u274c';
  const text = `${emoji} *RemiDe Alert*\n\n*Scope:* ${scope}\n*Message:* ${message}\n*Time:* ${timestamp()}`;

  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
      }),
    });

    if (!response.ok) {
      console.error(`Telegram API error: ${response.status} ${response.statusText}`);
    }
  } catch (err) {
    console.error('Failed to send Telegram alert:', err);
  }
}

/* ── Public API ── */

export const logger = {
  info: (scope: string, msg: string) => log('info', scope, msg),
  warn: (scope: string, msg: string) => log('warn', scope, msg),
  error: (scope: string, msg: string) => log('error', scope, msg),
  debug: (scope: string, msg: string) => log('debug', scope, msg),
};
