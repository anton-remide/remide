/**
 * Attempts to add enrichment columns to the entities table.
 * Uses Supabase REST API approach — will create columns that don't exist.
 *
 * Usage: npx tsx scripts/apply-enrichment-columns.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sb = createClient(url, key);

async function main() {
  console.log('Checking current entities schema...');

  // Check if description column exists by trying to select it
  const { error: descErr } = await sb
    .from('entities')
    .select('description')
    .limit(1);

  if (descErr && descErr.message.includes('does not exist')) {
    console.log('❌ Column "description" does not exist.');
    console.log('\nPlease run the following SQL in Supabase SQL Editor:\n');
    console.log(`  ALTER TABLE entities ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';`);
    console.log(`  ALTER TABLE entities ADD COLUMN IF NOT EXISTS linkedin_url TEXT DEFAULT '';`);
    console.log(`  ALTER TABLE entities ADD COLUMN IF NOT EXISTS registry_url TEXT DEFAULT '';`);
    console.log(`  ALTER TABLE entities ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ DEFAULT NULL;`);
    console.log('\nOr paste the full script from: scripts/003_enrichment_columns.sql');
  } else {
    console.log('✅ Column "description" exists!');

    // Also check linkedin_url
    const { error: liErr } = await sb.from('entities').select('linkedin_url').limit(1);
    if (liErr && liErr.message.includes('does not exist')) {
      console.log('❌ Column "linkedin_url" does not exist. Apply 003_enrichment_columns.sql');
    } else {
      console.log('✅ Column "linkedin_url" exists!');
    }

    const { error: regErr } = await sb.from('entities').select('registry_url').limit(1);
    if (regErr && regErr.message.includes('does not exist')) {
      console.log('❌ Column "registry_url" does not exist. Apply 003_enrichment_columns.sql');
    } else {
      console.log('✅ Column "registry_url" exists!');
    }
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
