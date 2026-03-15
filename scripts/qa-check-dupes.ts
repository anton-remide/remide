import { getSupabase } from '../shared/supabase.js';
const sb = getSupabase();

async function main() {
  // Check duplicates by raw name
  const dupes = ['binance bahrain', 'buda.com', 'coinmena'];
  for (const q of dupes) {
    const { data } = await sb.from('entities').select('id, name, canonical_name, parser_id, country_code').ilike('name', '%' + q + '%');
    console.log('Search:', q, '→', data?.length, 'results');
    data?.forEach((e: any) => console.log('  ', JSON.stringify({id:e.id, name:e.name, canonical:e.canonical_name, parser:e.parser_id, cc:e.country_code})));
  }

  // Check '380' entity
  const { data: e380 } = await sb.from('entities').select('id, name, canonical_name, is_garbage, parser_id').eq('name', '380');
  console.log('\nEntity "380":', e380?.length, 'found');
  e380?.forEach((e: any) => console.log('  ', JSON.stringify(e)));

  // Check stale entity_count in jurisdictions — the MOST critical bug
  const { data: jur } = await sb.from('jurisdictions').select('code, name, entity_count');
  const { data: ents } = await sb.from('entities').select('country_code').eq('is_garbage', false);

  const actualCounts = new Map<string, number>();
  for (const e of (ents || [])) {
    actualCounts.set(e.country_code, (actualCounts.get(e.country_code) || 0) + 1);
  }

  let mismatches = 0;
  for (const j of (jur || [])) {
    const actual = actualCounts.get(j.code) || 0;
    if (j.entity_count !== actual) {
      mismatches++;
      if (mismatches <= 20) {
        console.log(`  MISMATCH: ${j.code} (${j.name}): stored=${j.entity_count}, actual=${actual}`);
      }
    }
  }
  console.log(`\nTotal mismatches: ${mismatches}`);
}

main().catch(console.error);
