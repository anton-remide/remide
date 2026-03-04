/**
 * Enrichment Worker — scrapes entity websites via Firecrawl to extract
 * structured metadata (description, LinkedIn, etc.) and writes it back
 * to the Supabase entities table.
 *
 * Usage:
 *   npx tsx workers/enrichment/run.ts                    # Default: 50 entities
 *   npx tsx workers/enrichment/run.ts --country ZA       # Single country
 *   npx tsx workers/enrichment/run.ts --limit 100        # Custom batch size
 *   npx tsx workers/enrichment/run.ts --country ZA --limit 20
 *   DRY_RUN=true npx tsx workers/enrichment/run.ts       # Validate without writing
 *
 * Env vars (loaded via shared/config.ts):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FIRECRAWL_API_KEY
 *   Optional: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, DRY_RUN, DEBUG
 */

import { promises as dns } from 'node:dns';
import Firecrawl from '@mendable/firecrawl-js';
import type { Document as FirecrawlDocument, DocumentMetadata } from '@mendable/firecrawl-js';
import { config } from '../../shared/config.js';
import { getSupabase } from '../../shared/supabase.js';
import { logger, sendTelegramAlert } from '../../shared/logger.js';

const SCOPE = 'enrichment';
const DEFAULT_LIMIT = 50;
const RATE_LIMIT_MS = 3_000; // 3s between Firecrawl calls (respectful)

/* ── Types ── */

interface EntityToEnrich {
  id: string;
  name: string;
  country_code: string;
  website: string;
  description: string | null;
  linkedin_url: string | null;
}

interface EnrichmentResult {
  entityId: string;
  entityName: string;
  description: string | null;
  linkedinUrl: string | null;
  twitterUrl: string | null;
  success: boolean;
  error?: string;
}

interface RunStats {
  total: number;
  enriched: number;
  failed: number;
  skipped: number;
  dnsDead: number;
  descriptionsAdded: number;
  linkedinsAdded: number;
  durationMs: number;
}

/* ── CLI args ── */

function parseArgs(): { country: string | null; limit: number } {
  const args = process.argv.slice(2);
  let country: string | null = null;
  let limit = DEFAULT_LIMIT;

  const countryIdx = args.indexOf('--country');
  if (countryIdx !== -1 && args[countryIdx + 1]) {
    country = args[countryIdx + 1].toUpperCase();
  }

  const limitIdx = args.indexOf('--limit');
  if (limitIdx !== -1 && args[limitIdx + 1]) {
    limit = parseInt(args[limitIdx + 1], 10);
    if (isNaN(limit) || limit <= 0) limit = DEFAULT_LIMIT;
  }

  return { country, limit };
}

/* ── Firecrawl scraping ── */

function initFirecrawl(): Firecrawl {
  const apiKey = config.firecrawl.apiKey;
  if (!apiKey) {
    throw new Error('FIRECRAWL_API_KEY is required. Set it in .env.local');
  }
  return new Firecrawl({ apiKey });
}

