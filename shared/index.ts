/**
 * Shared module barrel export.
 *
 * Usage:
 *   import { config, getSupabase, logger } from '../../shared/index.js';
 */

export { config, loadConfig, type AppConfig } from './config.js';
export { getSupabase, getSupabaseAnon, resetSupabaseClient } from './supabase.js';
export { logger, log, sendTelegramAlert } from './logger.js';
export * from './types.js';
