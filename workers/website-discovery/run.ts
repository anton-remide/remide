/**
 * Website Discovery Worker — finds websites for entities that lack them.
 *
 * Two-phase approach:
 *   Phase 1: Known brand → domain mapping (instant, no network)
 *   Phase 2: DuckDuckGo HTML search for remaining entities
 *
 * Usage:
 *   npx tsx workers/website-discovery/run.ts                   # All entities without website
 *   npx tsx workers/website-discovery/run.ts --limit 500       # Limit total
 *   npx tsx workers/website-discovery/run.ts --country PL      # Single country
 *   npx tsx workers/website-discovery/run.ts --phase brand     # Only known brand matching
 *   npx tsx workers/website-discovery/run.ts --phase search    # Only DuckDuckGo search
 *   npx tsx workers/website-discovery/run.ts --dry-run         # No DB writes
 */

import { config } from '../../shared/config.js';
import { getSupabase } from '../../shared/supabase.js';
import { logger, sendTelegramAlert } from '../../shared/logger.js';
import { acquireLock, releaseLock, setRuntimeTimeout } from '../../shared/guards.js';
import { isRegistryWebsite } from '../../shared/registry-domains.js';

const SCOPE = 'website-discovery';
const DEFAULT_LIMIT = 50_000;
const BATCH_SIZE = 1_000;
const DOMAIN_CHECK_TIMEOUT_MS = 3_000;
const DOMAIN_PARALLEL = 10;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2_000;
const PAUSE_BETWEEN_BATCHES_MS = 3_000;

/* ── Known Brand → Domain Mapping ── */