/** Normalize URL: ensure https://, strip trailing slash, fix common issues */
function normalizeUrl(url: string): string {
  let u = url.trim();
  // Handle URLs with pipe-separated alternatives (e.g. "site1.com | site2.com")
  if (u.includes(' | ') || u.includes('|')) {
    u = u.split(/\s*\|\s*/)[0].trim();
  }
  // Fix double-protocol (e.g. "https://https.//site.com")
  u = u.replace(/^https?:\/\/https?\.\/?\/*/i, 'https://');
  // Ensure protocol
  if (!u.startsWith('http://') && !u.startsWith('https://')) {
    u = 'https://' + u;
  }
  return u.replace(/\/+$/, '');
}

/** Extract LinkedIn URL from page content or metadata */
function extractLinkedIn(markdown: string, metadata: Record<string, unknown>): string | null {
  // Check metadata first (og:see_also, social links)
  const metaStr = JSON.stringify(metadata).toLowerCase();
  const linkedinMatch = metaStr.match(/https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[a-zA-Z0-9_-]+/i);
  if (linkedinMatch) return linkedinMatch[0];

  // Search in markdown content
  const contentMatch = markdown.match(/https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[a-zA-Z0-9_-]+/i);
  if (contentMatch) return contentMatch[0];

  return null;
}

/** Extract Twitter/X URL from page content or metadata */
function extractTwitter(markdown: string, metadata: Record<string, unknown>): string | null {
  const metaStr = JSON.stringify(metadata).toLowerCase();
  const twitterMatch = metaStr.match(/https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[a-zA-Z0-9_]+/i);
  if (twitterMatch) return twitterMatch[0];

  const contentMatch = markdown.match(/https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[a-zA-Z0-9_]+/i);
  if (contentMatch) return contentMatch[0];

  return null;
}

/** Junk description patterns — maintenance pages, generic boilerplate */
const JUNK_PATTERNS = [
  /scheduled maintenance/i,
  /check back in a minute/i,
  /under construction/i,
  /coming soon/i,
  /403 forbidden/i,
  /404 not found/i,
  /access denied/i,
  /page not found/i,
  /enable javascript/i,
  /please enable cookies/i,
  /cloudflare/i,
  /just a moment/i,
];

/** Check if a description looks like junk/boilerplate */
function isJunkDescription(text: string): boolean {
  return JUNK_PATTERNS.some((p) => p.test(text));
}

/** Build a clean description from Firecrawl result */
function extractDescription(markdown: string, metadata: Record<string, unknown>): string | null {
  // Priority 1: OG description / meta description
  const ogDesc = metadata?.ogDescription ?? metadata?.description ?? metadata?.['og:description'];
  if (ogDesc && typeof ogDesc === 'string' && ogDesc.trim().length > 20) {
    const cleaned = cleanDescription(ogDesc.trim());
    if (!isJunkDescription(cleaned)) return cleaned;
  }

  // Priority 2: First meaningful paragraph from markdown
  // Split by double newline, find first paragraph with 30+ chars
  const paragraphs = markdown.split(/\n{2,}/);
  for (const p of paragraphs) {
    const clean = p.replace(/[#*_\[\]()!]/g, '').trim();
    // Skip nav items, short lines, headers, junk
    if (clean.length >= 30 && !clean.includes('|') && !clean.startsWith('Cookie') && !clean.startsWith('Accept') && !isJunkDescription(clean)) {
      return cleanDescription(clean);
    }
  }

  return null;
}

/** Sanitize description text */
function cleanDescription(text: string): string {
  return text
    .replace(/\s+/g, ' ')          // Collapse whitespace
    .replace(/^\s*[-–—]\s*/, '')    // Strip leading dashes
    .trim()
    .slice(0, 500);                 // Cap at 500 chars
}

/** Quick DNS check — returns false if hostname doesn't resolve (saves Firecrawl credits) */
async function isDomainAlive(hostname: string): Promise<boolean> {
  try {
    await dns.resolve4(hostname);
    return true;
  } catch {
    return false;
  }
}

/** Scrape a single entity website via Firecrawl v2 */
async function scrapeEntity(
  firecrawl: Firecrawl,
  entity: EntityToEnrich,
): Promise<EnrichmentResult> {
  const url = normalizeUrl(entity.website);

  try {
    // Quick DNS pre-check to avoid wasting Firecrawl API credits on dead domains
    const hostname = new URL(url).hostname;
    const alive = await isDomainAlive(hostname);
    if (!alive) {
      return {
        entityId: entity.id,
        entityName: entity.name,
        description: null,
        linkedinUrl: null,
        twitterUrl: null,
        success: false,
        error: `DNS dead: ${hostname}`,
      };
    }

    // Firecrawl v2: scrape() returns Document directly, throws on failure
    const doc: FirecrawlDocument = await firecrawl.scrape(url, {
      formats: ['markdown'],
      onlyMainContent: true,
      timeout: 30_000,
    });

    const markdown = doc.markdown ?? '';
    const metadata = (doc.metadata ?? {}) as DocumentMetadata & Record<string, unknown>;

    // Extract data — only if the entity is missing that field
    const description = entity.description?.trim() ? null : extractDescription(markdown, metadata);
    const linkedinUrl = entity.linkedin_url?.trim() ? null : extractLinkedIn(markdown, metadata);
    const twitterUrl = extractTwitter(markdown, metadata);

    return {
      entityId: entity.id,
      entityName: entity.name,
      description,
      linkedinUrl,
      twitterUrl,
      success: true,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      entityId: entity.id,
      entityName: entity.name,
      description: null,
      linkedinUrl: null,
      twitterUrl: null,
      success: false,
      error: `Scrape failed for ${url}: ${msg}`,
    };
  }
}

/* ── Schema detection ── */

interface SchemaInfo {
  hasDescription: boolean;
  hasLinkedinUrl: boolean;
  hasRegistryUrl: boolean;
  hasEnrichedAt: boolean;
}

/** Detect which enrichment columns exist in the entities table */
async function detectSchema(): Promise<SchemaInfo> {
  const sb = getSupabase();
  const schema: SchemaInfo = {
    hasDescription: false,
    hasLinkedinUrl: false,
    hasRegistryUrl: false,
    hasEnrichedAt: false,
  };

  const check = async (col: string): Promise<boolean> => {
    const { error } = await sb.from('entities').select(col).limit(1);
    if (error && error.message.includes('does not exist')) return false;
    return true;
  };

  [schema.hasDescription, schema.hasLinkedinUrl, schema.hasRegistryUrl, schema.hasEnrichedAt] =
    await Promise.all([
      check('description'),
      check('linkedin_url'),
      check('registry_url'),
      check('enriched_at'),
    ]);

  return schema;
}

/* ── Supabase operations ── */

/** Fetch entities that need enrichment */
async function fetchEntitiesToEnrich(
  country: string | null,
  limit: number,
  schema: SchemaInfo,
): Promise<EntityToEnrich[]> {
  const sb = getSupabase();

  // Build SELECT columns dynamically based on available schema
  const selectCols = ['id', 'name', 'country_code', 'website'];
  if (schema.hasDescription) selectCols.push('description');
  if (schema.hasLinkedinUrl) selectCols.push('linkedin_url');
  // Always include raw_data so we can skip already-enriched entities
  selectCols.push('raw_data');

  // Build filter: entities with a real website that need enrichment data
  // Filter out junk website values common in Canadian registry
  let query = sb
    .from('entities')
    .select(selectCols.join(', '))
    .not('website', 'is', null)
    .neq('website', '')
    .neq('website', 'Not available')
    .neq('website', 'not available')
    .neq('website', 'N/A')
    .neq('website', 'n/a')
    .neq('website', '-')
    .neq('website', 'none')
    .neq('website', 'None');

  // Only filter on enrichment columns that exist
  if (schema.hasDescription && schema.hasLinkedinUrl) {
    query = query.or('description.is.null,description.eq.,linkedin_url.is.null,linkedin_url.eq.');
  } else if (schema.hasDescription) {
    query = query.or('description.is.null,description.eq.');
  } else if (schema.hasLinkedinUrl) {
    query = query.or('linkedin_url.is.null,linkedin_url.eq.');
  }
  // If neither column exists, we'll just grab entities with websites (all need enrichment)

  query = query.order('country_code').limit(limit);

  if (country) {
    query = query.eq('country_code', country);
  }

  const { data, error } = await query;

  if (error) throw new Error(`Failed to fetch entities: ${error.message}`);

  // Map results, defaulting missing columns to null
  // Skip entities that already have enrichment data in raw_data (when dedicated columns don't exist)
  return (data ?? [])
    .filter((row: Record<string, unknown>) => {
      // If dedicated columns exist, the .or() filter above already handles this
      if (schema.hasDescription || schema.hasLinkedinUrl) return true;
      // Without dedicated columns, skip if raw_data already has enrichment_description
      const rd = row.raw_data as Record<string, unknown> | null;
      if (rd?.enrichment_description) return false;
      return true;
    })
    .map((row: Record<string, unknown>) => ({
      id: row.id as string,
      name: row.name as string,
      country_code: row.country_code as string,
      website: row.website as string,
      description: (row.description as string | null) ?? null,
      linkedin_url: (row.linkedin_url as string | null) ?? null,
    }));
}

/** Write enrichment results back to Supabase */
async function writeEnrichmentResults(
  results: EnrichmentResult[],
  schema: SchemaInfo,
): Promise<{ written: number; errors: string[] }> {
  const sb = getSupabase();
  const dryRun = config.flags.dryRun;
  let written = 0;
  const errors: string[] = [];

  for (const r of results) {
    if (!r.success) continue;
    if (!r.description && !r.linkedinUrl) continue; // Nothing new to write

    const updates: Record<string, unknown> = {};
    // Only write to columns that exist
    if (r.description && schema.hasDescription) updates.description = r.description;
    if (r.linkedinUrl && schema.hasLinkedinUrl) updates.linkedin_url = r.linkedinUrl;
    if (schema.hasEnrichedAt) updates.enriched_at = new Date().toISOString();

    // If no columns available to write, store enrichment data in raw_data as fallback
    if (Object.keys(updates).length === 0) {
      // Fallback: stash enrichment results in raw_data JSONB
      const enrichmentData: Record<string, string> = {};
      if (r.description) enrichmentData.enrichment_description = r.description;
      if (r.linkedinUrl) enrichmentData.enrichment_linkedin_url = r.linkedinUrl;
      if (r.twitterUrl) enrichmentData.enrichment_twitter_url = r.twitterUrl;

      if (Object.keys(enrichmentData).length === 0) continue;

      if (dryRun) {
        logger.info(SCOPE, `[DRY-RUN] Would stash in raw_data for ${r.entityName}: ${JSON.stringify(enrichmentData)}`);
        written++;
        continue;
      }

      // Read existing raw_data, merge enrichment fields
      const { data: existing } = await sb
        .from('entities')
        .select('raw_data')
        .eq('id', r.entityId)
        .single();

      const rawData = { ...(existing?.raw_data as Record<string, unknown> ?? {}), ...enrichmentData };

      const { error } = await sb
        .from('entities')
        .update({ raw_data: rawData })
        .eq('id', r.entityId);

      if (error) {
        errors.push(`${r.entityName} (raw_data fallback): ${error.message}`);
        logger.warn(SCOPE, `Failed to stash raw_data for ${r.entityName}: ${error.message}`);
      } else {
        written++;
        logger.debug(SCOPE, `Stashed enrichment in raw_data for ${r.entityName}`);
      }
      continue;
    }

    if (dryRun) {
      logger.info(SCOPE, `[DRY-RUN] Would update ${r.entityName}: ${JSON.stringify(updates)}`);
      written++;
      continue;
    }

    const { error } = await sb
      .from('entities')
      .update(updates)
      .eq('id', r.entityId);

    if (error) {
      errors.push(`${r.entityName}: ${error.message}`);
      logger.warn(SCOPE, `Failed to update ${r.entityName}: ${error.message}`);
    } else {
      written++;
      logger.debug(SCOPE, `Updated ${r.entityName}: ${Object.keys(updates).join(', ')}`);
    }
  }

  return { written, errors };
}

/** Log enrichment run to scrape_runs table */
async function logEnrichmentRun(stats: RunStats, errors: string[]): Promise<void> {
  const sb = getSupabase();

  const status = stats.failed > stats.enriched ? 'error' : stats.failed > 0 ? 'partial' : 'success';

  const { error } = await sb.from('scrape_runs').insert({
    registry_id: 'enrichment-firecrawl',
    status,
    entities_found: stats.total,
    entities_new: stats.descriptionsAdded,
    entities_updated: stats.linkedinsAdded,
    entities_removed: 0,
    duration_ms: stats.durationMs,
    error_message: errors.length > 0 ? errors.slice(0, 5).join('; ') : null,
    warnings: [],
    delta_percent: 0,
    created_at: new Date().toISOString(),
  });

  if (error) {
    // Non-fatal — table might not exist yet
    logger.debug(SCOPE, `Scrape run log skipped: ${error.message}`);
  }
}

/* ── Main ── */

async function main() {
  const startTime = Date.now();
  const { country, limit } = parseArgs();

  logger.info(SCOPE, '=======================================');
  logger.info(SCOPE, '  Firecrawl Enrichment Worker');
  logger.info(SCOPE, '=======================================');
  logger.info(SCOPE, `Config: country=${country ?? 'all'}, limit=${limit}, dryRun=${config.flags.dryRun}`);

  if (!config.firecrawl.enabled) {
    logger.error(SCOPE, 'FIRECRAWL_API_KEY not set. Exiting.');
    process.exit(1);
  }

  // 0. Detect available schema columns
  logger.info(SCOPE, 'Detecting schema...');
  const schema = await detectSchema();
  logger.info(SCOPE, `Schema: description=${schema.hasDescription}, linkedin_url=${schema.hasLinkedinUrl}, registry_url=${schema.hasRegistryUrl}, enriched_at=${schema.hasEnrichedAt}`);

  if (!schema.hasDescription && !schema.hasLinkedinUrl) {
    logger.warn(SCOPE, 'Enrichment columns not found. Results will be stored in raw_data JSONB as fallback.');
    logger.warn(SCOPE, 'Run scripts/003_enrichment_columns.sql in Supabase SQL Editor for dedicated columns.');
  }

  // 1. Fetch entities to enrich
  logger.info(SCOPE, 'Fetching entities to enrich...');
  const entities = await fetchEntitiesToEnrich(country, limit, schema);
  logger.info(SCOPE, `Found ${entities.length} entities to enrich`);

  if (entities.length === 0) {
    logger.info(SCOPE, 'No entities need enrichment. Done.');
    return;
  }

  // Show country breakdown
  const countryBreakdown = new Map<string, number>();
  entities.forEach((e) => {
    countryBreakdown.set(e.country_code, (countryBreakdown.get(e.country_code) ?? 0) + 1);
  });
  const breakdown = [...countryBreakdown.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([code, count]) => `${code}:${count}`)
    .join(', ');
  logger.info(SCOPE, `Country breakdown: ${breakdown}`);

  // 2. Initialize Firecrawl
  const firecrawl = initFirecrawl();

  // 3. Process entities
  const results: EnrichmentResult[] = [];
  const stats: RunStats = {
    total: entities.length,
    enriched: 0,
    failed: 0,
    skipped: 0,
    dnsDead: 0,
    descriptionsAdded: 0,
    linkedinsAdded: 0,
    durationMs: 0,
  };

  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i];
    const progress = `[${i + 1}/${entities.length}]`;

    logger.info(SCOPE, `${progress} Scraping ${entity.name} (${entity.country_code}) — ${entity.website}`);

    const result = await scrapeEntity(firecrawl, entity);
    results.push(result);

    if (result.success) {
      const found: string[] = [];
      if (result.description) found.push('description');
      if (result.linkedinUrl) found.push('linkedin');
      if (result.twitterUrl) found.push('twitter');

      if (found.length > 0) {
        logger.info(SCOPE, `${progress} Found: ${found.join(', ')}`);
        stats.enriched++;
        if (result.description) stats.descriptionsAdded++;
        if (result.linkedinUrl) stats.linkedinsAdded++;
      } else {
        logger.info(SCOPE, `${progress} No new data found`);
        stats.skipped++;
      }
    } else {
      const isDead = result.error?.startsWith('DNS dead:');
      const isCreditsExhausted = result.error?.includes('Insufficient credits');
      if (isDead) {
        logger.debug(SCOPE, `${progress} DNS dead: ${entity.website}`);
        stats.dnsDead++;
      } else if (isCreditsExhausted) {
        logger.error(SCOPE, `${progress} Firecrawl credits exhausted! Stopping batch.`);
        stats.failed++;
        break; // Stop processing — no point wasting time
      } else {
        logger.warn(SCOPE, `${progress} Failed: ${result.error}`);
      }
      stats.failed++;
    }

    // Rate limiting — only wait after actual Firecrawl API calls (skip for DNS-dead)
    const isDnsDead = !result.success && result.error?.startsWith('DNS dead:');
    if (i < entities.length - 1 && !isDnsDead) {
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_MS));
    }
  }

  // 4. Write results to Supabase
  logger.info(SCOPE, '');
  logger.info(SCOPE, 'Writing enrichment results...');
  const { written, errors } = await writeEnrichmentResults(results, schema);
  logger.info(SCOPE, `Written: ${written} entities updated`);

  // 5. Log run
  stats.durationMs = Date.now() - startTime;
  await logEnrichmentRun(stats, errors);

  // 6. Summary
  logger.info(SCOPE, '');
  logger.info(SCOPE, '=======================================');
  logger.info(SCOPE, '  Enrichment Complete');
  logger.info(SCOPE, '=======================================');
  logger.info(SCOPE, `  Total processed:     ${stats.total}`);
  logger.info(SCOPE, `  Successfully scraped: ${stats.enriched}`);
  logger.info(SCOPE, `  No new data:         ${stats.skipped}`);
  logger.info(SCOPE, `  Failed:              ${stats.failed} (${stats.dnsDead} DNS dead)`);
  logger.info(SCOPE, `  Descriptions added:  ${stats.descriptionsAdded}`);
  logger.info(SCOPE, `  LinkedIns added:     ${stats.linkedinsAdded}`);
  logger.info(SCOPE, `  DB writes:           ${written}`);
  logger.info(SCOPE, `  Duration:            ${(stats.durationMs / 1000).toFixed(1)}s`);
  logger.info(SCOPE, '=======================================');

  // 7. Alert on high failure rate
  if (stats.failed > stats.total * 0.5 && stats.total > 5) {
    await sendTelegramAlert(
      SCOPE,
      `High failure rate: ${stats.failed}/${stats.total} (${((stats.failed / stats.total) * 100).toFixed(0)}%)`,
      true,
    );
  }
}

main().catch(async (err) => {
  logger.error(SCOPE, `Fatal: ${err.message}`);
  await sendTelegramAlert(SCOPE, `Fatal error: ${err.message}`);
  process.exit(1);
});
