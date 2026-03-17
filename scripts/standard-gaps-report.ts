/**
 * Standard gaps report.
 *
 * Shows where business-profile standard is weakest:
 * - parser-level completeness and missing-field rates
 * - worst entities by completeness score
 *
 * Usage:
 *   npx tsx scripts/standard-gaps-report.ts
 *   npx tsx scripts/standard-gaps-report.ts --crypto-only
 *   npx tsx scripts/standard-gaps-report.ts --top-parsers 15 --top-entities 25
 *   npx tsx scripts/standard-gaps-report.ts --json
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { getSupabase } from '../shared/supabase.js';

interface Args {
  cryptoOnly: boolean;
  topParsers: number;
  topEntities: number;
  json: boolean;
}

interface EntityRow {
  id: string;
  name: string;
  parser_id: string | null;
  country_code: string | null;
  website: string | null;
  raw_data: Record<string, unknown> | null;
  crypto_status: string | null;
  is_garbage: boolean | null;
  is_hidden: boolean | null;
}

interface ParserGapRow {
  parserId: string;
  sample: number;
  avgCompleteness: number;
  p25Completeness: number;
  missingRates: Record<string, number>;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const topParsersIdx = args.indexOf('--top-parsers');
  const topEntitiesIdx = args.indexOf('--top-entities');
  const topParsers = topParsersIdx !== -1 ? Number.parseInt(args[topParsersIdx + 1] ?? '10', 10) : 10;
  const topEntities = topEntitiesIdx !== -1 ? Number.parseInt(args[topEntitiesIdx + 1] ?? '20', 10) : 20;
  return {
    cryptoOnly: args.includes('--crypto-only'),
    topParsers: Number.isFinite(topParsers) && topParsers > 0 ? topParsers : 10,
    topEntities: Number.isFinite(topEntities) && topEntities > 0 ? topEntities : 20,
    json: args.includes('--json'),
  };
}

function asNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim().length > 0) {
    const n = Number.parseFloat(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean);
}

function deriveMissingFields(rd: Record<string, unknown>): string[] {
  const missing: string[] = [];
  const regions = asStringArray(rd.target_regions);
  const audience = asStringArray(rd.target_audience);
  const platforms = asStringArray(rd.app_platforms);
  const fiat = rd.fiat_onramp;
  const years = asNumber(rd.years_on_market);
  const summary = typeof rd.site_business_summary_en === 'string' ? rd.site_business_summary_en.trim() : '';

  if (regions.length === 0) missing.push('target_regions');
  if (audience.length === 0 || (audience.length === 1 && audience[0] === 'unknown')) missing.push('target_audience');
  if (fiat === null || fiat === undefined) missing.push('fiat_onramp');
  if (platforms.length === 0) missing.push('app_platforms');
  if (years === null) missing.push('years_on_market');
  if (!summary) missing.push('business_summary');
  return missing;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const w = idx - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}

async function fetchRows(cryptoOnly: boolean): Promise<EntityRow[]> {
  const sb = getSupabase();
  const out: EntityRow[] = [];
  let offset = 0;
  const page = 1000;
  let done = false;

  while (!done) {
    let query = sb
      .from('entities')
      .select('id,name,parser_id,country_code,website,raw_data,crypto_status,is_garbage,is_hidden')
      .neq('is_garbage', true)
      .neq('is_hidden', true)
      .not('raw_data', 'is', null)
      .range(offset, offset + page - 1);

    if (cryptoOnly) {
      query = query.in('crypto_status', ['confirmed_crypto', 'crypto_adjacent']);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch rows: ${error.message}`);
    const rows = (data ?? []) as EntityRow[];
    out.push(...rows);
    if (rows.length < page) done = true;
    else offset += page;
  }
  return out;
}

function buildReport(rows: EntityRow[]) {
  const byParser = new Map<string, EntityRow[]>();
  const normalized = rows
    .map((r) => {
      const rd = (r.raw_data ?? {}) as Record<string, unknown>;
      const missing = asStringArray(rd.standard_missing_fields);
      const normalizedMissing = missing.length > 0 ? missing : deriveMissingFields(rd);
      const explicitCompleteness = asNumber(rd.standard_completeness);
      const computedCompleteness = Math.round(((6 - normalizedMissing.length) / 6) * 100);
      const completeness = explicitCompleteness ?? computedCompleteness;
      return { row: r, completeness, missing };
    })
    .filter((x) => x.completeness >= 0);

  for (const item of normalized) {
    const parserId = item.row.parser_id ?? 'unknown';
    if (!byParser.has(parserId)) byParser.set(parserId, []);
    byParser.get(parserId)!.push(item.row);
  }

  const parserRows: ParserGapRow[] = [];
  for (const [parserId, parserEntities] of byParser.entries()) {
    const metrics = parserEntities.map((r) => {
      const rd = (r.raw_data ?? {}) as Record<string, unknown>;
      const missing = asStringArray(rd.standard_missing_fields);
      const normalizedMissing = missing.length > 0 ? missing : deriveMissingFields(rd);
      const explicitCompleteness = asNumber(rd.standard_completeness);
      const computedCompleteness = Math.round(((6 - normalizedMissing.length) / 6) * 100);
      return {
        completeness: explicitCompleteness ?? computedCompleteness,
        missing: normalizedMissing,
      };
    });
    if (metrics.length < 10) continue;

    const completenessValues = metrics.map((m) => m.completeness);
    const avgCompleteness = completenessValues.reduce((a, b) => a + b, 0) / completenessValues.length;
    const p25Completeness = percentile(completenessValues, 0.25);

    const missingCounts: Record<string, number> = {};
    for (const m of metrics) {
      for (const f of m.missing) missingCounts[f] = (missingCounts[f] ?? 0) + 1;
    }
    const missingRates = Object.fromEntries(
      Object.entries(missingCounts).map(([k, v]) => [k, Math.round((v / metrics.length) * 1000) / 10]),
    );

    parserRows.push({
      parserId,
      sample: metrics.length,
      avgCompleteness: Math.round(avgCompleteness * 10) / 10,
      p25Completeness: Math.round(p25Completeness * 10) / 10,
      missingRates,
    });
  }

  parserRows.sort((a, b) => a.avgCompleteness - b.avgCompleteness);

  const worstEntities = normalized
    .sort((a, b) => a.completeness - b.completeness)
    .slice(0, 50)
    .map((x) => ({
      id: x.row.id,
      name: x.row.name,
      parserId: x.row.parser_id ?? 'unknown',
      country: x.row.country_code ?? 'unknown',
      website: x.row.website ?? '',
      completeness: x.completeness,
      missing: x.missing,
      invalidReason: (x.row.raw_data as Record<string, unknown> | null)?.website_invalid_reason ?? null,
      needsReview: (x.row.raw_data as Record<string, unknown> | null)?.website_needs_review ?? false,
    }));

  return { parserRows, worstEntities, scanned: normalized.length };
}

function printReport(report: ReturnType<typeof buildReport>, topParsers: number, topEntities: number, cryptoOnly: boolean) {
  const parsers = report.parserRows.slice(0, topParsers);
  const entities = report.worstEntities.slice(0, topEntities);
  const pad = (s: string, n: number) => s.slice(0, n).padEnd(n);

  console.log('\n' + '═'.repeat(110));
  console.log(`  STANDARD GAPS REPORT | scanned=${report.scanned} | cryptoOnly=${cryptoOnly}`);
  console.log('═'.repeat(110));

  console.log('\n  Worst parsers by average completeness:\n');
  console.log(`  ${pad('Parser', 28)} ${pad('Sample', 8)} ${pad('Avg', 8)} ${pad('P25', 8)} Top missing fields`);
  console.log('  ' + '-'.repeat(105));
  for (const p of parsers) {
    const topMissing = Object.entries(p.missingRates)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k, v]) => `${k}:${v}%`)
      .join(', ');
    console.log(`  ${pad(p.parserId, 28)} ${pad(String(p.sample), 8)} ${pad(p.avgCompleteness.toFixed(1), 8)} ${pad(p.p25Completeness.toFixed(1), 8)} ${topMissing}`);
  }

  console.log('\n  Worst entities by completeness:\n');
  for (const e of entities) {
    const missing = e.missing.join(', ');
    const flags = [e.invalidReason ? `invalid=${e.invalidReason}` : '', e.needsReview ? 'needs_review' : '']
      .filter(Boolean)
      .join(', ');
    console.log(`  - ${e.name} [${e.parserId}/${e.country}] completeness=${e.completeness} website=${e.website} missing=[${missing}] ${flags}`);
  }

  console.log('\n' + '═'.repeat(110) + '\n');
}

async function main() {
  const args = parseArgs();
  const rows = await fetchRows(args.cryptoOnly);
  const report = buildReport(rows);

  if (args.json) {
    console.log(JSON.stringify({
      scanned: report.scanned,
      cryptoOnly: args.cryptoOnly,
      topParsers: report.parserRows.slice(0, args.topParsers),
      topEntities: report.worstEntities.slice(0, args.topEntities),
    }, null, 2));
    return;
  }

  printReport(report, args.topParsers, args.topEntities, args.cryptoOnly);
}

main().catch((err) => {
  console.error('Standard gaps report failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});

