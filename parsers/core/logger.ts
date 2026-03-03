/**
 * Logger with optional Telegram alert integration.
 *
 * Uses TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID env vars.
 * Falls back to console-only if not configured.
 */

import type { LogLevel } from './types.js';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

function timestamp(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function formatMessage(level: LogLevel, registry: string, message: string): string {
  return `[${timestamp()}] [${level.toUpperCase()}] [${registry}] ${message}`;
}

export function log(level: LogLevel, registry: string, message: string): void {
  const formatted = formatMessage(level, registry, message);
  switch (level) {
    case 'error':
      console.error(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    case 'debug':
      if (process.env.DEBUG) console.debug(formatted);
      break;
    default:
      console.log(formatted);
  }
}

export async function sendTelegramAlert(
  registry: string,
  message: string,
  isAnomaly = false
): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    log('debug', registry, 'Telegram not configured, skipping alert');
    return;
  }

  const emoji = isAnomaly ? '\u26a0\ufe0f' : '\u274c';
  const text = `${emoji} *VASP Parser Alert*\n\n*Registry:* ${registry}\n*Message:* ${message}\n*Time:* ${timestamp()}`;

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
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

export const logger = {
  info: (registry: string, msg: string) => log('info', registry, msg),
  warn: (registry: string, msg: string) => log('warn', registry, msg),
  error: (registry: string, msg: string) => log('error', registry, msg),
  debug: (registry: string, msg: string) => log('debug', registry, msg),
};
