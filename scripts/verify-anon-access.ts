/**
 * Verify: anonymous users can read entities table
 * Run: npx tsx scripts/verify-anon-access.ts
 */

import { createClient } from '@supabase/supabase-js';
import { config as dotenvConfig } from 'dotenv';
dotenvConfig({ path: '.env.local' });

const url = process.env.VITE_SUPABASE_URL!;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY!;

async function main() {
  // Create client with ANON key (simulates frontend anonymous user)
  const anon = createClient(url, anonKey);

  // Test 1: Count entities
  const { count: entityCount, error: entityErr } = await anon
    .from('entities')
    .select('id', { count: 'exact', head: true });

  console.log(`Entities (anon): ${entityCount ?? 'ERROR'} ${entityErr ? `(${entityErr.message})` : '✅'}`);

  // Test 2: Count jurisdictions (should always work)
  const { count: jurCount, error: jurErr } = await anon
    .from('jurisdictions')
    .select('code', { count: 'exact', head: true });

  console.log(`Jurisdictions (anon): ${jurCount ?? 'ERROR'} ${jurErr ? `(${jurErr.message})` : '✅'}`);

  // Test 3: Count stablecoins
  const { count: stableCount, error: stableErr } = await anon
    .from('stablecoins')
    .select('id', { count: 'exact', head: true });

  console.log(`Stablecoins (anon): ${stableCount ?? 'ERROR'} ${stableErr ? `(${stableErr.message})` : '✅'}`);

  // Test 4: Fetch a few entities to verify data comes through
  const { data, error: fetchErr } = await anon
    .from('entities')
    .select('id, name, canonical_name, country_code')
    .limit(3);

  if (fetchErr) {
    console.log(`Fetch sample: ERROR (${fetchErr.message})`);
  } else {
    console.log(`\nSample entities (anon view):`);
    for (const e of data ?? []) {
      console.log(`  ${e.canonical_name || e.name} (${e.country_code})`);
    }
  }
}

main().catch(console.error);