const KNOWN_BRANDS: Array<{ patterns: RegExp[]; website: string }> = [
  // Major exchanges
  { patterns: [/\bbinance\b/i], website: 'https://www.binance.com' },
  { patterns: [/\bokx\b/i], website: 'https://www.okx.com' },
  { patterns: [/\bcoinbase\b/i], website: 'https://www.coinbase.com' },
  { patterns: [/\bbybit\b/i], website: 'https://www.bybit.com' },
  { patterns: [/\bkucoin\b/i], website: 'https://www.kucoin.com' },
  { patterns: [/\bbitstamp\b/i], website: 'https://www.bitstamp.net' },
  { patterns: [/\bgemini\b/i, /\bgemini\s+(trust|digital|payments|bermuda|intergalactic)/i], website: 'https://www.gemini.com' },
  { patterns: [/\bhuobi\b/i, /\bhtx\b/i], website: 'https://www.htx.com' },
  { patterns: [/\bbitflyer\b/i], website: 'https://bitflyer.com' },
  { patterns: [/\bkraken\b/i], website: 'https://www.kraken.com' },
  { patterns: [/\bbitget\b/i], website: 'https://www.bitget.com' },
  { patterns: [/\bcoincheck\b/i], website: 'https://coincheck.com' },
  { patterns: [/\bgate\.?io\b/i], website: 'https://www.gate.io' },
  { patterns: [/\bbitfinex\b/i], website: 'https://www.bitfinex.com' },
  { patterns: [/\bpoloniex\b/i], website: 'https://poloniex.com' },
  { patterns: [/\bbitmex\b/i], website: 'https://www.bitmex.com' },
  { patterns: [/\bderibit\b/i], website: 'https://www.deribit.com' },
  { patterns: [/\bcrypto\.com\b/i, /\bforis\s+dax\b/i], website: 'https://crypto.com' },
  { patterns: [/\bupbit\b/i], website: 'https://upbit.com' },
  { patterns: [/\bbithumb\b/i], website: 'https://www.bithumb.com' },
  { patterns: [/\bbitso\b/i], website: 'https://bitso.com' },
  { patterns: [/\bmercado\s*bitcoin\b/i], website: 'https://www.mercadobitcoin.com.br' },
  { patterns: [/\bluno\b/i], website: 'https://www.luno.com' },
  { patterns: [/\bpaxos\b/i], website: 'https://paxos.com' },
  { patterns: [/\bcoinlist\b/i], website: 'https://coinlist.co' },
  { patterns: [/\bbullish\b/i], website: 'https://bullish.com' },
  { patterns: [/\bbackt\b/i], website: 'https://www.bakkt.com' },

  // Stablecoin & payments
  { patterns: [/\bcircle\b/i], website: 'https://www.circle.com' },
  { patterns: [/\btether\b/i], website: 'https://tether.to' },
  { patterns: [/\bripple\b/i], website: 'https://ripple.com' },
  { patterns: [/\bstellar\b/i], website: 'https://stellar.org' },
  { patterns: [/\bmoonpay\b/i], website: 'https://www.moonpay.com' },
  { patterns: [/\btransak\b/i], website: 'https://transak.com' },
  { patterns: [/\bramp\s+network\b/i], website: 'https://ramp.network' },
  { patterns: [/\bsimplex\b/i], website: 'https://www.simplex.com' },
  { patterns: [/\bwyre\b/i], website: 'https://www.sendwyre.com' },
  { patterns: [/\bbitpay\b/i], website: 'https://bitpay.com' },
  { patterns: [/\bfireblocks\b/i], website: 'https://www.fireblocks.com' },
  { patterns: [/\bchainalysis\b/i], website: 'https://www.chainalysis.com' },
  { patterns: [/\belliptic\b/i], website: 'https://www.elliptic.co' },

  // TradFi with crypto/stablecoin arms
  { patterns: [/\bcredit\s+suisse\b/i], website: 'https://www.credit-suisse.com' },
  { patterns: [/\bmorgan\s+stanley\b/i], website: 'https://www.morganstanley.com' },
  { patterns: [/\bgoldman\s+sachs\b/i], website: 'https://www.goldmansachs.com' },
  { patterns: [/\bjp\s*morgan\b/i], website: 'https://www.jpmorgan.com' },
  { patterns: [/\bdeutsche\s+bank\b/i], website: 'https://www.db.com' },
  { patterns: [/\bubs\b/i], website: 'https://www.ubs.com' },
  { patterns: [/\bhsbc\b/i], website: 'https://www.hsbc.com' },
  { patterns: [/\bbarclays\b/i], website: 'https://www.barclays.com' },
  { patterns: [/\bstandard\s+chartered\b/i], website: 'https://www.sc.com' },
  { patterns: [/\bciti\s*(bank|group)?\b/i], website: 'https://www.citigroup.com' },
  { patterns: [/\bisrael\s+discount\s+bank\b/i], website: 'https://www.discountbank.co.il' },

  // Payment / fintech
  { patterns: [/\bdotpay\b/i], website: 'https://www.dotpay.pl' },
  { patterns: [/\bprzelewy24\b/i, /\bp24\b/i], website: 'https://www.przelewy24.pl' },
  { patterns: [/\btpay\b/i], website: 'https://tpay.com' },
  { patterns: [/\bpayu\b/i], website: 'https://www.payu.com' },
  { patterns: [/\bblik\b/i], website: 'https://blik.com' },
  { patterns: [/\bskrill\b/i], website: 'https://www.skrill.com' },
  { patterns: [/\bneteller\b/i], website: 'https://www.neteller.com' },
  { patterns: [/\bpaysafe\b/i], website: 'https://www.paysafe.com' },
  { patterns: [/\bpayoneer\b/i], website: 'https://www.payoneer.com' },
  { patterns: [/\badyen\b/i], website: 'https://www.adyen.com' },
  { patterns: [/\bworldpay\b/i], website: 'https://www.worldpay.com' },
  { patterns: [/\bcheckout\.com\b/i], website: 'https://www.checkout.com' },
  { patterns: [/\bklarna\b/i], website: 'https://www.klarna.com' },
  { patterns: [/\brevolut\b/i], website: 'https://www.revolut.com' },
  { patterns: [/\bmonzo\b/i], website: 'https://monzo.com' },
  { patterns: [/\bstarling\b/i], website: 'https://www.starlingbank.com' },
  { patterns: [/\btransferwire\b|transferwise\b/i], website: 'https://wise.com' },
  { patterns: [/\bkirobo\b/i], website: 'https://www.kirobo.io' },
  { patterns: [/\bdv\s+chain\b/i], website: 'https://www.dvchain.co' },

  // Custodians / infra
  { patterns: [/\banchorage\b/i], website: 'https://www.anchorage.com' },
  { patterns: [/\bcopper\.co\b/i, /\bcopper\s+technologies\b/i], website: 'https://copper.co' },
  { patterns: [/\bbitgo\b/i], website: 'https://www.bitgo.com' },
  { patterns: [/\bledger\s+enterprise\b/i], website: 'https://enterprise.ledger.com' },
  { patterns: [/\bhex\s+trust\b/i], website: 'https://hextrust.com' },
  { patterns: [/\bzodia\b/i], website: 'https://zodia.io' },
];

