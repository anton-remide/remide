/**
 * Parser Usefulness Report (PUS)
 *
 * Measures how useful parser+enrichment output is for decision making:
 * coverage + confidence + freshness + consistency.
 *
 * Usage:
 *   npx tsx scripts/parser-usefulness-report.ts
 *   npx tsx scripts/parser-usefulness-report.ts --crypto-only
 *   npx tsx scripts/parser-usefulness-report.ts --top 25 --min-sample 10
 *   npx tsx scripts/parser-usefulness-report.ts --include-not-enriched
 *   npx tsx scripts/parser-usefulness-report.ts --json
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { getSupabase } from '../shared/supabase.js';

const DEFAULT_TOP = 20;
const DEFAULT_MIN_SAMPLE = 15;

type JsonMap = Record<string, unknown>;

interface EntityRow {
  parser_id: string | null;
  raw_data: JsonMap | null;
  enriched_at: string | null;
  dns_status: string | null;
  is_garbage: boolean | null;
  is_hidden: boolean | null;
  last_quality_at: string | null;
  crypto_status: string | null;
}

interface ParsedSignals {
  targetRegions: string[];
  targetAudience: string[];
  fiatOnRamp: boolean | null;
  appPlatforms: string[];
  tradingPairs: number | null;
  yearsOnMarket: number | null;
  foundedYear: number | null;
  summary: string | null;
  confidence: Record<string, number>;
}

interface EntityScore {
  coverage: number;
  confidence: number;
  freshness: number;
  consistency: number;
  pus: number;
  missingFields: string[];
}

interface ParserReportRow {
  parserId: string;
  sampleSize: number;
  medianPus: number;
  p25Pus: number;
  parserPus: number;
  nullRate: number;
  fieldNullRate: Record<string, number>;
}

function parseArgs(): { json: boolean; top: number; minSample: number; cryptoOnly: boolean; includeNotEnriched: boolean } {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const cryptoOnly = args.includes('--crypto-only');
  const includeNotEnriched = args.includes('--include-not-enriched');

  const topIdx = args.indexOf('--top');
  const top = topIdx !== -1 ? Number.parseInt(args[topIdx + 1] ?? `${DEFAULT_TOP}`, 10) : DEFAULT_TOP;

  const minIdx = args.indexOf('--min-sample');
  const minSample = minIdx !== -1 ? Number.parseInt(args[minIdx + 1] ?? `${DEFAULT_MIN_SAMPLE}`, 10) : DEFAULT_MIN_SAMPLE;

  return {
    json,
    top: Number.isFinite(top) && top > 0 ? top : DEFAULT_TOP,
    minSample: Number.isFinite(minSample) && minSample > 0 ? minSample : DEFAULT_MIN_SAMPLE,
    cryptoOnly,
    includeNotEnriched,
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === 'string' ? x.trim() : '')).filter((x) => x.length > 0);
}

function asNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number.parseFloat(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function asBool(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    if (v === 'true') return true;
    if (v === 'false') return false;
  }
  return null;
}

function asString(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * p;
  const low = Math.floor(idx);
  const high = Math.ceil(idx);
  if (low === high) return sorted[low];
  const w = idx - low;
  return sorted[low] * (1 - w) + sorted[high] * w;
}

function getFieldConfidence(rawData: JsonMap, key: string): number {
  const fc = rawData.field_confidence;
  if (!fc || typeof fc !== 'object') return 0;
  const value = (fc as Record<string, unknown>)[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return clamp(value, 0, 1);
}

function parseSignals(rawData: JsonMap | null): ParsedSignals {
  const rd = rawData ?? {};
  return {
    targetRegions: asStringArray(rd.target_regions),
    targetAudience: asStringArray(rd.target_audience),
    fiatOnRamp: asBool(rd.fiat_onramp),
    appPlatforms: asStringArray(rd.app_platforms),
    tradingPairs: asNumber(rd.trading_pairs),
    yearsOnMarket: asNumber(rd.years_on_market),
    foundedYear: asNumber(rd.founded_year),
    summary: asString(rd.site_business_summary_en),
    confidence: {
      target_regions: getFieldConfidence(rd, 'target_regions'),
      target_audience: getFieldConfidence(rd, 'target_audience'),
      fiat_onramp: getFieldConfidence(rd, 'fiat_onramp'),
      app_platforms: getFieldConfidence(rd, 'app_platforms'),
      trading_pairs: getFieldConfidence(rd, 'trading_pairs'),
      years_on_market: getFieldConfidence(rd, 'years_on_market'),
    },
  };
}

function hasAnyEnrichment(row: EntityRow): boolean {
  if (row.enriched_at) return true;
  const rd = row.raw_data ?? {};
  const summary = asString(rd.site_business_summary_en);
  const fallbackDesc = asString(rd.enrichment_description);
  const hasSignals =
    asStringArray(rd.target_regions).length > 0 ||
    asStringArray(rd.target_audience).length > 0 ||
    asBool(rd.fiat_onramp) !== null ||
    asStringArray(rd.app_platforms).length > 0 ||
    asNumber(rd.trading_pairs) !== null ||
    asNumber(rd.years_on_market) !== null;
  return !!summary || !!fallbackDesc || hasSignals;
}

function computeFreshness(enrichedAt: string | null, dnsStatus: string | null): number {
  if (!enrichedAt) return 0;
  const ts = Date.parse(enrichedAt);
  if (!Number.isFinite(ts)) return 0;
  const ageDays = (Date.now() - ts) / (1000 * 60 * 60 * 24);
  let freshness = ageDays <= 30 ? 100 : ageDays <= 90 ? 70 : ageDays <= 180 ? 40 : 20;
  if (dnsStatus === 'dead') freshness = Math.min(freshness, 30);
  return freshness;
}

function computeConsistency(signals: ParsedSignals): number {
  let consistency = 100;
  const hasUnknownAudience = signals.targetAudience.includes('unknown');
  if (hasUnknownAudience && signals.targetAudience.length > 1) consistency -= 15;
  if (signals.tradingPairs !== null && signals.tradingPairs < 2) consistency -= 20;
  if (signals.yearsOnMarket !== null && signals.yearsOnMarket < 0) consistency -= 40;
  if (signals.foundedYear !== null && signals.yearsOnMarket !== null) {
    const expected = new Date().getFullYear() - signals.foundedYear;
    if (Math.abs(expected - signals.yearsOnMarket) > 2) consistency -= 20;
  }
  return clamp(consistency, 0, 100);
}

function computeEntityScore(signals: ParsedSignals, enrichedAt: string | null, dnsStatus: string | null): EntityScore {
  const mandatoryFields = [
    'target_regions',
    'target_audience',
    'fiat_onramp',
    'app_platforms',
    'trading_pairs',
    'years_on_market',
    'site_business_summary_en',
  ];

  const missing: string[] = [];
  if (signals.targetRegions.length === 0) missing.push('target_regions');
  if (signals.targetAudience.length === 0 || (signals.targetAudience.length === 1 && signals.targetAudience[0] === 'unknown')) {
    missing.push('target_audience');
  }
  if (signals.fiatOnRamp === null) missing.push('fiat_onramp');
  if (signals.appPlatforms.length === 0) missing.push('app_platforms');
  if (signals.tradingPairs === null) missing.push('trading_pairs');
  if (signals.yearsOnMarket === null) missing.push('years_on_market');
  if (!signals.summary || signals.summary.length < 60) missing.push('site_business_summary_en');

  const coverage = ((mandatoryFields.length - missing.length) / mandatoryFields.length) * 100;

  const confidenceValues = [
    signals.confidence.target_regions,
    signals.confidence.target_audience,
    signals.confidence.fiat_onramp,
    signals.confidence.app_platforms,
    signals.confidence.trading_pairs,
    signals.confidence.years_on_market,
  ];
  const confidence = (confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length) * 100;

  const freshness = computeFreshness(enrichedAt, dnsStatus);
  const consistency = computeConsistency(signals);
  const pus = coverage * 0.4 + confidence * 0.3 + freshness * 0.15 + consistency * 0.15;

  return {
    coverage: Math.round(coverage * 10) / 10,
    confidence: Math.round(confidence * 10) / 10,
    freshness: Math.round(freshness * 10) / 10,
    consistency: Math.round(consistency * 10) / 10,
    pus: Math.round(pus * 10) / 10,
    missingFields: missing,
  };
}

async function fetchRows(cryptoOnly: boolean): Promise<EntityRow[]> {
  const sb = getSupabase();
  const rows: EntityRow[] = [];
  const page = 1000;
  let from = 0;
  let done = false;

  while (!done) {
    let query = sb
      .from('entities')
      .select('parser_id,raw_data,enriched_at,dns_status,is_garbage,is_hidden,last_quality_at,crypto_status')
      .not('parser_id', 'is', null)
      .neq('is_garbage', true)
      .neq('is_hidden', true)
      .not('last_quality_at', 'is', null)
      .range(from, from + page - 1);

    if (cryptoOnly) {
      query = query.in('crypto_status', ['confirmed_crypto', 'crypto_adjacent']);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch entities: ${error.message}`);
    const chunk = (data ?? []) as EntityRow[];
    rows.push(...chunk);

    if (chunk.length < page) done = true;
    else from += page;
  }

  return rows;
}

function buildReport(rows: EntityRow[], minSample: number): ParserReportRow[] {
  const grouped = new Map<string, EntityScore[]>();
  const nullCounters = new Map<string, Record<string, number>>();

  for (const row of rows) {
    const parserId = row.parser_id ?? 'unknown';
    const signals = parseSignals(row.raw_data);
    const score = computeEntityScore(signals, row.enriched_at, row.dns_status);

    if (!grouped.has(parserId)) grouped.set(parserId, []);
    grouped.get(parserId)!.push(score);

    const mandatory = [
      'target_regions',
      'target_audience',
      'fiat_onramp',
      'app_platforms',
      'trading_pairs',
      'years_on_market',
      'site_business_summary_en',
    ];
    if (!nullCounters.has(parserId)) {
      nullCounters.set(parserId, Object.fromEntries(mandatory.map((k) => [k, 0])));
    }
    const c = nullCounters.get(parserId)!;
    for (const f of score.missingFields) c[f] = (c[f] ?? 0) + 1;
  }

  const result: ParserReportRow[] = [];
  for (const [parserId, scores] of grouped.entries()) {
    if (scores.length < minSample) continue;
    const pusValues = scores.map((s) => s.pus);
    const medianPus = percentile(pusValues, 0.5);
    const p25Pus = percentile(pusValues, 0.25);
    const parserPus = medianPus + p25Pus * 0.3;

    const missingCounts = nullCounters.get(parserId)!;
    const mandatoryCount = 7;
    const totalSlots = scores.length * mandatoryCount;
    const missingTotal = Object.values(missingCounts).reduce((a, b) => a + b, 0);
    const nullRate = totalSlots > 0 ? (missingTotal / totalSlots) * 100 : 0;

    const fieldNullRate: Record<string, number> = {};
    for (const [k, v] of Object.entries(missingCounts)) {
      fieldNullRate[k] = scores.length > 0 ? (v / scores.length) * 100 : 0;
    }

    result.push({
      parserId,
      sampleSize: scores.length,
      medianPus: Math.round(medianPus * 10) / 10,
      p25Pus: Math.round(p25Pus * 10) / 10,
      parserPus: Math.round(parserPus * 10) / 10,
      nullRate: Math.round(nullRate * 10) / 10,
      fieldNullRate: Object.fromEntries(
        Object.entries(fieldNullRate).map(([k, v]) => [k, Math.round(v * 10) / 10]),
      ),
    });
  }

  return result.sort((a, b) => b.parserPus - a.parserPus);
}

function printReport(rows: ParserReportRow[], top: number, scanned: number, cryptoOnly: boolean, minSample: number) {
  const shown = rows.slice(0, top);
  const pad = (s: string, n: number) => s.slice(0, n).padEnd(n);

  console.log('\n' + '═'.repeat(100));
  console.log('  PARSER USEFULNESS REPORT (PUS)');
  console.log(`  ${new Date().toISOString()} | scanned=${scanned} | parsers=${rows.length} | cryptoOnly=${cryptoOnly} | minSample=${minSample}`);
  console.log('═'.repeat(100));
  console.log(`\n  Showing top ${shown.length} parsers by Parser PUS\n`);
  console.log(`  ${pad('Parser', 28)} ${pad('Sample', 8)} ${pad('Median', 8)} ${pad('P25', 8)} ${pad('ParserPUS', 10)} ${pad('NullRate', 9)}`);
  console.log('  ' + '-'.repeat(85));
  for (const r of shown) {
    console.log(
      `  ${pad(r.parserId, 28)} ${pad(String(r.sampleSize), 8)} ${pad(r.medianPus.toFixed(1), 8)} ${pad(r.p25Pus.toFixed(1), 8)} ${pad(r.parserPus.toFixed(1), 10)} ${pad(`${r.nullRate.toFixed(1)}%`, 9)}`,
    );
  }

  if (shown.length > 0) {
    const best = shown[0];
    console.log('\n  Top parser field null-rate breakdown:');
    for (const [k, v] of Object.entries(best.fieldNullRate)) {
      console.log(`  - ${k}: ${v.toFixed(1)}%`);
    }
  }

  console.log('\n' + '═'.repeat(100) + '\n');
}

async function main() {
  const { json, top, minSample, cryptoOnly, includeNotEnriched } = parseArgs();
  const rows = await fetchRows(cryptoOnly);
  const scopedRows = includeNotEnriched ? rows : rows.filter(hasAnyEnrichment);
  const skippedNotEnriched = rows.length - scopedRows.length;
  const report = buildReport(scopedRows, minSample);

  if (json) {
    console.log(JSON.stringify({
      scanned: scopedRows.length,
      skippedNotEnriched,
      parserCount: report.length,
      cryptoOnly,
      includeNotEnriched,
      minSample,
      top,
      rows: report.slice(0, top),
    }, null, 2));
    return;
  }

  printReport(report, top, scopedRows.length, cryptoOnly, minSample);
  if (!includeNotEnriched) {
    console.log(`Skipped not enriched rows: ${skippedNotEnriched.toLocaleString()} (use --include-not-enriched to include all)`);
  }
}

main().catch((err) => {
  console.error('Error generating parser usefulness report:', err instanceof Error ? err.message : err);
  process.exit(1);
});

