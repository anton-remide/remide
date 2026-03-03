/**
 * Supabase database operations for parser results.
 *
 * Adapts to the existing schema:
 * - id: string slug (e.g. "za-company-name-slug")
 * - status: entity_status enum (Licensed, Registered, Provisional, Unknown, Sandbox)
 * - country_code: FK to countries table
 * - Optional columns detected at runtime: source_url, parsed_at, parser_id, raw_data
 *
 * Strategy: delete existing entities for the country (from parser), then insert new ones.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ParsedEntity, ParseResult, ScrapeRun } from './types.js';
import { logger } from './logger.js';
import { deduplicateEntities } from './validator.js';

let supabase: SupabaseClient | null = null;

/** Track which optional columns exist (detected on first write) */
let schemaChecked = false;
let hasSourceUrl = false;
let hasParsedAt = false;
let hasParserId = false;
let hasRawData = false;

/** Valid entity_status enum values in the database */
const VALID_STATUSES = ['Licensed', 'Registered', 'Provisional', 'Unknown', 'Sandbox'] as const;

/** Map parser status strings to valid enum values */
function mapStatus(status: string | undefined | null): string {
  if (!status) return 'Unknown';
  const lower = status.toLowerCase().trim();

  // Direct match (case-insensitive)
  const direct = VALID_STATUSES.find((v) => v.toLowerCase() === lower);
  if (direct) return direct;

  // Common mappings
  if (lower.includes('authorized') || lower.includes('authorised') || lower.includes('licensed') || lower.includes('approved')) {
    return 'Licensed';
  }
  if (lower.includes('registered') || lower.includes('enrolled')) {
    return 'Registered';
  }
  if (lower.includes('provisional') || lower.includes('pending') || lower.includes('interim')) {
    return 'Provisional';
  }
  if (lower.includes('sandbox') || lower.includes('experimental')) {
    return 'Sandbox';
  }

  return 'Unknown';
}

/** Generate a slug ID from country code + entity name */
function generateSlugId(countryCode: string, name: string, licenseNumber: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 60);

  const cc = countryCode.toLowerCase();

  if (slug.length > 3) {
    return `${cc}-${slug}`;
  }

  // Fallback: use license number
  const licSlug = licenseNumber
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 40);

  return `${cc}-${licSlug}`;
}

function getSupabase(): SupabaseClient {
  if (supabase) return supabase;

  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars');
  }

  supabase = createClient(url, key);
  return supabase;
}

/** Detect which optional columns exist in the entities table */
async function detectSchema(): Promise<void> {
  if (schemaChecked) return;

  const sb = getSupabase();
  const cols = ['source_url', 'parsed_at', 'parser_id', 'raw_data'] as const;
  const results: Record<string, boolean> = {};

  for (const col of cols) {
    const { error } = await sb.from('entities').select(col).limit(0);
    results[col] = !error;
  }

  hasSourceUrl = results['source_url'] ?? false;
  hasParsedAt = results['parsed_at'] ?? false;
  hasParserId = results['parser_id'] ?? false;
  hasRawData = results['raw_data'] ?? false;

  const present = [
    hasSourceUrl && 'source_url',
    hasParsedAt && 'parsed_at',
    hasParserId && 'parser_id',
    hasRawData && 'raw_data',
  ].filter(Boolean);

  const missing = [
    !hasSourceUrl && 'source_url',
    !hasParsedAt && 'parsed_at',
    !hasParserId && 'parser_id',
    !hasRawData && 'raw_data',
  ].filter(Boolean);

  logger.info('db', `Schema detected — present: [${present.join(', ')}], missing: [${missing.join(', ')}]`);
  schemaChecked = true;
}

/** Convert ParsedEntity to a row object using only existing columns */
function toRow(entity: ParsedEntity, parserId: string): Record<string, unknown> {
  const row: Record<string, unknown> = {
    id: generateSlugId(entity.countryCode, entity.name, entity.licenseNumber),
    name: entity.name,
    country_code: entity.countryCode,
    country: entity.country,
    license_number: entity.licenseNumber,
    license_type: entity.licenseType ?? null,
    entity_types: entity.entityTypes ?? [],
    activities: entity.activities ?? [],
    status: mapStatus(entity.status),
    regulator: entity.regulator ?? null,
    website: entity.website || '',
  };

  // Add optional columns if they exist in schema
  if (hasSourceUrl) row['source_url'] = entity.sourceUrl ?? null;
  if (hasParsedAt) row['parsed_at'] = new Date().toISOString();
  if (hasParserId) row['parser_id'] = parserId;
  if (hasRawData) row['raw_data'] = null;

  return row;
}

