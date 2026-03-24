/**
 * Site Scraper — lightweight metadata extractor for entity websites.
 *
 * Fetches each entity's website using native fetch + cheerio, extracts
 * brand name, description, social links, logo — without Firecrawl.
 * Runs continuously in batches until all entities are processed.
 *
 * Usage:
 *   npx tsx workers/site-scraper/run.ts                  # All unenriched with website
 *   npx tsx workers/site-scraper/run.ts --limit 500      # Limit total
 *   npx tsx workers/site-scraper/run.ts --country MT     # Single country
 *   npx tsx workers/site-scraper/run.ts --concurrency 10 # Parallel requests
 *   npx tsx workers/site-scraper/run.ts --force           # Re-scrape already enriched
 *   DRY_RUN=true npx tsx workers/site-scraper/run.ts     # No DB writes
 */

import * as cheerio from 'cheerio';
import { config } from '../../shared/config.js';
import { getSupabase } from '../../shared/supabase.js';
import { logger, sendTelegramAlert } from '../../shared/logger.js';
import { acquireLock, releaseLock, setRuntimeTimeout } from '../../shared/guards.js';

const SCOPE = 'site-scraper';
const DEFAULT_LIMIT = 50_000;
const BATCH_SIZE = 1_000;
const REQUEST_TIMEOUT_MS = 15_000;
const DELAY_BETWEEN_MS = 150;
const PAUSE_BETWEEN_BATCHES_MS = 5_000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2_000;

/* ── Types ── */

interface EntityRow {
  id: string;
  name: string;
  canonical_name: string | null;
  website: string;
  country_code: string;
  brand_name: string | null;
  description: string | null;
  linkedin_url: string | null;
  twitter_url: string | null;
  raw_data: Record<string, unknown> | null;
}

interface ScrapeResult {
  entityId: string;
  success: boolean;
  brand_name: string | null;
  description: string | null;
  linkedin_url: string | null;
  twitter_url: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  og_image: string | null;
  site_title: string | null;
  meta_keywords: string | null;
  error: string | null;
  httpStatus: number | null;
}

interface Args {
  limit: number;
  country: string | null;
  concurrency: number;
  dryRun: boolean;
  force: boolean;
}

/* ── CLI Args ── */

function parseArgs(): Args {
  const args = process.argv.slice(2);
  let limit = DEFAULT_LIMIT;
  let country: string | null = null;
  let concurrency = 5;
  let dryRun = config.flags.dryRun;
  let force = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) limit = Number(args[++i]);
    if (args[i] === '--country' && args[i + 1]) country = args[++i].toUpperCase();
    if (args[i] === '--concurrency' && args[i + 1]) concurrency = Number(args[++i]);
    if (args[i] === '--dry-run') dryRun = true;
    if (args[i] === '--force') force = true;
  }

  return { limit, country, concurrency, dryRun, force };
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
      logger.warn(SCOPE, `${label} attempt ${attempt}/${retries} failed: ${err.message}. Retrying in ${RETRY_DELAY_MS}ms...`);
      await sleep(RETRY_DELAY_MS * attempt);
    }
  }
  throw new Error('unreachable');
}

/* ── URL Normalization ── */

function normalizeUrl(raw: string): string | null {
  if (!raw || raw.length < 4) return null;
  let url = raw.trim();
  if (!url.match(/^https?:\/\//i)) url = 'https://' + url;
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('.')) return null;
    if (/^(localhost|127\.|192\.168\.|10\.)/i.test(parsed.hostname)) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

/* ── Fetch with Timeout & Fallback ── */

async function fetchPage(url: string): Promise<{ html: string; finalUrl: string; status: number } | null> {
  const tryFetch = async (target: string) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(target, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate',
        },
        redirect: 'follow',
      });

      const contentType = res.headers.get('content-type') || '';
      if (!res.ok) return { html: '', finalUrl: res.url, status: res.status };
      if (!contentType.includes('text/html') && !contentType.includes('xhtml')) {
        return { html: '', finalUrl: res.url, status: res.status };
      }

      const html = await res.text();
      return { html: html.slice(0, 500_000), finalUrl: res.url, status: res.status };
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  };

  // Try HTTPS first, fallback to HTTP
  let result = await tryFetch(url);
  if (!result && url.startsWith('https://')) {
    result = await tryFetch(url.replace('https://', 'http://'));
  }
  return result;
}