/* ── Types ── */

interface EntityRow {
  id: string;
  name: string;
  canonical_name: string | null;
  country_code: string;
  regulator: string | null;
  raw_data: Record<string, unknown> | null;
}

interface DiscoveryResult {
  entityId: string;
  website: string | null;
  source: 'brand_match' | 'search' | null;
  searchQuery: string | null;
  validated: boolean;
  error: string | null;
}

interface Args {
  limit: number;
  country: string | null;
  phase: 'all' | 'brand' | 'search';
  dryRun: boolean;
}

/* ── CLI Args ── */

function parseArgs(): Args {
  const args = process.argv.slice(2);
  let limit = DEFAULT_LIMIT;
  let country: string | null = null;
  let phase: 'all' | 'brand' | 'search' = 'all';
  let dryRun = config.flags.dryRun;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) limit = Number(args[++i]);
    if (args[i] === '--country' && args[i + 1]) country = args[++i].toUpperCase();
    if (args[i] === '--phase' && args[i + 1]) phase = args[++i] as any;
    if (args[i] === '--dry-run') dryRun = true;
  }

  return { limit, country, phase, dryRun };
}

/* ── Helpers ── */

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetry<T>(fn: () => Promise<T>, label: string, retries = MAX_RETRIES): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      if (attempt === retries) throw err;
      logger.warn(SCOPE, `${label} attempt ${attempt}/${retries} failed: ${err.message}. Retry in ${RETRY_DELAY_MS * attempt}ms...`);
      await sleep(RETRY_DELAY_MS * attempt);
    }
  }
  throw new Error('unreachable');
}

/* ── Phase 1: Known Brand Matching ── */

function matchKnownBrand(name: string): string | null {
  const lower = name.toLowerCase();
  for (const brand of KNOWN_BRANDS) {
    for (const pattern of brand.patterns) {
      if (pattern.test(lower)) {
        return brand.website;
      }
    }
  }
  return null;
}

/* ── Phase 2: Domain Guessing ── */

const COUNTRY_TLDS: Record<string, string[]> = {
  PL: ['.pl', '.com.pl'], CA: ['.ca'], GB: ['.co.uk', '.uk'], AE: ['.ae'],
  DE: ['.de'], FR: ['.fr'], ES: ['.es'], IT: ['.it'], NL: ['.nl'],
  SE: ['.se'], NO: ['.no'], DK: ['.dk'], FI: ['.fi'], CZ: ['.cz'],
  AT: ['.at'], CH: ['.ch'], PT: ['.pt'], BE: ['.be'], IE: ['.ie'],
  LT: ['.lt'], LV: ['.lv'], EE: ['.ee'], HR: ['.hr'], RO: ['.ro'],
  BG: ['.bg'], SK: ['.sk'], HU: ['.hu'], GR: ['.gr'], CY: ['.cy'],
  MT: ['.mt'], LU: ['.lu'], SI: ['.si'], IS: ['.is'],
  ZA: ['.co.za', '.za'], NG: ['.ng', '.com.ng'], KE: ['.co.ke', '.ke'],
  US: ['.com', '.us'], JP: ['.jp', '.co.jp'], KR: ['.kr', '.co.kr'],
  IN: ['.in', '.co.in'], MY: ['.my', '.com.my'], TH: ['.co.th', '.th'],
  BR: ['.com.br'], MX: ['.mx', '.com.mx'], AR: ['.com.ar'],
  CO: ['.co', '.com.co'], IL: ['.co.il', '.il'], TR: ['.com.tr'],
  AU: ['.com.au', '.au'], NZ: ['.co.nz', '.nz'], HK: ['.hk', '.com.hk'],
  RU: ['.ru'], UA: ['.ua'], KZ: ['.kz'], GE: ['.ge'],
  BH: ['.bh'], QA: ['.qa'], SA: ['.sa', '.com.sa'],
  IM: ['.im'], GI: ['.gi'], JE: ['.je'], GG: ['.gg'],
  BM: ['.bm'], KY: ['.ky'], VG: ['.vg'], BS: ['.bs'],
  SC: ['.sc'], MU: ['.mu'], PA: ['.pa'],
};

