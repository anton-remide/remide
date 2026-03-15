import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const sb = createClient(process.env.VITE_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);

async function check() {
  // Look at Agnieszka entries
  const names = ['Agnieszka Białas', 'Agnieszka Chrobak', 'Agnieszka Cwajna', 'Agnieszka Czermak', 'Agnieszka Elak', 'Agnieszka Gracka'];
  for (const n of names) {
    const { data } = await sb.from('entities').select('id, name, canonical_name, parser_id, license_type, entity_types, is_garbage').ilike('name', '%' + n + '%');
    for (const r of data ?? []) {
      console.log(`${r.canonical_name || r.name} | ${r.parser_id} | ${r.license_type} | ${(r.entity_types || []).join(',')} | garbage: ${r.is_garbage}`);
    }
  }

  // Agility Bank
  const { data: agility } = await sb.from('entities').select('id, canonical_name, parser_id, license_type').ilike('name', '%Agility Bank%');
  if (agility?.length) console.log('\nAgility Bank:', JSON.stringify(agility[0]));

  // Count EBA-PL by entity_types
  console.log('\n--- EBA-PL entity_types breakdown ---');
  const { data: allPl } = await sb.from('entities').select('entity_types, license_type').eq('parser_id', 'eba-pl');
  const typeCounts: Record<string, number> = {};
  for (const r of allPl ?? []) {
    const key = (r.entity_types || []).join(',') + ' | ' + (r.license_type || '');
    typeCounts[key] = (typeCounts[key] || 0) + 1;
  }
  const sorted = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
  for (const [k, v] of sorted.slice(0, 10)) console.log(`  ${v}x: ${k}`);
  console.log(`  Total PL-EBA: ${allPl?.length}`);

  // How many EBA-PL entries are < 50 chars name and have no website?
  const { data: small } = await sb.from('entities')
    .select('id, canonical_name, name, website')
    .eq('parser_id', 'eba-pl')
    .is('website', null);
  console.log(`\nEBA-PL without website: ${small?.length} / ${allPl?.length}`);

  // How many have the EPI license type?
  const epiCount = allPl?.filter(r => (r.license_type || '').includes('EPI')).length || 0;
  console.log(`EBA-PL with EPI license: ${epiCount}`);
}

check();