/* ── HTML Metadata Extraction ── */

function extractMetadata(html: string, baseUrl: string): Omit<ScrapeResult, 'entityId' | 'success' | 'error' | 'httpStatus'> {
  const $ = cheerio.load(html);

  const getMeta = (name: string): string | null => {
    return (
      $(`meta[property="${name}"]`).attr('content') ||
      $(`meta[name="${name}"]`).attr('content') ||
      null
    );
  };

  const ogSiteName = getMeta('og:site_name');
  const appName = getMeta('application-name');
  const rawTitle = $('title').first().text().trim();
  const site_title = rawTitle || null;
  const brand_name = cleanBrand(ogSiteName || appName || extractBrandFromTitle(rawTitle));

  const ogDesc = getMeta('og:description');
  const metaDesc = getMeta('description');
  const description = cleanDescription(ogDesc || metaDesc);

  let linkedin_url: string | null = null;
  let twitter_url: string | null = null;

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (!linkedin_url && href.includes('linkedin.com/company/')) {
      linkedin_url = href.startsWith('http') ? href : null;
    }
    if (!twitter_url && (href.includes('twitter.com/') || href.includes('x.com/'))) {
      const cleaned = href.startsWith('http') ? href : null;
      if (cleaned && !cleaned.includes('/intent/') && !cleaned.includes('/share')) {
        twitter_url = cleaned;
      }
    }
  });

  const og_image = getMeta('og:image') || null;
  const favicon_url = resolveFavicon($, baseUrl);
  const logo_url = og_image || favicon_url;
  const meta_keywords = getMeta('keywords');

  return { brand_name, description, linkedin_url, twitter_url, logo_url, favicon_url, og_image, site_title, meta_keywords };
}

function cleanBrand(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (s.length < 2 || s.length > 100) return null;
  if (/^(home|welcome|error|page not found|403|404|500|loading|untitled|document|nginx|apache|iis|default)/i.test(s)) return null;
  return s;
}

function extractBrandFromTitle(title: string | null): string | null {
  if (!title) return null;
  const parts = title.split(/\s*[|–—-]\s*/);
  if (parts.length >= 2) {
    const shortest = parts.reduce((a, b) => a.length <= b.length ? a : b).trim();
    if (shortest.length >= 2 && shortest.length <= 50) return shortest;
  }
  return title.length <= 60 ? title : null;
}

function cleanDescription(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (s.length < 20 || s.length > 2000) return null;
  return s;
}

function resolveFavicon($: cheerio.CheerioAPI, baseUrl: string): string | null {
  const link = $('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]').first().attr('href');
  if (!link) return null;
  try {
    return new URL(link, baseUrl).href;
  } catch {
    return null;
  }
}

/* ── Single Entity Scrape ── */

async function scrapeEntity(entity: EntityRow): Promise<ScrapeResult> {
  const empty: ScrapeResult = {
    entityId: entity.id, success: false,
    brand_name: null, description: null, linkedin_url: null, twitter_url: null,
    logo_url: null, favicon_url: null, og_image: null, site_title: null, meta_keywords: null,
    error: null, httpStatus: null,
  };

  const url = normalizeUrl(entity.website);
  if (!url) return { ...empty, error: 'invalid_url' };

  const page = await fetchPage(url);
  if (!page) return { ...empty, error: 'timeout_or_network' };
  if (page.status >= 400) return { ...empty, error: `http_${page.status}`, httpStatus: page.status };
  if (!page.html || page.html.length < 100) return { ...empty, error: 'empty_response', httpStatus: page.status };

  const meta = extractMetadata(page.html, page.finalUrl);
  return { entityId: entity.id, success: true, ...meta, error: null, httpStatus: page.status };
}

