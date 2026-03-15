import { getSupabase } from '../shared/supabase.js';

async function main() {
  const sb = getSupabase();

  // Get entity counts by parser_id
  const { data, error } = await sb
    .from('entities')
    .select('parser_id, country_code')
    .eq('is_garbage', false);

  if (error) { console.error(error); return; }

  // Count by parser
  const parserCounts: Record<string, number> = {};
  const countryCounts: Record<string, number> = {};
  for (const e of data) {
    parserCounts[e.parser_id || 'null'] = (parserCounts[e.parser_id || 'null'] || 0) + 1;
    countryCounts[e.country_code] = (countryCounts[e.country_code] || 0) + 1;
  }

  console.log('=== Entities by Parser (non-garbage) ===');
  const sorted = Object.entries(parserCounts).sort((a, b) => b[1] - a[1]);
  for (const [p, c] of sorted) console.log(`  ${p}: ${c}`);
  console.log(`\nTotal non-garbage: ${data.length}`);

  console.log('\n=== Top 30 Countries by Entity Count ===');
  const countrySorted = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]);
  for (const [c, n] of countrySorted.slice(0, 30)) console.log(`  ${c}: ${n}`);

  console.log('\n=== Countries with 0 entities ===');
  const { data: jur } = await sb.from('jurisdictions').select('code, name');
  const covered = new Set(Object.keys(countryCounts));
  const uncovered = (jur || [])
    .filter(j => !covered.has(j.code) && j.code !== 'EU')
    .sort((a, b) => a.name.localeCompare(b.name));
  console.log(`Countries WITH entities: ${covered.size}`);
  console.log(`Jurisdictions WITHOUT entities: ${uncovered.length}`);
  for (const j of uncovered) console.log(`  ${j.code}: ${j.name}`);
}

main();
