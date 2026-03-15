import { getSupabase } from '../shared/supabase.js';

async function main() {
  const sb = getSupabase();
  
  // Count remaining non-garbage PRA entities
  const { data, error } = await sb
    .from('entities')
    .select('id, name, activities, status, canonical_name')
    .eq('parser_id', 'gb-pra')
    .eq('is_garbage', false);
  
  if (error) { console.error(error); process.exit(1); }
  
  console.log(`Remaining non-garbage PRA entities: ${data?.length ?? 0}`);
  
  // Show activities breakdown
  const byActivity: Record<string, number> = {};
  for (const e of (data || [])) {
    for (const a of (e.activities || ['(none)'])) {
      byActivity[a] = (byActivity[a] || 0) + 1;
    }
    if ((e.activities || []).length === 0) {
      byActivity['(no activities)'] = (byActivity['(no activities)'] || 0) + 1;
    }
  }
  
  console.log('\nActivities breakdown:');
  Object.entries(byActivity).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  
  // Show first 30 names
  console.log('\nFirst 30 remaining:');
  (data || []).sort((a, b) => (a.canonical_name || a.name).localeCompare(b.canonical_name || b.name))
    .slice(0, 30).forEach(e => console.log(`  ${e.canonical_name || e.name} | ${(e.activities || []).join(', ')} | ${e.status}`));
  
  // Total garbage count
  const { count: garbageCount } = await sb.from('entities')
    .select('id', { count: 'exact', head: true })
    .eq('is_garbage', true);
  console.log(`\nTotal garbage entities now: ${garbageCount}`);
  
  const { count: nonGarbageCount } = await sb.from('entities')
    .select('id', { count: 'exact', head: true })
    .eq('is_garbage', false);
  console.log(`Total clean entities: ${nonGarbageCount}`);
}

main().catch(err => { console.error(err); process.exit(1); });