/* ── DB Writer ── */

async function writeResult(
  sb: ReturnType<typeof getSupabase>,
  entity: EntityRow,
  result: ScrapeResult,
  dryRun: boolean,
): Promise<boolean> {
  if (dryRun) return false;

  const now = new Date().toISOString();
  const rawData: Record<string, unknown> = { ...(entity.raw_data || {}) };

  if (!result.success) {
    rawData.site_scrape_error = result.error;
    rawData.site_scrape_attempted_at = now;
    rawData.site_scrape_http_status = result.httpStatus;

    await withRetry(async () => {
      const { error } = await sb.from('entities').update({
        enriched_at: now,
        raw_data: rawData,
      }).eq('id', entity.id);
      if (error) throw new Error(error.message);
    }, `mark-failed:${entity.id}`);
    return false;
  }

  const updates: Record<string, unknown> = {
    enriched_at: now,
  };

  if (result.brand_name && !entity.brand_name) {
    updates.brand_name = result.brand_name;
  }
  if (result.description && (!entity.description || entity.description.length < 30)) {
    updates.description = result.description;
  }
  if (result.linkedin_url && !entity.linkedin_url) {
    updates.linkedin_url = result.linkedin_url;
  }
  if (result.twitter_url && !entity.twitter_url) {
    updates.twitter_url = result.twitter_url;
  }

  if (result.og_image) rawData.og_image = result.og_image;
  if (result.favicon_url) rawData.favicon_url = result.favicon_url;
  if (result.site_title) rawData.site_title = result.site_title;
  if (result.meta_keywords) rawData.meta_keywords = result.meta_keywords;
  if (result.logo_url) rawData.logo_url = result.logo_url;
  rawData.site_scraped_at = now;
  rawData.site_scrape_error = null;
  updates.raw_data = rawData;

  await withRetry(async () => {
    const { error } = await sb.from('entities').update(updates).eq('id', entity.id);
    if (error) throw new Error(error.message);
  }, `write:${entity.id}`);
  return true;
}

/* ── Concurrency Pool ── */

