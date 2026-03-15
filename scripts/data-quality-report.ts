/**
 * Data Quality Report — shows current state of entities database.
 *
 * Usage:
 *   npx tsx scripts/data-quality-report.ts
 *   npx tsx scripts/data-quality-report.ts --json    # JSON output
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { getSupabase } from '../shared/supabase.js';

interface QualityMetrics {
  total: number;
  withCanonicalName: number;
  garbage: number;
  hidden: number;
  visible: number;
  cryptoBreakdown: Record<string, number>;
  tierBreakdown: Record<string, number>;
  dnsBreakdown: Record<string, number>;
  enrichedCount: number;
  withWebsite: number;
  withDescription: number;
  withLinkedin: number;
  withBrandName: number;
  topCountries: Array<{ code: string; count: number }>;
  topParsers: Array<{ parser: string; count: number }>;
  qualityScoreAvg: number;
  unprocessed: number;
}

async function fetchMetrics(): Promise<QualityMetrics> {
  const sb = getSupabase();

  // Total count
  const { count: total } = await sb.from('entities').select('id', { count: 'exact', head: true });

  // With canonical_name
  const { count: withCanonical } = await sb.from('entities').select('id', { count: 'exact', head: true }).not('canonical_name', 'is', null);

  // Garbage count
  const { count: garbage } = await sb.from('entities').select('id', { count: 'exact', head: true }).eq('is_garbage', true);

  // Hidden count
  const { count: hidden } = await sb.from('entities').select('id', { count: 'exact', head: true }).eq('is_hidden', true);

  // Visible (what frontend shows)
  const { count: visible } = await sb.from('entities').select('id', { count: 'exact', head: true })
    .not('canonical_name', 'is', null)
    .neq('is_garbage', true)
    .neq('is_hidden', true);

  // Crypto status breakdown (via direct SQL-like aggregation)
  const { data: cryptoRows } = await sb.from('entities').select('crypto_status').not('crypto_status', 'is', null);
  const cryptoBreakdown: Record<string, number> = {};
  for (const row of cryptoRows ?? []) {
    const status = (row as { crypto_status: string }).crypto_status ?? 'null';
    cryptoBreakdown[status] = (cryptoBreakdown[status] ?? 0) + 1;
  }

  // Quality tier breakdown
  const { data: flagRows } = await sb.from('entities').select('quality_flags').not('quality_flags', 'is', null);
  const tierBreakdown: Record<string, number> = {};
  for (const row of flagRows ?? []) {
    const flags = (row as { quality_flags: { tier?: string } }).quality_flags;
    const tier = flags?.tier ?? 'none';
    tierBreakdown[tier] = (tierBreakdown[tier] ?? 0) + 1;
  }

  // DNS status breakdown
  const { data: dnsRows } = await sb.from('entities').select('dns_status').not('dns_status', 'is', null);
  const dnsBreakdown: Record<string, number> = {};
  for (const row of dnsRows ?? []) {
    const status = (row as { dns_status: string }).dns_status ?? 'null';
    dnsBreakdown[status] = (dnsBreakdown[status] ?? 0) + 1;
  }

  // Enrichment stats
  const { count: enriched } = await sb.from('entities').select('id', { count: 'exact', head: true }).not('enriched_at', 'is', null);
  const { count: withWebsite } = await sb.from('entities').select('id', { count: 'exact', head: true }).not('website', 'is', null).neq('website', '');
  const { count: withDesc } = await sb.from('entities').select('id', { count: 'exact', head: true }).not('description', 'is', null).neq('description', '');
  const { count: withLinkedin } = await sb.from('entities').select('id', { count: 'exact', head: true }).not('linkedin_url', 'is', null).neq('linkedin_url', '');
  const { count: withBrand } = await sb.from('entities').select('id', { count: 'exact', head: true }).not('brand_name', 'is', null).neq('brand_name', '');

  // Unprocessed (no last_quality_at)
  const { count: unprocessed } = await sb.from('entities').select('id', { count: 'exact', head: true }).is('last_quality_at', null);

  // Top countries
  const { data: countryData } = await sb.rpc('get_entity_counts_by_country' as never);
  const topCountries: Array<{ code: string; count: number }> = [];
  if (countryData && Array.isArray(countryData)) {
    for (const row of countryData.slice(0, 20)) {
      topCountries.push({ code: (row as { country_code: string }).country_code, count: (row as { count: number }).count });
    }
  }

  // Top parsers (approximate via sampling)
  const { data: parserData } = await sb.from('entities').select('parser_id');
  const parserCounts: Record<string, number> = {};
  for (const row of parserData ?? []) {
    const p = (row as { parser_id: string | null }).parser_id ?? 'unknown';
    parserCounts[p] = (parserCounts[p] ?? 0) + 1;
  }
  const topParsers = Object.entries(parserCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([parser, count]) => ({ parser, count }));

  // Average quality score
  const { data: scoreData } = await sb.from('entities').select('quality_score').not('quality_score', 'is', null).gt('quality_score', 0);
  let qualityScoreAvg = 0;
  if (scoreData && scoreData.length > 0) {
    const sum = scoreData.reduce((acc, r) => acc + ((r as { quality_score: number }).quality_score ?? 0), 0);
    qualityScoreAvg = Math.round(sum / scoreData.length);
  }

  return {
    total: total ?? 0,
    withCanonicalName: withCanonical ?? 0,
    garbage: garbage ?? 0,
    hidden: hidden ?? 0,
    visible: visible ?? 0,
    cryptoBreakdown,
    tierBreakdown,
    dnsBreakdown,
    enrichedCount: enriched ?? 0,
    withWebsite: withWebsite ?? 0,
    withDescription: withDesc ?? 0,
    withLinkedin: withLinkedin ?? 0,
    withBrandName: withBrand ?? 0,
    topCountries,
    topParsers,
    qualityScoreAvg,
    unprocessed: unprocessed ?? 0,
  };
}

function printReport(m: QualityMetrics) {
  const pct = (n: number, of: number) => of > 0 ? `${((n / of) * 100).toFixed(1)}%` : '0%';
  const pad = (s: string, n: number) => s.slice(0, n).padEnd(n);

  console.log('\n' + '═'.repeat(70));
  console.log('  VASP TRACKER — DATA QUALITY REPORT');
  console.log('  ' + new Date().toISOString());
  console.log('═'.repeat(70));

  console.log('\n  📊 ENTITY COUNTS');
  console.log('  ' + '-'.repeat(40));
  console.log(`  Total entities:       ${m.total.toLocaleString()}`);
  console.log(`  With canonical name:  ${m.withCanonicalName.toLocaleString()} (${pct(m.withCanonicalName, m.total)})`);
  console.log(`  Garbage:              ${m.garbage.toLocaleString()} (${pct(m.garbage, m.total)})`);
  console.log(`  Hidden:               ${m.hidden.toLocaleString()} (${pct(m.hidden, m.total)})`);
  console.log(`  Visible (frontend):   ${m.visible.toLocaleString()} (${pct(m.visible, m.total)})`);
  console.log(`  Unprocessed:          ${m.unprocessed.toLocaleString()} (${pct(m.unprocessed, m.total)})`);

  console.log('\n  🏷️  CRYPTO CLASSIFICATION');
  console.log('  ' + '-'.repeat(40));
  for (const [status, count] of Object.entries(m.cryptoBreakdown).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${pad(status, 22)} ${count.toLocaleString().padStart(7)} (${pct(count, m.total)})`);
  }

  console.log('\n  ⭐ QUALITY TIERS');
  console.log('  ' + '-'.repeat(40));
  for (const [tier, count] of Object.entries(m.tierBreakdown).sort()) {
    console.log(`  ${pad(tier, 8)} ${count.toLocaleString().padStart(7)} (${pct(count, m.total)})`);
  }
  console.log(`  Avg score: ${m.qualityScoreAvg}/100`);

  console.log('\n  🌐 DNS STATUS');
  console.log('  ' + '-'.repeat(40));
  for (const [status, count] of Object.entries(m.dnsBreakdown).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${pad(status, 15)} ${count.toLocaleString().padStart(7)} (${pct(count, m.total)})`);
  }

  console.log('\n  🔍 ENRICHMENT');
  console.log('  ' + '-'.repeat(40));
  console.log(`  Enriched:             ${m.enrichedCount.toLocaleString()} (${pct(m.enrichedCount, m.total)})`);
  console.log(`  With website:         ${m.withWebsite.toLocaleString()} (${pct(m.withWebsite, m.total)})`);
  console.log(`  With description:     ${m.withDescription.toLocaleString()} (${pct(m.withDescription, m.total)})`);
  console.log(`  With LinkedIn:        ${m.withLinkedin.toLocaleString()} (${pct(m.withLinkedin, m.total)})`);
  console.log(`  With brand name:      ${m.withBrandName.toLocaleString()} (${pct(m.withBrandName, m.total)})`);

  if (m.topParsers.length > 0) {
    console.log('\n  🏗️  TOP PARSERS (by entity count)');
    console.log('  ' + '-'.repeat(40));
    for (const { parser, count } of m.topParsers.slice(0, 15)) {
      console.log(`  ${pad(parser, 22)} ${count.toLocaleString().padStart(7)} (${pct(count, m.total)})`);
    }
  }

  console.log('\n' + '═'.repeat(70) + '\n');
}

async function main() {
  const jsonOnly = process.argv.includes('--json');

  try {
    const metrics = await fetchMetrics();

    if (jsonOnly) {
      console.log(JSON.stringify(metrics, null, 2));
    } else {
      printReport(metrics);
    }
  } catch (err) {
    console.error('Error generating report:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
