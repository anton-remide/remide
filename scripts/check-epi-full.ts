import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function fetchAll(query: any) {
  const results: any[] = [];
  let from = 0;
  const batchSize = 1000;
  while (true) {
    const { data, error } = await query.range(from, from + batchSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    results.push(...data);
    if (data.length < batchSize) break;
    from += batchSize;
  }
  return results;
}

async function check() {
  // FULL breakdown of PL eba-pl entities
  const plAll = await fetchAll(
    sb.from('entities').select('license_type, crypto_status, quality_score, is_garbage')
      .eq('country_code', 'PL').eq('parser_id', 'eba-pl')
  );

  const byType: Record<string, number> = {};
  const byCrypto: Record<string, number> = {};
  let garbageCount = 0;
  let totalQuality = 0;

  plAll.forEach((e: any) => {
    const t = e.license_type || 'NULL';
    byType[t] = (byType[t] || 0) + 1;
    byCrypto[e.crypto_status || 'unknown'] = (byCrypto[e.crypto_status || 'unknown'] || 0) + 1;
    if (e.is_garbage) garbageCount++;
    totalQuality += e.quality_score || 0;
  });

  console.log('=== PL eba-pl FULL breakdown ===');
  console.log('Total:', plAll.length);
  console.log('\nBy license_type:');
  Object.entries(byType).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    console.log(`  ${k}: ${v} (${(v / plAll.length * 100).toFixed(1)}%)`);
  });
  console.log('\nBy crypto_status:');
  Object.entries(byCrypto).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    console.log(`  ${k}: ${v}`);
  });
  console.log(`\nGarbage: ${garbageCount}`);
  console.log(`Avg quality: ${(totalQuality / plAll.length).toFixed(1)}`);

  // GLOBAL: what types are bloating?
  console.log('\n=== GLOBAL entity type distribution (EBA parsers only) ===');
  const ebaAll = await fetchAll(
    sb.from('entities').select('license_type, country_code')
      .like('parser_id', 'eba-%')
  );

  console.log('Total EBA entities:', ebaAll.length);
  const globalByType: Record<string, number> = {};
  ebaAll.forEach((e: any) => {
    const t = e.license_type || 'NULL';
    globalByType[t] = (globalByType[t] || 0) + 1;
  });
  console.log('\nBy license_type:');
  Object.entries(globalByType).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    console.log(`  ${k}: ${v} (${(v / ebaAll.length * 100).toFixed(1)}%)`);
  });

  // Top countries by EBA entity count
  const ebaByCountry: Record<string, number> = {};
  ebaAll.forEach((e: any) => {
    ebaByCountry[e.country_code] = (ebaByCountry[e.country_code] || 0) + 1;
  });
  console.log('\nTop 15 countries by EBA entity count:');
  Object.entries(ebaByCountry).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([k, v]) => {
    console.log(`  ${k}: ${v}`);
  });

  // Specifically: how many EPI + ENL + Exempt EMI (candidates for removal)
  const removeCandidates = ebaAll.filter((e: any) =>
    e.license_type === 'E-Money Payment Institution (EPI)' ||
    e.license_type === 'Entity National Law' ||
    e.license_type === 'Exempt EMI'
  );
  console.log(`\n=== Removal candidates (EPI + ENL + Exempt EMI) ===`);
  console.log(`Total: ${removeCandidates.length} of ${ebaAll.length} (${(removeCandidates.length / ebaAll.length * 100).toFixed(1)}%)`);
  console.log(`Remaining after removal: ${ebaAll.length - removeCandidates.length}`);

  // What remains: EMI + PI only
  const remaining = ebaAll.filter((e: any) =>
    e.license_type === 'E-Money Institution (EMI)' ||
    e.license_type === 'Payment Institution (PI)'
  );
  console.log(`\nRemaining (EMI + PI only): ${remaining.length}`);
  const remByCountry: Record<string, number> = {};
  remaining.forEach((e: any) => {
    remByCountry[e.country_code] = (remByCountry[e.country_code] || 0) + 1;
  });
  console.log('By country:');
  Object.entries(remByCountry).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([k, v]) => {
    console.log(`  ${k}: ${v}`);
  });
}

check().catch(console.error);