const LEGAL_SUFFIXES = /\b(ltd\.?|limited|inc\.?|incorporated|llc|l\.?l\.?c\.?|gmbh|s\.?a\.?|b\.?v\.?|s\.?r\.?l\.?|oü|a\.?s\.?|sp\.?\s*z\.?\s*o\.?\s*o\.?|spółka\s+z\s+ograniczoną\s+odpowiedzialnością|plc|co\.?\s*ltd\.?|corp\.?|corporation|pty\.?|n\.?v\.?|s\.?e\.?|s\.?p\.?a\.?|s\.?a\.?s\.?|s\.?r\.?o\.?|k\.?f\.?t\.?|z\.?r\.?t\.?|d\.?o\.?o\.?|e\.?k\.?|ab|oy|ag|fze?|b\.?s\.?c\.?|gesellschaft\s+mit\s+beschränkter\s+haftung|sociedad\s+anonima|société\s+anonyme|private|public)\b/gi;

const FILLER_WORDS = /\b(the|and|of|for|group|holdings|services|solutions|technology|technologies|digital|financial|global|international|capital|management|investment|advisory|consulting|enterprises|ventures|payments|trading|exchange|crypto|blockchain|finance|partners|company)\b/gi;

const COMMON_WORDS = new Set([
  'cash', 'swift', 'smart', 'flux', 'patch', 'royal', 'trust', 'first', 'prime',
  'atlas', 'alpha', 'delta', 'sigma', 'omega', 'point', 'arrow', 'north', 'south',
  'west', 'east', 'gold', 'peak', 'apex', 'core', 'wave', 'nova', 'bridge',
  'spark', 'amber', 'coral', 'stone', 'frost', 'storm', 'dawn', 'edge',
  'link', 'icon', 'fuse', 'mint', 'nest', 'port', 'gate', 'path', 'node',
  'base', 'grid', 'wire', 'dock', 'unit', 'arch', 'axis', 'byte', 'code',
  'data', 'echo', 'flow', 'glow', 'hive', 'iris', 'jade', 'kite', 'loom',
  'maze', 'opal', 'pier', 'reef', 'sage', 'tide', 'vale', 'vine', 'zero',
  'rachel', 'matthew', 'james', 'david', 'robert', 'michael', 'william',
  'thomas', 'andrew', 'peter', 'mark', 'john', 'paul', 'alan', 'colin',
  'accounting', 'garage', 'home', 'market', 'world', 'money', 'bank',
  'trade', 'star', 'blue', 'green', 'black', 'white', 'grey', 'silver',
]);

