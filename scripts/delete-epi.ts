/**
 * Delete all EPI (E-Money Payment Institution) entities from Supabase.
 * These are micro-payment institutions (currency exchange kiosks, micro-businesses)
 * that are not crypto-related and add noise to the database.
 *
 * Usage: npx tsx scripts/delete-epi.ts [--dry-run]
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const DRY_RUN = process.argv.includes('--dry-run');
const LICENSE_TYPE = 'E-Money Payment Institution (EPI)';

async function run() {
  console.log(DRY_RUN ? '🔍 DRY RUN — no deletions' : '🗑️  LIVE RUN — deleting EPI entities');
  console.log('');

  // Count before
  const { count: totalBefore } = await sb.from('entities')
    .select('*', { count: 'exact', head: true });
  const { count: epiCount } = await sb.from('entities')
    .select('*', { count: 'exact', head: true })
    .eq('license_type', LICENSE_TYPE);

  console.log(`Total entities before: ${totalBefore}`);
  console.log(`EPI entities to delete: ${epiCount}`);
  console.log(`Expected after: ${(totalBefore || 0) - (epiCount || 0)}`);
  console.log('');

  if (DRY_RUN) {
    // Show breakdown by country
    const results: any[] = [];
    let from = 0;
    while (true) {
      const { data } = await sb.from('entities').select('country_code')
        .eq('license_type', LICENSE_TYPE)
        .range(from, from + 999);
      if (!data || data.length === 0) break;
      results.push(...data);
      if (data.length < 1000) break;
      from += 1000;
    }
    const byCountry: Record<string, number> = {};
    results.forEach(e => {
      byCountry[e.country_code] = (byCountry[e.country_code] || 0) + 1;
    });
    console.log('EPI by country (to be deleted):');
    Object.entries(byCountry).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
      console.log(`  ${k}: ${v}`);
    });
    console.log('\nRun without --dry-run to execute deletion.');
    return;
  }

  // Delete in batches by country to avoid timeout
  const { data: countries } = await sb.from('entities')
    .select('country_code')
    .eq('license_type', LICENSE_TYPE);

  const uniqueCountries = [...new Set((countries || []).map(c => c.country_code))];
  console.log(`Deleting EPI from ${uniqueCountries.length} countries...`);

  let totalDeleted = 0;
  for (const cc of uniqueCountries) {
    const { count } = await sb.from('entities')
      .select('*', { count: 'exact', head: true })
      .eq('license_type', LICENSE_TYPE)
      .eq('country_code', cc);

    const { error } = await sb.from('entities')
      .delete()
      .eq('license_type', LICENSE_TYPE)
      .eq('country_code', cc);

    if (error) {
      console.error(`  ❌ ${cc}: ${error.message}`);
    } else {
      totalDeleted += count || 0;
      console.log(`  ✅ ${cc}: ${count} deleted`);
    }
  }

  // Verify
  const { count: totalAfter } = await sb.from('entities')
    .select('*', { count: 'exact', head: true });
  const { count: epiAfter } = await sb.from('entities')
    .select('*', { count: 'exact', head: true })
    .eq('license_type', LICENSE_TYPE);

  console.log('');
  console.log(`=== RESULT ===`);
  console.log(`Deleted: ${totalDeleted}`);
  console.log(`EPI remaining: ${epiAfter}`);
  console.log(`Total entities: ${totalBefore} → ${totalAfter}`);
}

run().catch(console.error);
