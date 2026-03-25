/**
 * Centralized configuration — single source of truth for env vars and feature flags.
 *
 * Every worker, parser, and background script imports config from here
 * instead of parsing process.env directly.
 *
 * Usage:
 *   import { config } from '../shared/config.js';
 *   const sb = createClient(config.supabase.url, config.supabase.serviceKey);
 */

import dotenv from 'dotenv';

// Load .env.local first (project convention), then .env as fallback
dotenv.config({ path: '.env.local' });
dotenv.config(); // .env (won't overwrite existing vars)

/* ── Types ── */

export interface AppConfig {
  supabase: {
    url: string;
    serviceKey: string;
    anonKey: string;
  };
  notion: {
    token: string | null;
    entitiesDbId: string;
    jurisdictionsDbId: string;
    knowledgeBaseId: string;
    decisionLogId: string;
    parserRegistryId: string;
    scrapeRunsId: string;
    enabled: boolean;
  };
  telegram: {
    botToken: string | null;
    chatId: string | null;
    enabled: boolean;
  };
  anthropic: {
    apiKey: string | null;
    enabled: boolean;
  };
  parallel: {
    apiKey: string | null;
    enabled: boolean;
  };
  firecrawl: {
    apiKey: string | null;
    enabled: boolean;
  };
  flags: {
    dryRun: boolean;
    notionDualWrite: boolean;
    telegramAlerts: boolean;
    debug: boolean;
  };
}

/* ── Helpers ── */

/** Require at least one env var from the list. Throws if none found. */
function requireEnv(name: string, ...fallbacks: string[]): string {
  const keys = [name, ...fallbacks];
  for (const key of keys) {
    const val = process.env[key];
    if (val) return val;
  }
  throw new Error(
    `Missing required env var: ${keys.join(' | ')}. ` +
      `Set at least one in .env.local or environment.`
  );
}

/** Get optional env var with fallbacks. Returns null if none found. */
function optionalEnv(name: string, ...fallbacks: string[]): string | null {
  const keys = [name, ...fallbacks];
  for (const key of keys) {
    const val = process.env[key];
    if (val) return val;
  }
  return null;
}

/** Parse boolean-like env var */
function envBool(name: string, defaultValue = false): boolean {
  const val = process.env[name];
  if (!val) return defaultValue;
  return val === 'true' || val === '1';
}

/* ── Config loader ── */

export function loadConfig(overrides?: Partial<AppConfig>): AppConfig {
  const telegramBotToken = optionalEnv('TELEGRAM_BOT_TOKEN');
  const telegramChatId = optionalEnv('TELEGRAM_CHAT_ID');
  const notionToken = optionalEnv('NOTION_TOKEN', 'NOTION_API_KEY');
  const anthropicKey = optionalEnv('ANTHROPIC_API_KEY');
  const parallelKey = optionalEnv('PARALLEL_API_KEY');
  const firecrawlKey = optionalEnv('FIRECRAWL_API_KEY');

  const base: AppConfig = {
    supabase: {
      url: requireEnv('SUPABASE_URL', 'VITE_SUPABASE_URL'),
      serviceKey: requireEnv(
        'SUPABASE_SERVICE_ROLE_KEY',
        'SUPABASE_SERVICE_KEY',
        'SUPABASE_ANON_KEY',
        'VITE_SUPABASE_ANON_KEY'
      ),
      anonKey: optionalEnv('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY') ?? '',
    },
    notion: {
      token: notionToken,
      entitiesDbId: '32d2ac10-63c8-81db-98b7-e92a8f8c855a',
      jurisdictionsDbId: '9618ad8b-302f-421f-9d30-de322226c4d1',
      knowledgeBaseId: 'c973a8be-f1be-462c-bf14-55c47f0c5708',
      decisionLogId: '00b7f0c3-d0aa-4b94-aa05-aefcc93815bf',
      parserRegistryId: '9618ad8b-302f-421f-9d30-de322226c4d1',
      scrapeRunsId: '5501fd5a-9964-4394-b13c-0a83519fd213',
      enabled: !!notionToken,
    },
    telegram: {
      botToken: telegramBotToken,
      chatId: telegramChatId,
      enabled: !!(telegramBotToken && telegramChatId),
    },
    anthropic: {
      apiKey: anthropicKey,
      enabled: !!anthropicKey,
    },
    parallel: {
      apiKey: parallelKey,
      enabled: !!parallelKey,
    },
    firecrawl: {
      apiKey: firecrawlKey,
      enabled: !!firecrawlKey,
    },
    flags: {
      dryRun: envBool('DRY_RUN'),
      notionDualWrite: envBool('NOTION_DUAL_WRITE', true),
      telegramAlerts: envBool('TELEGRAM_ALERTS', true),
      debug: envBool('DEBUG'),
    },
  };

  // Apply overrides (shallow merge per section)
  if (overrides) {
    if (overrides.supabase) Object.assign(base.supabase, overrides.supabase);
    if (overrides.notion) Object.assign(base.notion, overrides.notion);
    if (overrides.telegram) Object.assign(base.telegram, overrides.telegram);
    if (overrides.anthropic) Object.assign(base.anthropic, overrides.anthropic);
    if (overrides.parallel) Object.assign(base.parallel, overrides.parallel);
    if (overrides.firecrawl) Object.assign(base.firecrawl, overrides.firecrawl);
    if (overrides.flags) Object.assign(base.flags, overrides.flags);
  }

  return base;
}

/** Singleton config instance. Import this in most cases. */
export const config: AppConfig = loadConfig();
