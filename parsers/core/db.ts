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
let hasQualityColumns = false;

/** Quality columns to preserve across DELETE+INSERT (INFRA-002) */
const QUALITY_COLS = [
  'canonical_name', 'is_garbage', 'quality_score', 'quality_flags',
  'last_quality_at', 'crypto_status', 'dns_status', 'dns_checked_at', 'last_verified_at',
] as const;

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

  // Check quality columns (DDL 007) for INFRA-002 preservation
  const { error: qErr } = await sb.from('entities').select('quality_score').limit(0);
  hasQualityColumns = !qErr;

  const present = [
    hasSourceUrl && 'source_url',
    hasParsedAt && 'parsed_at',
    hasParserId && 'parser_id',
    hasRawData && 'raw_data',
    hasQualityColumns && 'quality_*',
  ].filter(Boolean);

  const missing = [
    !hasSourceUrl && 'source_url',
    !hasParsedAt && 'parsed_at',
    !hasParserId && 'parser_id',
    !hasRawData && 'raw_data',
    !hasQualityColumns && 'quality_*',
  ].filter(Boolean);

  logger.info('db', `Schema detected — present: [${present.join(', ')}], missing: [${missing.join(', ')}]`);
  if (hasQualityColumns) {
    logger.info('db', 'Quality columns found — will preserve on re-parse (INFRA-002)');
  }
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

/** Get current entity count for a country, optionally scoped to a specific parser */
export async function getEntityCount(countryCode: string, parserId?: string): Promise<number> {
  const sb = getSupabase();
  let query = sb
    .from('entities')
    .select('*', { count: 'exact', head: true })
    .eq('country_code', countryCode);

  if (parserId) {
    query = query.eq('parser_id', parserId);
  }

  const { count, error } = await query;

  if (error) {
    logger.error('db', `Failed to get entity count for ${countryCode}${parserId ? '/' + parserId : ''}: ${error.message}`);
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

  // ──────────────────────────────────────────────────────
  // INFRA-002: Backup quality columns BEFORE delete
  // Quality Worker enriches entities with canonical_name, quality_score,
  // crypto_status, dns_status, etc. Parser DELETE+INSERT would wipe this.
  // We save non-default quality data and restore it after INSERT.
  // ──────────────────────────────────────────────────────
  let qualityBackup: Map<string, Record<string, unknown>> | null = null;

  if (hasQualityColumns) {
    const selectCols = ['id', ...QUALITY_COLS].join(',');
    let backupQuery = sb.from('entities').select(selectCols).eq('country_code', countryCode);
    if (hasParserId && registryId) {
      backupQuery = backupQuery.eq('parser_id', registryId);
    }

    const { data: backupData, error: backupErr } = await backupQuery;

    if (backupErr) {
      logger.warn(registryId, `Quality backup failed: ${backupErr.message} — quality data may be lost on re-parse`);
    } else if (backupData && backupData.length > 0) {
      qualityBackup = new Map();
      for (const row of backupData) {
        // Only save entities that have any non-default quality data
        const hasData =
          row.canonical_name != null ||
          row.is_garbage === true ||
          (row.quality_score != null && row.quality_score > 0) ||
          (row.quality_flags != null && JSON.stringify(row.quality_flags) !== '{}') ||
          row.last_quality_at != null ||
          (row.crypto_status != null && row.crypto_status !== 'unknown') ||
          (row.dns_status != null && row.dns_status !== 'unknown') ||
          row.dns_checked_at != null ||
          row.last_verified_at != null;

        if (hasData) {
          const qData: Record<string, unknown> = {};
          for (const col of QUALITY_COLS) {
            if (row[col] !== undefined) qData[col] = row[col];
          }
          qualityBackup.set(row.id as string, qData);
        }
      }
      if (qualityBackup.size > 0) {
        logger.info(registryId, `INFRA-002: Backed up quality data for ${qualityBackup.size} entities`);
      }
    }
  }

  // Delete existing entities for this country FROM THIS PARSER only
  // If parser_id column exists, scope deletion to this parser's rows
  // Otherwise delete all for this country (risk of removing manually-added data)
  let deleteQuery = sb.from('entities').delete().eq('country_code', countryCode);
  if (hasParserId && registryId) {
    deleteQuery = deleteQuery.eq('parser_id', registryId);
    logger.info(registryId, `Scoped delete: country_code=${countryCode} AND parser_id=${registryId}`);
  } else {
    logger.warn(registryId, `Unscoped delete: deleting ALL entities for country_code=${countryCode} (no parser_id column or registryId)`);
  }
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

  // ──────────────────────────────────────────────────────
  // INFRA-002: Restore quality columns AFTER insert
  // Match by entity ID (slug) — same parser produces same slugs.
  // Only restore entities that had non-default quality data.
  // ──────────────────────────────────────────────────────
  if (qualityBackup && qualityBackup.size > 0) {
    let restored = 0;
    let restoreErrors = 0;
    for (const [entityId, qualityData] of qualityBackup) {
      const { error: restoreErr } = await sb
        .from('entities')
        .update(qualityData)
        .eq('id', entityId);

      if (!restoreErr) {
        restored++;
      } else {
        restoreErrors++;
        logger.debug(registryId, `Quality restore skip "${entityId}": ${restoreErr.message}`);
      }
    }
    logger.info(registryId, `INFRA-002: Restored quality data for ${restored}/${qualityBackup.size} entities${restoreErrors > 0 ? ` (${restoreErrors} not found — entity renamed?)` : ''}`);
  }

  // ──────────────────────────────────────────────────────
  // PIPELINE REMINDER: Entities without canonical_name are HIDDEN on frontend.
  // Quality Worker MUST be run after parser to process new entities.
  // See: npx tsx workers/quality/run.ts
  // ──────────────────────────────────────────────────────
  if (hasQualityColumns) {
    const { count: nullCount } = await sb
      .from('entities')
      .select('id', { count: 'exact', head: true })
      .eq('country_code', countryCode)
      .is('canonical_name', null);
    if (nullCount && nullCount > 0) {
      logger.warn(registryId, `⚠ ${nullCount} entities have canonical_name=NULL — they are HIDDEN on frontend until Quality Worker runs!`);
      logger.warn(registryId, `⚠ Run: npx tsx workers/quality/run.ts --country ${countryCode}`);
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
