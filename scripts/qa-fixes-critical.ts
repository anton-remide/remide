/**
 * Critical QA Fixes — high-impact bugs that affect user experience.
 *
 * 1. Update jurisdiction entity_count to match actual entity counts
 * 2. Remove duplicate entities (null-parser copies)
 * 3. Fix stablecoins issuer_id FK (points to stride_id, needs real id mapping)
 *
 * Usage:
 *   cd /Users/antontitov/Vasp\ Tracker/remide && npx tsx scripts/qa-fixes-critical.ts
 */

import { getSupabase } from '../shared/supabase.js';

const sb = getSupabase();

async function main() {
  console.log('═'.repeat(70));
  console.log('  CRITICAL QA FIXES — ' + new Date().toISOString());
  console.log('═'.repeat(70));

  // ════════════════════════════════════════════════════════════════
  //  FIX 1: Update jurisdiction entity_count
  // ════════════════════════════════════════════════════════════════
  console.log('\n--- FIX 1: Update jurisdiction entity_count ---');

  // Get all entities (non-garbage) counts by country
  const { data: allEnts, error: entErr } = await sb
    .from('entities')
    .select('country_code, is_garbage');
  if (entErr) { console.error('Error fetching entities:', entErr); return; }

  const actualCounts = new Map<string, number>();
  for (const e of (allEnts || [])) {
    if (e.is_garbage === true) continue; // skip garbage
    actualCounts.set(e.country_code, (actualCounts.get(e.country_code) || 0) + 1);
  }

  console.log(`  Total non-garbage entities: ${[...actualCounts.values()].reduce((a, b) => a + b, 0)}`);
  console.log(`  Countries with entities: ${actualCounts.size}`);

  // Get all jurisdictions
  const { data: jurs, error: jurErr } = await sb
    .from('jurisdictions')
    .select('code, entity_count');
  if (jurErr) { console.error('Error fetching jurisdictions:', jurErr); return; }

  let updated = 0;
  let mismatches = 0;
  for (const j of (jurs || [])) {
    const actual = actualCounts.get(j.code) || 0;
    if (j.entity_count !== actual) {
      mismatches++;
      const { error: upErr } = await sb
        .from('jurisdictions')
        .update({ entity_count: actual })
        .eq('code', j.code);
      if (upErr) {
        console.error(`  ERROR updating ${j.code}: ${upErr.message}`);
      } else {
        updated++;
        if (updated <= 15) {
          console.log(`  Updated ${j.code}: ${j.entity_count} → ${actual}`);
        }
      }
    }
  }
  console.log(`  Total mismatches: ${mismatches}, updated: ${updated}`);

  // ════════════════════════════════════════════════════════════════
  //  FIX 2: Remove duplicate entities (null-parser copies)
  // ════════════════════════════════════════════════════════════════
  console.log('\n--- FIX 2: Remove duplicate entities ---');

  const dupeIds = [
    // Binance Bahrain: keep bh-binance-bahrain-bscc (parser=bh-cbb), delete bh-binance-bahrain-b-s-c-c (parser=null)
    'bh-binance-bahrain-b-s-c-c',
    // CoinMENA Bahrain: keep bh-coinmena-bscc (parser=bh-cbb), delete bh-coinmena-b-s-c-c (parser=null)
    'bh-coinmena-b-s-c-c',
    // Buda.com Colombia: keep co-budacom-colombia (parser=co-sfc), delete co-buda-com-colombia (parser=null)
    'co-buda-com-colombia',
    // Buda.com Peru: keep pe-budacom-peru (parser=pe-sbs), delete pe-buda-com-peru (parser=null)
    'pe-buda-com-peru',
    // Buda.com Chile: keep cl-budacom-spa (parser=cl-cmf), delete cl-buda-com-chile (parser=null)
    'cl-buda-com-chile',
  ];

  let deleted = 0;
  for (const id of dupeIds) {
    const { error: delErr } = await sb.from('entities').delete().eq('id', id);
    if (delErr) {
      console.error(`  ERROR deleting ${id}: ${delErr.message}`);
    } else {
      deleted++;
      console.log(`  Deleted duplicate: ${id}`);
    }
  }
  console.log(`  Deleted ${deleted} duplicate entities`);

  // ════════════════════════════════════════════════════════════════
  //  FIX 3: Investigate stablecoins issuer_id FK
  // ════════════════════════════════════════════════════════════════
  console.log('\n--- FIX 3: Check stablecoins issuer_id FK ---');

  const { data: stables } = await sb
    .from('stablecoins')
    .select('id, ticker, issuer_id')
    .not('issuer_id', 'is', null)
    .order('issuer_id');

  const { data: issuers } = await sb
    .from('stablecoin_issuers')
    .select('id, stride_id, name');

  // Build stride_id → real id map
  const strideToReal = new Map<number, number>();
  const realIds = new Set<number>();
  for (const iss of (issuers || [])) {
    realIds.add(iss.id);
    if (iss.stride_id) {
      strideToReal.set(iss.stride_id, iss.id);
    }
  }

  // Check which pattern is used
  let matchesRealId = 0;
  let matchesStrideId = 0;
  let matchesNeither = 0;

  for (const s of (stables || [])) {
    if (realIds.has(s.issuer_id)) matchesRealId++;
    else if (strideToReal.has(s.issuer_id)) matchesStrideId++;
    else matchesNeither++;
  }

  console.log(`  Stablecoins with issuer_id: ${stables?.length}`);
  console.log(`  Matches real id: ${matchesRealId}`);
  console.log(`  Matches stride_id: ${matchesStrideId}`);
  console.log(`  Matches neither: ${matchesNeither}`);

  if (matchesStrideId > matchesRealId && matchesStrideId > 0) {
    console.log(`  → issuer_id references stride_id. Fixing...`);
    let fixed = 0;
    for (const s of (stables || [])) {
      const realId = strideToReal.get(s.issuer_id);
      if (realId && !realIds.has(s.issuer_id)) {
        const { error: upErr } = await sb
          .from('stablecoins')
          .update({ issuer_id: realId })
          .eq('id', s.id);
        if (!upErr) {
          fixed++;
        } else {
          console.error(`  ERROR fixing ${s.ticker}: ${upErr.message}`);
        }
      }
    }
    console.log(`  Fixed ${fixed} stablecoin issuer_id references`);
  } else if (matchesRealId > matchesStrideId) {
    console.log(`  → issuer_id already references real id. No fix needed.`);
  } else {
    console.log(`  → Cannot determine pattern. Manual investigation needed.`);
    // Show first 5 examples
    for (const s of (stables || []).slice(0, 5)) {
      const issuer = issuers?.find((i: any) => i.id === s.issuer_id || i.stride_id === s.issuer_id);
      console.log(`    ${s.ticker}: issuer_id=${s.issuer_id} → ${issuer ? issuer.name : 'NOT FOUND'}`);
    }
  }

  console.log('\n' + '═'.repeat(70));
  console.log('  DONE');
  console.log('═'.repeat(70));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
