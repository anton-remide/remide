/**
 * Retro normalize enrichment fields without re-scraping.
 *
 * Fills missing structured business fields from existing description/summary:
 * - target_regions
 * - target_audience
 * - fiat_onramp
 * - app_platforms
 * - years_on_market / founded_year
 * - field_confidence
 *
 * Also normalizes website URL formatting in-place.
 *
 * Usage:
 *   npx tsx scripts/retro-normalize-enrichment.ts
 *   npx tsx scripts/retro-normalize-enrichment.ts --crypto-only --limit 500
 *   npx tsx scripts/retro-normalize-enrichment.ts --parsers=esma-it,esma-fr --aggressive-website-cleanup
 *   npx tsx scripts/retro-normalize-enrichment.ts --batch-size 1000 --aggressive-website-cleanup
 *   npx tsx scripts/retro-normalize-enrichment.ts --dry-run
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { getSupabase } from '../shared/supabase.js';

interface Args {
  limit: number | null;
  batchSize: number;
  cryptoOnly: boolean;
  dryRun: boolean;
  aggressiveWebsiteCleanup: boolean;
  parsers: string[];
}

interface EntityRow {
  id: string;
  name: string;
  parser_id: string | null;
  country_code: string | null;
  website: string | null;
  description: string | null;
  raw_data: Record<string, unknown> | null;
  crypto_status: string | null;
  is_garbage: boolean | null;
  is_hidden: boolean | null;
  last_quality_at: string | null;
}

interface Inferred<T> {
  value: T;
  confidence: number;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const limitIdx = args.indexOf('--limit');
  const parsedLimit = limitIdx !== -1 ? Number.parseInt(args[limitIdx + 1] ?? '0', 10) : 0;
  const batchIdx = args.indexOf('--batch-size');
  const parsedBatch = batchIdx !== -1 ? Number.parseInt(args[batchIdx + 1] ?? '1000', 10) : 1000;
  const parsersArg = args.find((a) => a.startsWith('--parsers=')) ?? '';
  const parsers = parsersArg
    ? parsersArg.replace('--parsers=', '').split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  return {
    limit: Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : null,
    batchSize: Number.isFinite(parsedBatch) && parsedBatch > 0 ? parsedBatch : 1000,
    cryptoOnly: args.includes('--crypto-only'),
    dryRun: args.includes('--dry-run'),
    aggressiveWebsiteCleanup: args.includes('--aggressive-website-cleanup'),
    parsers,
  };
}

function normalizeUrl(url: string): string {
  let u = url.trim();
  if (u.includes('|')) u = u.split(/\s*\|\s*/)[0].trim();
  u = u.replace(/^ttps:\/\//i, 'https://');
  u = u.replace(/^https?:\/\/https?\.\/?\/*/i, 'https://');
  if (!u.startsWith('http://') && !u.startsWith('https://')) u = `https://${u}`;
  return u.replace(/\/+$/, '');
}

function websiteCleanupDecision(rawWebsite: string, aggressive: boolean): { normalized: string; invalidReason: string | null } {
  const normalized = normalizeUrl(rawWebsite);
  if (!aggressive) return { normalized, invalidReason: null };

  const w = normalized.trim();
  const lower = w.toLowerCase();

  // Common parser artifacts: postal addresses / free text instead of URL
  const looksLikeAddress = /\b\d{4,6}\s+[a-z]/i.test(w) && !w.includes('.');
  const hasWhitespace = /\s/.test(w);
  if (looksLikeAddress || hasWhitespace) {
    return { normalized, invalidReason: 'address_or_whitespace_instead_of_url' };
  }

  try {
    const host = new URL(w).hostname.toLowerCase();
    const blockedHostFragments = ['cyberirfy', 'paycraft', 'gigtaskr', 'blockbyteq'];
    const blockedTlds = ['.icu', '.top'];
    if (blockedHostFragments.some((x) => host.includes(x)) || blockedTlds.some((tld) => host.endsWith(tld))) {
      return { normalized, invalidReason: 'blocked_suspicious_domain' };
    }
  } catch {
    return { normalized, invalidReason: 'invalid_url_parse' };
  }

  return { normalized, invalidReason: null };
}

function inferRegionFromCountryCode(countryCode: string | null): string | null {
  if (!countryCode) return null;
  const cc = countryCode.toUpperCase();
  const apac = new Set(['ID', 'SG', 'MY', 'TH', 'PH', 'JP', 'KR', 'AU', 'NZ']);
  const eu = new Set(['DE', 'FR', 'NL', 'IT', 'ES', 'AT', 'IE', 'LT', 'LV', 'MT', 'CY', 'SK', 'SI', 'LU', 'FI', 'SE', 'DK']);
  if (apac.has(cc)) return 'APAC';
  if (eu.has(cc)) return 'EU';
  if (cc === 'US') return 'US';
  if (cc === 'GB' || cc === 'UK') return 'UK';
  return cc;
}

function inferTargetAudience(text: string): Inferred<string[]> {
  const t = text.toLowerCase();
  const consumerHits = [
    'retail', 'personal', 'individual', 'beginner', 'app store', 'google play', 'for everyone', 'pengguna', 'nasabah',
  ].filter((k) => t.includes(k)).length;
  const businessHits = [
    'institutional', 'enterprise', 'api', 'merchant', 'otc desk', 'b2b', 'prime brokerage', 'business account', 'corporate', 'mitra bisnis',
  ].filter((k) => t.includes(k)).length;
  const out: string[] = [];
  if (consumerHits > 0) out.push('consumer');
  if (businessHits > 0) out.push('business');
  if (out.length === 0) out.push('unknown');
  const totalHits = consumerHits + businessHits;
  const confidence = totalHits >= 2 ? 1 : totalHits === 1 ? 0.6 : 0.2;
  return { value: out, confidence };
}

function inferTargetRegions(text: string, website: string): Inferred<string[]> {
  const t = text.toLowerCase();
  const regions: string[] = [];
  if (/global|worldwide|international/.test(t)) regions.push('global');
  if (/united states|usa|us users/.test(t)) regions.push('US');
  if (/europe|eu|eea/.test(t)) regions.push('EU');
  if (/united kingdom|uk/.test(t)) regions.push('UK');
  if (/indonesia|indonesian|idr|rupiah/.test(t)) regions.push('ID');
  if (/singapore|malaysia|thailand|philippines|asia|apac/.test(t)) regions.push('APAC');
  if (/uae|middle east|mena/.test(t)) regions.push('MENA');

  let confidence = 0;
  if (regions.length >= 2) confidence = 0.9;
  else if (regions.length === 1) confidence = 0.6;

  try {
    const host = new URL(website).hostname.toLowerCase();
    if (host.endsWith('.id') || host.includes('.co.id')) {
      if (!regions.includes('ID')) regions.push('ID');
      if (!regions.includes('APAC')) regions.push('APAC');
      confidence = Math.max(confidence, 0.6);
    }
  } catch {
    // ignore
  }

  return { value: Array.from(new Set(regions)).slice(0, 4), confidence };
}

function inferFiatOnRamp(text: string): Inferred<boolean | null> {
  const t = text.toLowerCase();
  const positive = [
    'fiat', 'bank transfer', 'credit card', 'debit card', 'visa', 'mastercard',
    'buy crypto with', 'idr', 'rupiah', 'sepa', 'swift', 'wire transfer', 'e-wallet',
  ].some((k) => t.includes(k));
  const negative = ['crypto only', 'only crypto deposits', 'no fiat'].some((k) => t.includes(k));

  if (positive && !negative) {
    const explicit = ['bank transfer', 'credit card', 'debit card', 'visa', 'mastercard', 'sepa', 'swift']
      .some((k) => t.includes(k));
    return { value: true, confidence: explicit ? 1 : 0.7 };
  }
  if (negative && !positive) return { value: false, confidence: 0.8 };
  if (positive && negative) return { value: null, confidence: 0.2 };
  return { value: null, confidence: 0 };
}

function inferAppPlatforms(text: string): Inferred<string[]> {
  const t = text.toLowerCase();
  const platforms: string[] = ['web'];
  let confidence = 0.4;
  if (t.includes('app store') || t.includes('google play') || t.includes('android') || t.includes('ios')) {
    platforms.push('mobile');
    confidence = Math.max(confidence, 0.8);
  }
  if (t.includes('windows') || t.includes('macos') || t.includes('desktop app')) {
    platforms.push('desktop');
    confidence = Math.max(confidence, 0.8);
  }
  return { value: Array.from(new Set(platforms)), confidence };
}

function inferFoundedYear(text: string): Inferred<number | null> {
  const now = new Date().getFullYear();
  const matches = [...text.matchAll(/\b(20[0-2]\d|19[8-9]\d)\b/g)].map((m) => Number.parseInt(m[1], 10));
  const plausible = matches.filter((y) => y >= 2008 && y <= now);
  if (plausible.length === 0) return { value: null, confidence: 0 };
  return { value: Math.min(...plausible), confidence: plausible.length > 1 ? 0.8 : 0.6 };
}

function asString(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean);
}

async function main() {
  const { limit, batchSize, cryptoOnly, dryRun, aggressiveWebsiteCleanup, parsers } = parseArgs();
  const sb = getSupabase();

  let changed = 0;
  let scanned = 0;
  let websiteFixed = 0;
  let websiteInvalidated = 0;
  let fieldsFilled = 0;
  let updateErrors = 0;
  let pages = 0;
  let offset = 0;
  let done = false;

  while (!done) {
    let query = sb
      .from('entities')
      .select('id,name,parser_id,country_code,website,description,raw_data,crypto_status,is_garbage,is_hidden,last_quality_at')
      .neq('is_garbage', true)
      .neq('is_hidden', true)
      .not('last_quality_at', 'is', null)
      .order('updated_at', { ascending: false })
      .range(offset, offset + batchSize - 1);

    if (cryptoOnly) {
      query = query.in('crypto_status', ['confirmed_crypto', 'crypto_adjacent']);
    }
    if (parsers.length > 0) {
      query = query.in('parser_id', parsers);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch entities: ${error.message}`);
    const rows = (data ?? []) as EntityRow[];
    if (rows.length === 0) break;

    pages++;
    scanned += rows.length;

    for (const row of rows) {
      if (limit !== null && scanned > limit) {
        done = true;
        break;
      }
    const rd = (row.raw_data ?? {}) as Record<string, unknown>;
    const summary = asString(rd.site_business_summary_en);
    const description = asString(row.description);
    const sourceText = [summary, description].filter(Boolean).join('\n\n');
    if (!sourceText && !row.website) continue;

    const updates: Record<string, unknown> = {};
    const extra: Record<string, unknown> = {};
    let touched = false;

    if (row.website) {
      const decision = websiteCleanupDecision(row.website, aggressiveWebsiteCleanup);
      if (decision.invalidReason) {
        // Keep website as-is (column is NOT NULL), mark for manual/source-level cleanup.
        extra.website_invalid_reason = decision.invalidReason;
        extra.website_needs_review = true;
        websiteInvalidated++;
        touched = true;
      } else if (decision.normalized !== row.website) {
        updates.website = decision.normalized;
        websiteFixed++;
        touched = true;
      }
    }

    const websiteForInference = asString((updates.website ?? row.website)) ?? '';
    const regionsInfer = inferTargetRegions(sourceText, websiteForInference);
    if (regionsInfer.value.length === 0) {
      const fallbackRegion = inferRegionFromCountryCode(row.country_code);
      if (fallbackRegion) {
        regionsInfer.value = [fallbackRegion];
        regionsInfer.confidence = Math.max(regionsInfer.confidence, 0.3);
      }
    }
    const audienceInfer = inferTargetAudience(sourceText);
    const fiatInfer = inferFiatOnRamp(sourceText);
    const platformsInfer = inferAppPlatforms(sourceText);
    const foundedInfer = inferFoundedYear(sourceText);
    const yearsOnMarket = foundedInfer.value ? Math.max(0, new Date().getFullYear() - foundedInfer.value) : null;

    const existingRegions = asStringArray(rd.target_regions);
    const existingAudience = asStringArray(rd.target_audience);
    const existingPlatforms = asStringArray(rd.app_platforms);
    const hasFiat = rd.fiat_onramp !== null && rd.fiat_onramp !== undefined;
    const hasFounded = rd.founded_year !== null && rd.founded_year !== undefined;
    const hasYears = rd.years_on_market !== null && rd.years_on_market !== undefined;

    if (existingRegions.length === 0 && regionsInfer.value.length > 0) {
      extra.target_regions = regionsInfer.value;
      fieldsFilled++;
      touched = true;
    }
    if ((existingAudience.length === 0 || (existingAudience.length === 1 && existingAudience[0] === 'unknown')) && audienceInfer.value.length > 0) {
      extra.target_audience = audienceInfer.value;
      fieldsFilled++;
      touched = true;
    }
    if (!hasFiat && fiatInfer.value !== null) {
      extra.fiat_onramp = fiatInfer.value;
      fieldsFilled++;
      touched = true;
    }
    if (existingPlatforms.length === 0 && platformsInfer.value.length > 0) {
      extra.app_platforms = platformsInfer.value;
      fieldsFilled++;
      touched = true;
    }
    if (!hasFounded && foundedInfer.value !== null) {
      extra.founded_year = foundedInfer.value;
      fieldsFilled++;
      touched = true;
    }
    if (!hasYears && yearsOnMarket !== null) {
      extra.years_on_market = yearsOnMarket;
      fieldsFilled++;
      touched = true;
    }

    const existingConfidence = rd.field_confidence && typeof rd.field_confidence === 'object'
      ? (rd.field_confidence as Record<string, unknown>)
      : {};
    const mergedConfidence: Record<string, number> = {
      ...Object.fromEntries(
        Object.entries(existingConfidence)
          .filter(([, v]) => typeof v === 'number' && Number.isFinite(v))
          .map(([k, v]) => [k, v as number]),
      ),
      target_regions: regionsInfer.confidence,
      target_audience: audienceInfer.confidence,
      fiat_onramp: fiatInfer.confidence,
      app_platforms: platformsInfer.confidence,
      founded_year: foundedInfer.confidence,
      years_on_market: foundedInfer.confidence,
    };
    extra.field_confidence = mergedConfidence;

    const standardMissing: string[] = [];
    const nextRegions = (extra.target_regions as string[] | undefined) ?? existingRegions;
    const nextAudience = (extra.target_audience as string[] | undefined) ?? existingAudience;
    const nextPlatforms = (extra.app_platforms as string[] | undefined) ?? existingPlatforms;
    const nextFiat = extra.fiat_onramp ?? (hasFiat ? rd.fiat_onramp : null);
    const nextYears = extra.years_on_market ?? (hasYears ? rd.years_on_market : null);
    if (!nextRegions || nextRegions.length === 0) standardMissing.push('target_regions');
    if (!nextAudience || nextAudience.length === 0 || (nextAudience.length === 1 && nextAudience[0] === 'unknown')) standardMissing.push('target_audience');
    if (nextFiat === null || nextFiat === undefined) standardMissing.push('fiat_onramp');
    if (!nextPlatforms || nextPlatforms.length === 0) standardMissing.push('app_platforms');
    if (nextYears === null || nextYears === undefined) standardMissing.push('years_on_market');
    if (!summary && !description) standardMissing.push('business_summary');
    extra.standard_missing_fields = standardMissing;
    extra.standard_completeness = Math.round(((6 - standardMissing.length) / 6) * 100);

    if (!touched) continue;
    changed++;
    if (dryRun) continue;

    const nextRawData = { ...rd, ...extra };
    const payload = { ...updates, raw_data: nextRawData };
    const { error: updateError } = await sb.from('entities').update(payload).eq('id', row.id);
    if (updateError) {
      updateErrors++;
      console.warn(`Update failed for ${row.id}: ${updateError.message}`);
    }
  }
    if (rows.length < batchSize) done = true;
    offset += batchSize;
    if (limit !== null && scanned >= limit) done = true;
  }

  console.log(JSON.stringify({
    scanned,
    pages,
    changed,
    websiteFixed,
    websiteInvalidated,
    fieldsFilled,
    updateErrors,
    dryRun,
    cryptoOnly,
    aggressiveWebsiteCleanup,
    parsers,
    limit,
    batchSize,
  }, null, 2));
}

main().catch((err) => {
  console.error('Retro normalization failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});

