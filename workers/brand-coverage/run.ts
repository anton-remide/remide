/**
 * Brand Coverage Worker — links well-known crypto brands to legal entities.
 *
 * Fetches top exchanges/brands from CoinGecko, then matches them against
 * existing entities by: (1) domain match, (2) brand_name match, (3) name
 * similarity. Creates brand_alias rows for each link found.
 *
 * Usage:
 *   npx tsx workers/brand-coverage/run.ts                    # Full run
 *   npx tsx workers/brand-coverage/run.ts --limit 50         # Top N exchanges
 *   npx tsx workers/brand-coverage/run.ts --dry-run          # No DB writes
 *   npx tsx workers/brand-coverage/run.ts --source coingecko # Source filter
 *
 * Env vars (loaded via shared/config.ts):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { config } from '../../shared/config.js';
import { getSupabase } from '../../shared/supabase.js';
import { logger, sendTelegramAlert } from '../../shared/logger.js';
import { acquireLock, releaseLock, setRuntimeTimeout } from '../../shared/guards.js';

const SCOPE = 'brand-coverage';
const DEFAULT_LIMIT = 200;
const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const RATE_LIMIT_MS = 2_500;

/* ── Types ── */

interface CoinGeckoExchange {
  id: string;
  name: string;
  url: string;
  country: string | null;
  trust_score: number | null;
  trust_score_rank: number | null;
}

interface BrandEntry {
  slug: string;
  displayName: string;
  website: string | null;
  domain: string | null;
  category: string;
  source: string;
  sourceRank: number;
  country: string | null;
}

interface EntityMatch {
  entityId: string;
  entityName: string;
  legalName: string;
  countryCode: string;
  confidence: number;
  aliasType: string;
  website: string | null;
}

interface MatchResult {
  brand: BrandEntry;
  matches: EntityMatch[];
  matchStatus: 'matched' | 'partial' | 'unmatched';
  gapReason: string | null;
}

interface RunStats {
  brandsTotal: number;
  brandsMatched: number;
  brandsPartial: number;
  brandsUnmatched: number;
  aliasesCreated: number;
  aliasesSkipped: number;
  coverageRate: number;
  errors: number;
}

/* ── CLI Args ── */

interface Args {
  limit: number;
  dryRun: boolean;
  source: string;
  minConfidence: number;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  let limit = DEFAULT_LIMIT;
  let dryRun = config.flags.dryRun;
  let source = 'coingecko';
  let minConfidence = 0.3;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) limit = Number(args[++i]);
    if (args[i] === '--dry-run') dryRun = true;
    if (args[i] === '--source' && args[i + 1]) source = args[++i];
    if (args[i] === '--min-confidence' && args[i + 1]) minConfidence = Number(args[++i]);
  }

  return { limit, dryRun, source, minConfidence };
}

/* ── CoinGecko Fetcher ── */

async function fetchCoinGeckoExchanges(limit: number): Promise<BrandEntry[]> {
  const brands: BrandEntry[] = [];
  const perPage = Math.min(limit, 100);
  const pages = Math.ceil(limit / perPage);

  for (let page = 1; page <= pages; page++) {
    const url = `${COINGECKO_BASE}/exchanges?per_page=${perPage}&page=${page}`;
    logger.info(SCOPE, `Fetching CoinGecko exchanges page ${page}/${pages}...`);

    const res = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'RemiDe-BrandCoverage/1.0' },
    });

    if (!res.ok) {
      if (res.status === 429) {
        logger.warn(SCOPE, 'CoinGecko rate limited, waiting 60s...');
        await sleep(60_000);
        page--;
        continue;
      }
      throw new Error(`CoinGecko API error: ${res.status} ${res.statusText}`);
    }

    const exchanges: CoinGeckoExchange[] = await res.json();

    for (const ex of exchanges) {
      if (brands.length >= limit) break;
      const domain = extractDomain(ex.url);
      brands.push({
        slug: ex.id,
        displayName: ex.name,
        website: ex.url || null,
        domain,
        category: 'exchange',
        source: 'coingecko',
        sourceRank: ex.trust_score_rank ?? brands.length + 1,
        country: ex.country || null,
      });
    }

    if (page < pages) await sleep(RATE_LIMIT_MS);
  }

  logger.info(SCOPE, `Fetched ${brands.length} brands from CoinGecko`);
  return brands;
}

