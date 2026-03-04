/**
 * Unified Supabase client — lazy-loaded singleton.
 *
 * Backend scripts use service key (full access).
 * Frontend uses anon key (RLS-restricted).
 *
 * Usage:
 *   import { getSupabase } from '../shared/supabase.js';
 *   const sb = getSupabase();
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from './config.js';

let client: SupabaseClient | null = null;

/**
 * Get a Supabase client using the service key (backend).
 * Throws if SUPABASE_URL or key is missing.
 */
export function getSupabase(): SupabaseClient {
  if (client) return client;

  const { url, serviceKey } = config.supabase;

  if (!url || !serviceKey) {
    throw new Error(
      'Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local'
    );
  }

  client = createClient(url, serviceKey);
  return client;
}

/**
 * Get a Supabase client using the anon key (RLS-restricted).
 * Useful for frontend-like access patterns in workers.
 */
export function getSupabaseAnon(): SupabaseClient {
  const { url, anonKey } = config.supabase;

  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase anon credentials. Set SUPABASE_URL and SUPABASE_ANON_KEY in .env.local'
    );
  }

  // Don't cache — each call may need a different auth context
  return createClient(url, anonKey);
}

/** Reset cached client (for testing). */
export function resetSupabaseClient(): void {
  client = null;
}