async function runPool<T, R>(
  items: T[],
  concurrency: number,
  delayMs: number,
  fn: (item: T) => Promise<R>,
  onProgress: (done: number, total: number) => void,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  let done = 0;

  async function worker() {
    while (next < items.length) {
      const idx = next++;
      results[idx] = await fn(items[idx]);
      done++;
      if (done % 50 === 0) onProgress(done, items.length);
      if (delayMs > 0) await sleep(delayMs);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  onProgress(done, items.length);
  return results;
}

/* ── Fetch Batch from DB ── */

async function fetchBatch(sb: ReturnType<typeof getSupabase>, args: Args): Promise<EntityRow[]> {
  return withRetry(async () => {
    let query = sb
      .from('entities')
      .select('id, name, canonical_name, website, country_code, brand_name, description, linkedin_url, twitter_url, raw_data')
      .neq('website', '')
      .neq('is_garbage', true)
      .neq('is_hidden', true)
      .order('quality_score', { ascending: false })
      .limit(BATCH_SIZE);

    if (!args.force) {
      query = query.is('enriched_at', null);
    }
    if (args.country) {
      query = query.eq('country_code', args.country);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data || []) as EntityRow[];
  }, 'fetch-batch');
}

/* ── Main ── */

async function main() {
  const args = parseArgs();
  const sb = getSupabase();
  const startedAt = Date.now();

  logger.info(SCOPE, '═══════════════════════════════════════════');
  logger.info(SCOPE, '  Site Scraper — Continuous Website Enrichment');
  logger.info(SCOPE, '═══════════════════════════════════════════');
  logger.info(SCOPE, `Config: totalLimit=${args.limit}, country=${args.country || 'all'}, concurrency=${args.concurrency}, dryRun=${args.dryRun}, force=${args.force}`);

  let totalProcessed = 0;
  let totalSuccess = 0;
  let totalFail = 0;
  let totalWritten = 0;
  let totalBrands = 0;
  let totalDescs = 0;
  let totalLinkedin = 0;
  let totalTwitter = 0;
  let batchNum = 0;

  while (totalProcessed < args.limit) {
    batchNum++;
    const entities = await fetchBatch(sb, args);
    if (entities.length === 0) {
      logger.info(SCOPE, `Batch #${batchNum}: no more entities to scrape. All done!`);
      break;
    }

    const remaining = args.limit - totalProcessed;
    const batch = entities.slice(0, remaining);
    logger.info(SCOPE, `\n── Batch #${batchNum}: ${batch.length} entities ──`);

    let batchSuccess = 0;
    let batchFail = 0;
    let batchWritten = 0;
    let batchBrands = 0;
    let batchDescs = 0;

    await runPool(
      batch,
      args.concurrency,
      DELAY_BETWEEN_MS,
      async (entity) => {
        const result = await scrapeEntity(entity);

        if (result.success) {
          batchSuccess++;
          totalSuccess++;
          const wrote = await writeResult(sb, entity, result, args.dryRun);
          if (wrote) {
            batchWritten++;
            totalWritten++;
            if (result.brand_name && !entity.brand_name) { batchBrands++; totalBrands++; }
            if (result.description) { batchDescs++; totalDescs++; }
            if (result.linkedin_url && !entity.linkedin_url) totalLinkedin++;
            if (result.twitter_url && !entity.twitter_url) totalTwitter++;
          }
        } else {
          batchFail++;
          totalFail++;
          await writeResult(sb, entity, result, args.dryRun);
        }
        return result;
      },
      (done, total) => {
        if (done % 100 === 0 || done === total) {
          const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0);
          logger.info(SCOPE, `  [${elapsed}s] Batch #${batchNum}: ${done}/${total} | Total: ${totalProcessed + done} done, ${totalWritten} enriched`);
        }
      },
    );

    totalProcessed += batch.length;
    const elapsed = ((Date.now() - startedAt) / 1000 / 60).toFixed(1);
    const rate = totalProcessed > 0 ? (totalSuccess / totalProcessed * 100).toFixed(0) : '0';
    logger.info(SCOPE, `  Batch #${batchNum}: ${batchSuccess}/${batch.length} success, ${batchWritten} written, ${batchBrands} brands`);
    logger.info(SCOPE, `  Cumulative [${elapsed}min]: ${totalProcessed} processed, ${totalSuccess} success (${rate}%), ${totalWritten} enriched, ${totalBrands} brands, ${totalDescs} descs`);

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
  logger.info(SCOPE, '  Site Scraper — Final Report');
  logger.info(SCOPE, '═══════════════════════════════════════════');
  logger.info(SCOPE, `  Batches:           ${batchNum}`);
  logger.info(SCOPE, `  Total processed:   ${totalProcessed}`);
  logger.info(SCOPE, `  Successful:        ${totalSuccess} (${totalProcessed > 0 ? (totalSuccess / totalProcessed * 100).toFixed(0) : 0}%)`);
  logger.info(SCOPE, `  Failed:            ${totalFail}`);
  logger.info(SCOPE, `  Enriched (written): ${totalWritten}`);
  logger.info(SCOPE, `  Brands extracted:  ${totalBrands}`);
  logger.info(SCOPE, `  Descriptions:      ${totalDescs}`);
  logger.info(SCOPE, `  LinkedIn found:    ${totalLinkedin}`);
  logger.info(SCOPE, `  Twitter found:     ${totalTwitter}`);
  logger.info(SCOPE, `  Runtime:           ${totalElapsed} minutes`);
  logger.info(SCOPE, '');

  await sendTelegramAlert(
    SCOPE,
    `Site scraper done: ${totalSuccess}/${totalProcessed} success across ${batchNum} batches.\n` +
    `${totalBrands} brands, ${totalDescs} descriptions, ${totalLinkedin} LinkedIn, ${totalTwitter} Twitter.\n` +
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