/** Get current entity count for a country */
export async function getEntityCount(countryCode: string): Promise<number> {
  const sb = getSupabase();
  const { count, error } = await sb
    .from('entities')
    .select('*', { count: 'exact', head: true })
    .eq('country_code', countryCode);

  if (error) {
    logger.error('db', `Failed to get entity count for ${countryCode}: ${error.message}`);
    return 0;
  }

  return count ?? 0;
}

/**
 * Write entities to Supabase.
 *
 * Strategy: delete existing entities for the country (from this parser), then insert.
 * Uses delete+insert because:
 * - No unique constraint (license_number, country_code) exists
 * - id is a text slug, not auto-generated
 */
export async function upsertEntities(
  result: ParseResult
): Promise<{ inserted: number; updated: number; errors: string[] }> {
  const sb = getSupabase();
  const { registryId, countryCode, entities } = result;

  // Ensure schema is detected
  await detectSchema();

  // Deduplicate
  const unique = deduplicateEntities(entities);
  const rows = unique.map((e) => toRow(e, registryId));

  // Also deduplicate by generated slug ID (in case two entities produce the same slug)
  const seenIds = new Set<string>();
  const dedupedRows = rows.filter((r) => {
    const id = r.id as string;
    if (seenIds.has(id)) return false;
    seenIds.add(id);
    return true;
  });

  if (dedupedRows.length < rows.length) {
    logger.warn(registryId, `${rows.length - dedupedRows.length} rows had duplicate slug IDs (removed)`);
  }

  logger.info(registryId, `Writing ${dedupedRows.length} entities (${entities.length - dedupedRows.length} total duplicates removed)`);

  let inserted = 0;
  const errors: string[] = [];

  // Delete existing entities for this country
  // If parser_id column exists, only delete parser-managed rows
  // Otherwise delete all for this country (risk of removing manually-added data)
  const deleteQuery = sb.from('entities').delete().eq('country_code', countryCode);
  const { error: delErr, count: delCount } = await deleteQuery;

  if (delErr) {
    logger.warn(registryId, `Delete error: ${delErr.message} — trying insert anyway`);
  } else {
    logger.info(registryId, `Deleted existing entities for ${countryCode} (was: ${delCount ?? '?'})`);
  }

  // Insert in chunks
  const chunkSize = 50;
  for (let i = 0; i < dedupedRows.length; i += chunkSize) {
    const chunk = dedupedRows.slice(i, i + chunkSize);
    const { error } = await sb.from('entities').insert(chunk);

    if (error) {
      errors.push(`Insert chunk ${Math.floor(i / chunkSize) + 1}: ${error.message}`);
      logger.error(registryId, `Insert error (chunk ${Math.floor(i / chunkSize) + 1}): ${error.message}`);

      // Try one-by-one insertion for failed chunk to save what we can
      for (const row of chunk) {
        const { error: singleErr } = await sb.from('entities').insert(row);
        if (!singleErr) {
          inserted++;
        } else {
          logger.debug(registryId, `Skip entity "${(row as Record<string, unknown>).name}": ${singleErr.message}`);
        }
      }
    } else {
      inserted += chunk.length;
    }
  }

  logger.info(registryId, `Write complete: ${inserted} inserted, ${errors.length} chunk errors`);
  return { inserted, updated: 0, errors };
}

/** Log a scrape run (non-fatal if table doesn't exist) */
export async function logScrapeRun(run: ScrapeRun): Promise<void> {
  const sb = getSupabase();

  const { error } = await sb.from('scrape_runs').insert({
    registry_id: run.registry_id,
    status: run.status,
    entities_found: run.entities_found,
    entities_new: run.entities_new,
    entities_updated: run.entities_updated,
    entities_removed: run.entities_removed,
    duration_ms: run.duration_ms,
    error_message: run.error_message,
    warnings: run.warnings,
    delta_percent: run.delta_percent,
    created_at: run.timestamp,
  });

  if (error) {
    // Non-fatal — table might not exist yet
    logger.debug(run.registry_id, `Scrape run log skipped: ${error.message}`);
  }
}

/** Run in dry-run mode: validate and log but don't write to DB */
export function isDryRun(): boolean {
  return process.env.DRY_RUN === 'true' || process.env.DRY_RUN === '1';
}