function cleanName(name: string): string {
  return name
    .replace(LEGAL_SUFFIXES, '')
    .replace(/[.,()&]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(text: string): string {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '')
    .trim();
}

function generateDomainCandidates(entity: EntityRow): string[] {
  const name = cleanName(entity.canonical_name || entity.name);
  const words = name.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return [];

  const slug = slugify(name);
  const slugDash = name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-').trim();

  // Core name without filler words
  const core = name.replace(FILLER_WORDS, '').replace(/\s+/g, ' ').trim();
  const coreSlug = slugify(core);

  // First meaningful word
  const firstWord = slugify(words[0]);
  // First two words
  const firstTwo = words.length >= 2 ? slugify(words.slice(0, 2).join(' ')) : null;

  const countryTlds = COUNTRY_TLDS[entity.country_code] || [];
  const tlds = ['.com', ...countryTlds, '.io', '.co', '.net', '.org'];

  const candidates: string[] = [];
  const seen = new Set<string>();
  const add = (domain: string) => {
    const name = domain.split('.')[0];
    if (name.length < 4) return;
    if (COMMON_WORDS.has(name)) return;
    if (!seen.has(domain)) {
      seen.add(domain);
      candidates.push(domain);
    }
  };

  for (const tld of tlds) {
    // Full name slug — highest priority
    if (slug.length >= 5) add(`${slug}${tld}`);
    // Core slug (without filler words)
    if (coreSlug.length >= 5 && coreSlug !== slug) add(`${coreSlug}${tld}`);
    // Hyphenated
    if (slugDash.length >= 5 && slugDash !== slug) add(`${slugDash}${tld}`);
    // First two words
    if (firstTwo && firstTwo.length >= 5 && firstTwo !== slug) add(`${firstTwo}${tld}`);
    // Single word only if it's long and specific enough (likely a brand)
    if (firstWord.length >= 6 && firstWord !== slug && firstWord !== firstTwo) add(`${firstWord}${tld}`);
  }

  return candidates.slice(0, 20);
}

async function checkDomain(domain: string): Promise<boolean> {
  const url = `https://${domain}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOMAIN_CHECK_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      redirect: 'follow',
    });
    return res.status < 500 && res.status !== 404;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function guessWebsite(entity: EntityRow): Promise<{ url: string; domain: string } | null> {
  const candidates = generateDomainCandidates(entity);
  if (candidates.length === 0) return null;

  // Check all candidates in parallel
  const results = await Promise.all(
    candidates.slice(0, DOMAIN_PARALLEL).map(async domain => ({ domain, ok: await checkDomain(domain) }))
  );
  const found = results.find(r => r.ok);
  if (found) return { url: `https://${found.domain}`, domain: found.domain };

  // Second batch if first didn't find anything
  if (candidates.length > DOMAIN_PARALLEL) {
    const results2 = await Promise.all(
      candidates.slice(DOMAIN_PARALLEL).map(async domain => ({ domain, ok: await checkDomain(domain) }))
    );
    const found2 = results2.find(r => r.ok);
    if (found2) return { url: `https://${found2.domain}`, domain: found2.domain };
  }

  return null;
}

/* ── DB Operations ── */

interface EntityRowWithWebsite extends EntityRow {
  website: string | null;
}

async function fetchBatch(sb: ReturnType<typeof getSupabase>, args: Args): Promise<EntityRowWithWebsite[]> {
  return withRetry(async () => {
    let query = sb
      .from('entities')
      .select('id, name, canonical_name, country_code, regulator, raw_data, website')
      .neq('is_garbage', true)
      .neq('is_hidden', true)
      .order('quality_score', { ascending: false })
      .limit(BATCH_SIZE * 2);

    if (args.country) {
      query = query.eq('country_code', args.country);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const rows = (data || []) as EntityRowWithWebsite[];
    return rows.filter((r) => {
      if (!r.website || r.website.trim() === '') return true;
      return isRegistryWebsite(r.website);
    }).slice(0, BATCH_SIZE);
  }, 'fetch-batch');
}

async function writeWebsite(
  sb: ReturnType<typeof getSupabase>,
  entity: EntityRowWithWebsite,
  result: DiscoveryResult,
  dryRun: boolean,
): Promise<boolean> {
  if (dryRun) return false;

  const rawData: Record<string, unknown> = { ...(entity.raw_data || {}) };
  rawData.website_discovery_at = new Date().toISOString();

  // If the entity previously had a registry URL in the website field, preserve it
  const oldRegistryUrl = entity.website && isRegistryWebsite(entity.website) ? entity.website : null;
  if (oldRegistryUrl) {
    rawData.previous_registry_url = oldRegistryUrl;
  }

  if (result.website) {
    rawData.website_source = result.source;
    rawData.website_search_query = result.searchQuery;
    rawData.website_validated = result.validated;

    const updatePayload: Record<string, unknown> = {
      website: result.website,
      raw_data: rawData,
    };
    if (oldRegistryUrl) {
      updatePayload.registry_url = oldRegistryUrl;
    }

    await withRetry(async () => {
      const { error } = await sb.from('entities').update(updatePayload).eq('id', entity.id);
      if (error) throw new Error(error.message);
    }, `write:${entity.id}`);
    return true;
  } else {
    rawData.website_discovery_failed = true;
    rawData.website_discovery_error = result.error;

    const updatePayload: Record<string, unknown> = {
      raw_data: rawData,
    };
    if (oldRegistryUrl) {
      updatePayload.registry_url = oldRegistryUrl;
      updatePayload.website = '';
    }

    await withRetry(async () => {
      const { error } = await sb.from('entities').update(updatePayload).eq('id', entity.id);
      if (error) throw new Error(error.message);
    }, `mark-failed:${entity.id}`);
    return false;
  }
}

/* ── Process Single Entity ── */

async function discoverWebsite(entity: EntityRow, phase: 'all' | 'brand' | 'search'): Promise<DiscoveryResult> {
  const name = entity.canonical_name || entity.name;

  // Phase 1: Known brand match
  if (phase === 'all' || phase === 'brand') {
    const brandUrl = matchKnownBrand(name);
    if (brandUrl) {
      return {
        entityId: entity.id,
        website: brandUrl,
        source: 'brand_match',
        searchQuery: null,
        validated: true,
        error: null,
      };
    }
    if (phase === 'brand') {
      return { entityId: entity.id, website: null, source: null, searchQuery: null, validated: false, error: 'no_brand_match' };
    }
  }

  // Phase 2: Domain guessing
  const candidates = generateDomainCandidates(entity);
  const found = await guessWebsite(entity);

  if (!found) {
    return {
      entityId: entity.id, website: null, source: null,
      searchQuery: `tried ${candidates.length} domains`,
      validated: false, error: 'no_domain_found',
    };
  }

  return {
    entityId: entity.id,
    website: found.url,
    source: 'search',
    searchQuery: found.domain,
    validated: true,
    error: null,
  };
}

/* ── Main ── */

async function main() {
  const args = parseArgs();
  const sb = getSupabase();
  const startedAt = Date.now();

  logger.info(SCOPE, '═══════════════════════════════════════════');
  logger.info(SCOPE, '  Website Discovery — Find Missing Websites');
  logger.info(SCOPE, '═══════════════════════════════════════════');
  logger.info(SCOPE, `Config: limit=${args.limit}, country=${args.country || 'all'}, phase=${args.phase}, dryRun=${args.dryRun}`);

  let totalProcessed = 0;
  let totalFound = 0;
  let totalBrandMatch = 0;
  let totalSearchMatch = 0;
  let totalFailed = 0;
  let batchNum = 0;

  while (totalProcessed < args.limit) {
    batchNum++;
    const entities = await fetchBatch(sb, args);
    if (entities.length === 0) {
      logger.info(SCOPE, `Batch #${batchNum}: no more entities without websites. Done!`);
      break;
    }

    const remaining = args.limit - totalProcessed;
    const batch = entities.slice(0, remaining);
    logger.info(SCOPE, `\n── Batch #${batchNum}: ${batch.length} entities ──`);

    let batchFound = 0;
    let batchBrand = 0;
    let batchSearch = 0;

    for (let i = 0; i < batch.length; i++) {
      const entity = batch[i];
      const result = await discoverWebsite(entity, args.phase);

      if (result.website) {
        const wrote = await writeWebsite(sb, entity, result, args.dryRun);
        if (wrote || args.dryRun) {
          batchFound++;
          totalFound++;
          if (result.source === 'brand_match') { batchBrand++; totalBrandMatch++; }
          if (result.source === 'search') { batchSearch++; totalSearchMatch++; }
        }

        if (result.source === 'brand_match') {
          logger.info(SCOPE, `  ✓ BRAND: ${entity.canonical_name || entity.name} → ${result.website}`);
        } else {
          logger.info(SCOPE, `  ✓ SEARCH: ${entity.canonical_name || entity.name} → ${result.website}`);
        }
      } else {
        totalFailed++;
        await writeWebsite(sb, entity, result, args.dryRun);
      }

      // Progress every 50
      if ((i + 1) % 50 === 0 || i === batch.length - 1) {
        const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0);
        logger.info(SCOPE, `  [${elapsed}s] Batch #${batchNum}: ${i + 1}/${batch.length} | Total: ${totalProcessed + i + 1} done, ${totalFound} found`);
      }

      // Brief delay between entities to be polite
      if (result.source !== 'brand_match') {
        await sleep(200);
      }
    }

    totalProcessed += batch.length;
    const elapsed = ((Date.now() - startedAt) / 1000 / 60).toFixed(1);
    logger.info(SCOPE, `  Batch #${batchNum}: ${batchFound} found (${batchBrand} brand, ${batchSearch} search)`);
    logger.info(SCOPE, `  Cumulative [${elapsed}min]: ${totalProcessed} processed, ${totalFound} found (${totalBrandMatch} brand + ${totalSearchMatch} search), ${totalFailed} failed`);

    if (totalProcessed >= args.limit) {
      logger.info(SCOPE, `Reached limit of ${args.limit}. Stopping.`);
      break;
    }

    if (entities.length < BATCH_SIZE) {
      logger.info(SCOPE, 'Last batch was partial — no more entities remaining.');
      break;
    }

    logger.info(SCOPE, `Pausing ${PAUSE_BETWEEN_BATCHES_MS / 1000}s before next batch...`);
    await sleep(PAUSE_BETWEEN_BATCHES_MS);
  }

  // Final report
  const totalElapsed = ((Date.now() - startedAt) / 1000 / 60).toFixed(1);
  logger.info(SCOPE, '');
  logger.info(SCOPE, '═══════════════════════════════════════════');
  logger.info(SCOPE, '  Website Discovery — Final Report');
  logger.info(SCOPE, '═══════════════════════════════════════════');
  logger.info(SCOPE, `  Batches:           ${batchNum}`);
  logger.info(SCOPE, `  Total processed:   ${totalProcessed}`);
  logger.info(SCOPE, `  Websites found:    ${totalFound} (${totalProcessed > 0 ? (totalFound / totalProcessed * 100).toFixed(0) : 0}%)`);
  logger.info(SCOPE, `    Brand matches:   ${totalBrandMatch}`);
  logger.info(SCOPE, `    Search matches:  ${totalSearchMatch}`);
  logger.info(SCOPE, `  Not found:         ${totalFailed}`);
  logger.info(SCOPE, `  Runtime:           ${totalElapsed} minutes`);
  logger.info(SCOPE, '');

  await sendTelegramAlert(
    SCOPE,
    `Website discovery done: ${totalFound}/${totalProcessed} found across ${batchNum} batches.\n` +
    `Brand: ${totalBrandMatch}, Search: ${totalSearchMatch}, Failed: ${totalFailed}.\n` +
    `Runtime: ${totalElapsed}min`,
  );
}

// Entry point
const lockFile = acquireLock(SCOPE);
const clearRuntimeTimeout = setRuntimeTimeout(SCOPE);

main()
  .then(() => process.exit(0))
  .catch(async (err) => {
    logger.error(SCOPE, `Fatal: ${err.message}`);
    await sendTelegramAlert(SCOPE, `Fatal error: ${err.message}`);
    process.exit(1);
  })
  .finally(() => {
    releaseLock(lockFile);
    clearRuntimeTimeout();
  });
