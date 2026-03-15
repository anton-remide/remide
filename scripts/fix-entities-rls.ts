/**
 * Fix: Add public read policy for entities table.
 * The current RLS only allows `authenticated` users to read entities,
 * but anon users need read access too (blur paywall is frontend-only).
 *
 * Run: npx tsx scripts/fix-entities-rls.ts
 */

import { getSupabase } from '../shared/supabase.js';

async function main() {
  const sb = getSupabase();

  // Test: can service role read entities?
  const { count, error: countErr } = await sb
    .from('entities')
    .select('id', { count: 'exact', head: true });

  if (countErr) {
    console.error('Cannot read entities even with service role:', countErr.message);
    return;
  }

  console.log(`Service role can see ${count} entities`);

  // We can't run DDL from the client library.
  // Output the SQL to run in Supabase dashboard.
  console.log('\n=== RUN THIS SQL IN SUPABASE SQL EDITOR ===\n');
  console.log(`-- Fix: Allow anonymous users to read entities (blur paywall is frontend-only)
CREATE POLICY "entities_select_public"
  ON entities FOR SELECT USING (true);

-- Optionally drop the old authenticated-only policy (it's now redundant)
-- DROP POLICY "entities_select_authenticated" ON entities;
`);
  console.log('===========================================\n');
}

main().catch(console.error);