/* ── Domain Extraction ── */

function extractDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const hostname = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
    return hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

function domainsMatch(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const da = a.replace(/^www\./, '').toLowerCase();
  const db = b.replace(/^www\./, '').toLowerCase();
  return da === db || da.endsWith(`.${db}`) || db.endsWith(`.${da}`);
}

/* ── Name Similarity ── */

function normalizeForMatch(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function nameSimilarity(a: string, b: string): number {
  const na = normalizeForMatch(a);
  const nb = normalizeForMatch(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1.0;
  if (na.includes(nb) || nb.includes(na)) {
    const ratio = Math.min(na.length, nb.length) / Math.max(na.length, nb.length);
    return ratio > 0.5 ? 0.7 * ratio : 0.3 * ratio;
  }
  return levenshteinSimilarity(na, nb);
}

function levenshteinSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const dist = levenshteinDistance(a, b);
  return 1 - dist / maxLen;
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/* ── Entity Matcher ── */

async function matchBrand(
  brand: BrandEntry,
  sb: ReturnType<typeof getSupabase>,
): Promise<MatchResult> {
  const matches: EntityMatch[] = [];

  // Strategy 1: Domain match (highest confidence)
  if (brand.domain) {
    const { data: domainHits } = await sb
      .from('entities')
      .select('id, name, canonical_name, country_code, website, brand_name')
      .ilike('website', `%${brand.domain}%`)
      .neq('is_garbage', true)
      .neq('is_hidden', true)
      .limit(20);

    if (domainHits) {
      for (const e of domainHits) {
        const entityDomain = extractDomain(e.website);
        if (domainsMatch(brand.domain, entityDomain)) {
          matches.push({
            entityId: e.id,
            entityName: e.canonical_name || e.name,
            legalName: e.name,
            countryCode: e.country_code,
            confidence: 0.95,
            aliasType: 'auto_domain',
            website: e.website,
          });
        }
      }
    }
  }

  // Strategy 2: brand_name column match
  if (brand.displayName) {
    const { data: brandHits } = await sb
      .from('entities')
      .select('id, name, canonical_name, country_code, website, brand_name')
      .ilike('brand_name', `%${brand.displayName}%`)
      .neq('is_garbage', true)
      .neq('is_hidden', true)
      .limit(20);

    if (brandHits) {
      for (const e of brandHits) {
        if (matches.some(m => m.entityId === e.id)) continue;
        const sim = nameSimilarity(brand.displayName, e.brand_name || '');
        if (sim >= 0.6) {
          matches.push({
            entityId: e.id,
            entityName: e.canonical_name || e.name,
            legalName: e.name,
            countryCode: e.country_code,
            confidence: Math.min(0.9, 0.5 + sim * 0.4),
            aliasType: 'auto_brand',
            website: e.website,
          });
        }
      }
    }
  }

  // Strategy 3: Name similarity (canonical_name, name)
  const normalizedBrand = normalizeForMatch(brand.displayName);
  if (normalizedBrand.length >= 3) {
    const { data: nameHits } = await sb
      .from('entities')
      .select('id, name, canonical_name, country_code, website, brand_name')
      .or(`name.ilike.%${brand.displayName}%,canonical_name.ilike.%${brand.displayName}%`)
      .neq('is_garbage', true)
      .neq('is_hidden', true)
      .limit(30);

    if (nameHits) {
      for (const e of nameHits) {
        if (matches.some(m => m.entityId === e.id)) continue;
        const sim = Math.max(
          nameSimilarity(brand.displayName, e.canonical_name || ''),
          nameSimilarity(brand.displayName, e.name),
        );
        if (sim >= 0.5) {
          matches.push({
            entityId: e.id,
            entityName: e.canonical_name || e.name,
            legalName: e.name,
            countryCode: e.country_code,
            confidence: Math.min(0.8, sim * 0.8),
            aliasType: 'auto_name',
            website: e.website,
          });
        }
      }
    }
  }

  // Sort by confidence descending
  matches.sort((a, b) => b.confidence - a.confidence);

  const matchStatus: MatchResult['matchStatus'] =
    matches.length > 0 && matches[0].confidence >= 0.4
      ? 'matched'
      : matches.length > 0
        ? 'partial'
        : 'unmatched';

  let gapReason: string | null = null;
  if (matchStatus === 'unmatched') {
    gapReason = 'no_match_found';
  }

  return { brand, matches, matchStatus, gapReason };
}

/* ── DB Writer ── */

async function writeAliases(
  results: MatchResult[],
  sb: ReturnType<typeof getSupabase>,
  minConfidence: number,
  dryRun: boolean,
): Promise<{ created: number; skipped: number; errors: number }> {
  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const r of results) {
    // Write the brand entry itself (even if unmatched, for tracking)
    const bestMatch = r.matches[0];

    if (!bestMatch || bestMatch.confidence < minConfidence) {
      // Unmatched brand — write a row with no entity link
      if (!dryRun) {
        const { error } = await sb.from('brand_aliases').upsert({
          brand_slug: r.brand.slug,
          display_name: r.brand.displayName,
          entity_id: null,
          legal_name: null,
          alias_type: 'auto',
          confidence: 0,
          country_code: null,
          source: r.brand.source,
          source_rank: r.brand.sourceRank,
          website: r.brand.website,
          category: r.brand.category,
          match_status: 'unmatched',
          gap_reason: r.gapReason,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'brand_slug,entity_id', ignoreDuplicates: false });
        if (error) {
          // Fall back to insert on conflict error
          const { error: insertErr } = await sb.from('brand_aliases').insert({
            brand_slug: r.brand.slug,
            display_name: r.brand.displayName,
            entity_id: null,
            legal_name: null,
            alias_type: 'auto',
            confidence: 0,
            source: r.brand.source,
            source_rank: r.brand.sourceRank,
            website: r.brand.website,
            category: r.brand.category,
            match_status: 'unmatched',
            gap_reason: r.gapReason,
          });
          if (insertErr) { errors++; logger.warn(SCOPE, `Write error for ${r.brand.slug}: ${insertErr.message}`); }
          else created++;
        } else {
          created++;
        }
      }
      skipped++;
      continue;
    }

    // Write matched aliases (all matches above threshold)
    for (const m of r.matches) {
      if (m.confidence < minConfidence) break;

      if (dryRun) {
        skipped++;
        continue;
      }

      const row = {
        brand_slug: r.brand.slug,
        display_name: r.brand.displayName,
        entity_id: m.entityId,
        legal_name: m.legalName,
        alias_type: m.aliasType,
        confidence: Math.round(m.confidence * 100) / 100,
        country_code: m.countryCode,
        source: r.brand.source,
        source_rank: r.brand.sourceRank,
        website: r.brand.website,
        category: r.brand.category,
        match_status: r.matchStatus,
        gap_reason: null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await sb.from('brand_aliases').insert(row);
      if (error) {
        if (error.message?.includes('duplicate') || error.code === '23505') {
          skipped++;
        } else {
          errors++;
          logger.warn(SCOPE, `Write error for ${r.brand.slug} → ${m.entityId}: ${error.message}`);
        }
      } else {
        created++;
      }
    }
  }

  return { created, skipped, errors };
}

/* ── Coverage Report ── */

function printCoverageReport(results: MatchResult[], stats: RunStats) {
  logger.info(SCOPE, '');
  logger.info(SCOPE, '═══════════════════════════════════════════');
  logger.info(SCOPE, '  Brand Coverage Report');
  logger.info(SCOPE, '═══════════════════════════════════════════');
  logger.info(SCOPE, `  Total brands:    ${stats.brandsTotal}`);
  logger.info(SCOPE, `  Matched:         ${stats.brandsMatched} (${pct(stats.brandsMatched, stats.brandsTotal)})`);
  logger.info(SCOPE, `  Partial:         ${stats.brandsPartial} (${pct(stats.brandsPartial, stats.brandsTotal)})`);
  logger.info(SCOPE, `  Unmatched:       ${stats.brandsUnmatched} (${pct(stats.brandsUnmatched, stats.brandsTotal)})`);
  logger.info(SCOPE, `  Aliases created: ${stats.aliasesCreated}`);
  logger.info(SCOPE, `  Coverage rate:   ${stats.coverageRate.toFixed(1)}%`);
  logger.info(SCOPE, '');

  // Top matched brands
  const matched = results.filter(r => r.matchStatus === 'matched').slice(0, 10);
  if (matched.length > 0) {
    logger.info(SCOPE, '  ── Top Matches ──');
    for (const r of matched) {
      const entities = r.matches.slice(0, 3).map(m =>
        `${m.legalName} (${m.countryCode}, ${(m.confidence * 100).toFixed(0)}%)`
      ).join(', ');
      logger.info(SCOPE, `  ✓ ${r.brand.displayName} → ${entities}`);
    }
    logger.info(SCOPE, '');
  }

  // Unmatched brands
  const unmatched = results.filter(r => r.matchStatus === 'unmatched');
  if (unmatched.length > 0) {
    logger.info(SCOPE, '  ── Unmatched Brands ──');
    for (const r of unmatched.slice(0, 20)) {
      logger.info(SCOPE, `  ✗ ${r.brand.displayName} (rank #${r.brand.sourceRank}, ${r.brand.website || 'no website'})`);
    }
    if (unmatched.length > 20) {
      logger.info(SCOPE, `  ... and ${unmatched.length - 20} more`);
    }
    logger.info(SCOPE, '');
  }

  // Partial matches
  const partial = results.filter(r => r.matchStatus === 'partial');
  if (partial.length > 0) {
    logger.info(SCOPE, '  ── Partial Matches (low confidence) ──');
    for (const r of partial.slice(0, 10)) {
      const top = r.matches[0];
      logger.info(SCOPE, `  ~ ${r.brand.displayName} → ${top.legalName} (${(top.confidence * 100).toFixed(0)}%)`);
    }
    logger.info(SCOPE, '');
  }
}

function pct(n: number, total: number): string {
  return total > 0 ? `${((n / total) * 100).toFixed(1)}%` : '0%';
}

/* ── Curated: Stablecoin & Payments Companies ── */

function getStablecoinPaymentsBrands(): BrandEntry[] {
  const list: Array<{ name: string; slug: string; website: string; cat: string }> = [
    // Stablecoin issuers
    { name: 'Circle', slug: 'circle', website: 'https://www.circle.com', cat: 'stablecoin_issuer' },
    { name: 'Tether', slug: 'tether', website: 'https://tether.to', cat: 'stablecoin_issuer' },
    { name: 'Paxos', slug: 'paxos', website: 'https://paxos.com', cat: 'stablecoin_issuer' },
    { name: 'Monerium', slug: 'monerium', website: 'https://monerium.com', cat: 'stablecoin_issuer' },
    { name: 'Stasis', slug: 'stasis', website: 'https://stasis.net', cat: 'stablecoin_issuer' },
    { name: 'Brale', slug: 'brale', website: 'https://brale.xyz', cat: 'stablecoin_issuer' },
    { name: 'Ripple', slug: 'ripple', website: 'https://ripple.com', cat: 'stablecoin_issuer' },
    { name: 'PayPal USD', slug: 'paypal-usd', website: 'https://www.paypal.com', cat: 'stablecoin_issuer' },
    { name: 'Agora', slug: 'agora', website: 'https://www.agora.finance', cat: 'stablecoin_issuer' },
    { name: 'First Digital', slug: 'first-digital', website: 'https://firstdigitallabs.com', cat: 'stablecoin_issuer' },

    // Fiat on-ramp / off-ramp (stablecoin-native)
    { name: 'MoonPay', slug: 'moonpay', website: 'https://www.moonpay.com', cat: 'onramp' },
    { name: 'Transak', slug: 'transak', website: 'https://transak.com', cat: 'onramp' },
    { name: 'Banxa', slug: 'banxa', website: 'https://banxa.com', cat: 'onramp' },
    { name: 'Simplex', slug: 'simplex', website: 'https://www.simplex.com', cat: 'onramp' },
    { name: 'Alchemy Pay', slug: 'alchemy-pay', website: 'https://alchemypay.org', cat: 'onramp' },
    { name: 'Mercuryo', slug: 'mercuryo', website: 'https://mercuryo.io', cat: 'onramp' },
    { name: 'Sardine', slug: 'sardine', website: 'https://www.sardine.ai', cat: 'onramp' },
    { name: 'Onramper', slug: 'onramper', website: 'https://onramper.com', cat: 'onramp' },
    { name: 'Guardarian', slug: 'guardarian', website: 'https://guardarian.com', cat: 'onramp' },
    { name: 'Paybis', slug: 'paybis', website: 'https://paybis.com', cat: 'onramp' },
    { name: 'Wert', slug: 'wert', website: 'https://wert.io', cat: 'onramp' },
    { name: 'Topper', slug: 'topper', website: 'https://topper.dev', cat: 'onramp' },
    { name: 'Utorg', slug: 'utorg', website: 'https://utorg.pro', cat: 'onramp' },

    // Stablecoin infrastructure / B2B stablecoin payments
    { name: 'Bridge', slug: 'bridge', website: 'https://www.bridge.xyz', cat: 'stablecoin_infra' },
    { name: 'Zero Hash', slug: 'zero-hash', website: 'https://zerohash.com', cat: 'stablecoin_infra' },
    { name: 'Fireblocks', slug: 'fireblocks', website: 'https://www.fireblocks.com', cat: 'stablecoin_infra' },
    { name: 'BitGo', slug: 'bitgo', website: 'https://www.bitgo.com', cat: 'stablecoin_infra' },
    { name: 'Anchorage Digital', slug: 'anchorage', website: 'https://www.anchorage.com', cat: 'stablecoin_infra' },
    { name: 'Copper', slug: 'copper', website: 'https://copper.co', cat: 'stablecoin_infra' },
    { name: 'Cobo', slug: 'cobo', website: 'https://www.cobo.com', cat: 'stablecoin_infra' },

    // Stablecoin payment processors
    { name: 'BitPay', slug: 'bitpay', website: 'https://bitpay.com', cat: 'stablecoin_processor' },
    { name: 'CoinGate', slug: 'coingate', website: 'https://coingate.com', cat: 'stablecoin_processor' },
    { name: 'NOWPayments', slug: 'nowpayments', website: 'https://nowpayments.io', cat: 'stablecoin_processor' },
    { name: 'TripleA', slug: 'triplea', website: 'https://triple-a.io', cat: 'stablecoin_processor' },
    { name: 'CoinsPaid', slug: 'coinspaid', website: 'https://coinspaid.com', cat: 'stablecoin_processor' },
    { name: 'Slash', slug: 'slash', website: 'https://slash.fi', cat: 'stablecoin_processor' },
    { name: 'Request Finance', slug: 'request-finance', website: 'https://www.request.finance', cat: 'stablecoin_processor' },

    // PYUSD / stablecoin via subsidiaries at TradFi
    { name: 'PayPal', slug: 'paypal-pyusd', website: 'https://www.paypal.com', cat: 'tradfi_stablecoin' },
    { name: 'Revolut', slug: 'revolut', website: 'https://www.revolut.com', cat: 'tradfi_stablecoin' },
    { name: 'Robinhood', slug: 'robinhood', website: 'https://robinhood.com', cat: 'tradfi_stablecoin' },
  ];

  return list.map((item, i) => ({
    slug: item.slug,
    displayName: item.name,
    website: item.website,
    domain: extractDomain(item.website),
    category: item.cat,
    source: 'stablecoin-payments',
    sourceRank: i + 1,
    country: null,
  }));
}

/* ── Helpers ── */

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/* ── Main ── */

async function main() {
  const args = parseArgs();
  const sb = getSupabase();

  logger.info(SCOPE, '═══════════════════════════════════════════');
  logger.info(SCOPE, '  Brand Coverage Worker');
  logger.info(SCOPE, '═══════════════════════════════════════════');
  logger.info(SCOPE, `Config: source=${args.source}, limit=${args.limit}, minConfidence=${args.minConfidence}, dryRun=${args.dryRun}`);

  // Ensure brand_aliases table exists (graceful check)
  const { error: tableCheck } = await sb.from('brand_aliases').select('id').limit(1);
  if (tableCheck?.message?.includes('does not exist') || tableCheck?.code === '42P01') {
    logger.error(SCOPE, 'Table brand_aliases does not exist. Run scripts/011_brand_aliases.sql first.');
    process.exit(1);
  }

  // Step 1: Fetch brands from source
  let brands: BrandEntry[] = [];
  if (args.source === 'coingecko') {
    brands = await fetchCoinGeckoExchanges(args.limit);
  } else if (args.source === 'stablecoin-payments') {
    brands = getStablecoinPaymentsBrands().slice(0, args.limit);
    logger.info(SCOPE, `Loaded ${brands.length} stablecoin/payments brands from curated list`);
  } else if (args.source === 'all') {
    const cg = await fetchCoinGeckoExchanges(Math.min(args.limit, 100));
    const sp = getStablecoinPaymentsBrands();
    brands = [...cg, ...sp];
    logger.info(SCOPE, `Combined: ${cg.length} exchanges + ${sp.length} stablecoin/payments = ${brands.length} brands`);
  } else {
    logger.error(SCOPE, `Unknown source: ${args.source}. Use: coingecko, stablecoin-payments, all`);
    process.exit(1);
  }

  // Step 2: Clear old auto-matched aliases for this source (fresh run)
  if (!args.dryRun) {
    const { error: delErr } = await sb
      .from('brand_aliases')
      .delete()
      .eq('source', args.source)
      .in('alias_type', ['auto_domain', 'auto_name', 'auto_brand', 'auto']);
    if (delErr) logger.warn(SCOPE, `Could not clear old aliases: ${delErr.message}`);
    else logger.info(SCOPE, 'Cleared old auto-matched aliases');
  }

  // Step 3: Match each brand against entities
  logger.info(SCOPE, `Matching ${brands.length} brands against entity database...`);
  const results: MatchResult[] = [];

  for (let i = 0; i < brands.length; i++) {
    const brand = brands[i];
    try {
      const result = await matchBrand(brand, sb);
      results.push(result);

      if ((i + 1) % 25 === 0) {
        const matched = results.filter(r => r.matchStatus === 'matched').length;
        logger.info(SCOPE, `  Progress: ${i + 1}/${brands.length} brands, ${matched} matched`);
      }
    } catch (err) {
      logger.warn(SCOPE, `Error matching ${brand.displayName}: ${err instanceof Error ? err.message : err}`);
      results.push({
        brand,
        matches: [],
        matchStatus: 'unmatched',
        gapReason: `error: ${err instanceof Error ? err.message : 'unknown'}`,
      });
    }

    if (i < brands.length - 1) await sleep(100);
  }

  // Step 4: Write aliases
  const { created, skipped, errors } = await writeAliases(results, sb, args.minConfidence, args.dryRun);

  // Step 5: Report
  const matched = results.filter(r => r.matchStatus === 'matched').length;
  const partial = results.filter(r => r.matchStatus === 'partial').length;
  const unmatched = results.filter(r => r.matchStatus === 'unmatched').length;

  const stats: RunStats = {
    brandsTotal: brands.length,
    brandsMatched: matched,
    brandsPartial: partial,
    brandsUnmatched: unmatched,
    aliasesCreated: created,
    aliasesSkipped: skipped,
    coverageRate: brands.length > 0 ? ((matched + partial) / brands.length) * 100 : 0,
    errors,
  };

  printCoverageReport(results, stats);

  // Log to scrape_runs
  await sb.from('scrape_runs').insert({
    parser_id: 'brand-coverage',
    country_code: 'GLOBAL',
    entities_found: brands.length,
    entities_new: created,
    entities_updated: skipped,
    errors: errors,
    metadata: {
      source: args.source,
      coverage_rate: stats.coverageRate,
      matched,
      partial,
      unmatched,
    },
  }).then(({ error }) => {
    if (error) logger.warn(SCOPE, `Failed to log run: ${error.message}`);
  });

  // Telegram summary
  const summary = `Brand Coverage: ${stats.coverageRate.toFixed(0)}% (${matched}/${brands.length} matched, ${unmatched} gaps)`;
  if (stats.coverageRate < 80) {
    await sendTelegramAlert(SCOPE, `⚠️ ${summary}`);
  } else {
    await sendTelegramAlert(SCOPE, `✅ ${summary}`);
  }

  return stats;
}

// Entry point
const lockFile = acquireLock(SCOPE);
const clearTimeout = setRuntimeTimeout(SCOPE);

main()
  .then((stats) => {
    logger.info(SCOPE, `Done. Coverage: ${stats.coverageRate.toFixed(1)}%`);
    process.exit(0);
  })
  .catch(async (err) => {
    logger.error(SCOPE, `Fatal: ${err.message}`);
    await sendTelegramAlert(SCOPE, `Fatal error: ${err.message}`);
    process.exit(1);
  })
  .finally(() => {
    releaseLock(lockFile);
    clearTimeout();
  });
