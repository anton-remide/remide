import { getSupabase } from '../shared/supabase.js';

async function main() {
  const sb = getSupabase();

  // 1. Count entities with "Insurance" in name, entity_types, or activities
  const { data: allEnts, error } = await sb
    .from('entities')
    .select('id, name, entity_types, activities, parser_id, country_code, status, is_garbage')
    .or('name.ilike.%insurance%,entity_types.cs.{Insurance Company},activities.cs.{Insurance}');
  
  if (error) { console.error(error); process.exit(1); }
  
  console.log(`Total entities matching "insurance": ${allEnts?.length ?? 0}`);
  
  // Show breakdown by parser
  const byParser: Record<string, number> = {};
  const nonGarbage = (allEnts || []).filter(e => !e.is_garbage);
  console.log(`Non-garbage insurance entities: ${nonGarbage.length}`);
  
  for (const e of nonGarbage) {
    const pid = e.parser_id || 'unknown';
    byParser[pid] = (byParser[pid] || 0) + 1;
  }
  
  console.log('\nBy parser:');
  Object.entries(byParser).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  
  // Show first 20 non-garbage insurance entities
  console.log('\nSample non-garbage insurance entities:');
  nonGarbage.slice(0, 20).forEach(e => {
    console.log(`  [${e.parser_id}] ${e.name} | types=${JSON.stringify(e.entity_types)} | activities=${JSON.stringify(e.activities)}`);
  });
  
  // 2. Also check: how many PRA entities have entity_types containing "Insurance"
  const praEnts = nonGarbage.filter(e => e.parser_id === 'gb-pra');
  console.log(`\nPRA insurance entities: ${praEnts.length}`);
  
  // 3. Check what entity_types gb-pra entities have in general
  const { data: allPra } = await sb
    .from('entities')
    .select('id, entity_types')
    .eq('parser_id', 'gb-pra')
    .eq('is_garbage', false);
  
  const praTypes: Record<string, number> = {};
  for (const e of (allPra || [])) {
    for (const t of (e.entity_types || [])) {
      praTypes[t] = (praTypes[t] || 0) + 1;
    }
  }
  console.log('\nAll PRA entity_types:');
  Object.entries(praTypes).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
}

main().catch(err => { console.error(err); process.exit(1); });
