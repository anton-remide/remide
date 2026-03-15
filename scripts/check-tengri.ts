import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(
  process.env.VITE_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

async function check() {
  const { data } = await sb.from('entities')
    .select('id, name, canonical_name, country_code, parser_id')
    .ilike('name', '%Tengri%');
  for (const r of data ?? []) console.log(JSON.stringify(r, null, 2));

  // Also check for "doing business" pattern globally
  const { data: dba } = await sb.from('entities')
    .select('id, name, canonical_name, country_code, parser_id')
    .ilike('name', '%doing business%')
    .limit(20);
  console.log('\n--- Entities with "doing business" in name ---');
  for (const r of dba ?? []) {
    console.log(`  [${r.parser_id}] canonical="${r.canonical_name}" raw="${(r.name as string).substring(0, 120)}"`);
  }

  // Check entities with long names (>80 chars) that may contain DBA clauses
  const { data: longNames } = await sb.from('entities')
    .select('id, name, canonical_name, country_code, parser_id')
    .ilike('canonical_name', '%doing business%')
    .limit(20);
  console.log('\n--- canonical_name with "doing business" ---');
  for (const r of longNames ?? []) {
    console.log(`  [${r.parser_id}] "${r.canonical_name}"`);
  }
}

check();
