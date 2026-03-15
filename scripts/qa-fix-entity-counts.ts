/**
 * Fix jurisdiction entity_count — PROPERLY with pagination.
 *
 * Previous fix was wrong because Supabase default limit = 1000 rows.
 * This version uses COUNT queries per country code.
 */

import { getSupabase } from '../shared/supabase.js';

const sb = getSupabase();

async function main() {
  console.log('═'.repeat(70));
  console.log('  FIX ENTITY COUNTS (PAGINATED) — ' + new Date().toISOString());
  console.log('═'.repeat(70));

  // Get all jurisdictions
  const { data: jurs, error: jurErr } = await sb
    .from('jurisdictions')
    .select('code, name, entity_count')
    .order('code');
  if (jurErr) { console.error('Error fetching jurisdictions:', jurErr); return; }

  console.log(`  Jurisdictions: ${jurs?.length}`);

  let updated = 0;
  let mismatches = 0;

  for (const j of (jurs || [])) {
    // Use COUNT query for each country — no row limit issues
    const { count, error: cErr } = await sb
      .from('entities')
      .select('*', { count: 'exact', head: true })
      .eq('country_code', j.code)
      .or('is_garbage.is.null,is_garbage.eq.false');

    if (cErr) {
      console.error(`  ERROR counting ${j.code}: ${cErr.message}`);
      continue;
    }

    const actual = count || 0;
    if (j.entity_count !== actual) {
      mismatches++;
      const { error: upErr } = await sb
        .from('jurisdictions')
        .update({ entity_count: actual })
        .eq('code', j.code);

      if (!upErr) {
        updated++;
        if (mismatches <= 25 || actual > 100) {
          console.log(`  ${j.code} (${j.name}): ${j.entity_count} → ${actual}`);
        }
      } else {
        console.error(`  ERROR updating ${j.code}: ${upErr.message}`);
      }
    }
  }

  console.log(`\n  Mismatches: ${mismatches}, Updated: ${updated}`);

  // Verify top 10
  console.log('\n  TOP 10 BY ENTITY COUNT (after fix):');
  const { data: top10 } = await sb
    .from('jurisdictions')
    .select('code, name, entity_count')
    .order('entity_count', { ascending: false })
    .limit(10);

  for (const j of (top10 || [])) {
    console.log(`    ${j.code} (${j.name}): ${j.entity_count}`);
  }

  // Total check
  const { count: totalEntities } = await sb
    .from('entities')
    .select('*', { count: 'exact', head: true })
    .or('is_garbage.is.null,is_garbage.eq.false');

  const jurisdictionSum = (top10 || []).reduce((s: number, j: any) => s + j.entity_count, 0);
  const { data: allJurs } = await sb.from('jurisdictions').select('entity_count');
  const totalJurSum = (allJurs || []).reduce((s: number, j: any) => s + j.entity_count, 0);

  console.log(`\n  Total non-garbage entities: ${totalEntities}`);
  console.log(`  Sum of all jurisdiction entity_counts: ${totalJurSum}`);

  console.log('\n' + '═'.repeat(70));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
