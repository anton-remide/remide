import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(
  process.env.VITE_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

async function check() {
  // 1. Where are the NULL canonical_name entities?
  const { data } = await sb.from('entities')
    .select('country_code, parser_id')
    .is('canonical_name', null)
    .limit(2000);

  const byParser: Record<string, number> = {};
  const byCountry: Record<string, number> = {};
  for (const r of data ?? []) {
    byParser[r.parser_id ?? 'null'] = (byParser[r.parser_id ?? 'null'] || 0) + 1;
    byCountry[r.country_code ?? 'null'] = (byCountry[r.country_code ?? 'null'] || 0) + 1;
  }

  const sorted = Object.entries(byParser).sort((a, b) => b[1] - a[1]);
  console.log('NULL canonical_name by parser_id (top 15):');
  for (const [k, v] of sorted.slice(0, 15)) {
    console.log(`  ${k}: ${v}`);
  }

  const sortedC = Object.entries(byCountry).sort((a, b) => b[1] - a[1]);
  console.log('\nNULL canonical_name by country (top 15):');
  for (const [k, v] of sortedC.slice(0, 15)) {
    console.log(`  ${k}: ${v}`);
  }

  // 2. Entities with quotes still in canonical_name
  const { data: dirty } = await sb.from('entities')
    .select('name, canonical_name')
    .not('canonical_name', 'is', null)
    .or('canonical_name.like.%"%,canonical_name.like.%«%,canonical_name.like.%„%,canonical_name.like.%»%')
    .limit(20);
  console.log(`\nEntities with quotes IN canonical_name: ${dirty?.length ?? 0}`);
  for (const r of dirty ?? []) {
    console.log(`  CAN: ${r.canonical_name?.substring(0, 80)}`);
  }

  // 3. Sample the worst offenders (null canonical_name + dirty raw name)
  const { data: worst } = await sb.from('entities')
    .select('name, canonical_name, parser_id, country_code')
    .is('canonical_name', null)
    .or('name.like.%"%,name.like.%«%,name.like.%„%,name.like.%»%')
    .limit(15);
  console.log(`\nWorst offenders (null canonical + quotes in name): ${worst?.length ?? 0}`);
  for (const r of worst ?? []) {
    console.log(`  [${r.parser_id}/${r.country_code}] ${r.name?.substring(0, 80)}`);
  }
}

check();
