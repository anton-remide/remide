/**
 * Quality Worker — Cleanup, Classify, Score all entities.
 *
 * Processes entities in batches, applying:
 * - Name normalization → canonical_name
 * - Garbage detection → is_garbage
 * - Crypto classification → crypto_status
 * - Quality scoring → quality_score (0-100)
 *
 * Usage:
 *   npx tsx workers/quality/run.ts                      # Default: all unprocessed entities
 *   npx tsx workers/quality/run.ts --limit 500          # Process up to 500
 *   npx tsx workers/quality/run.ts --country DE         # Single country
 *   npx tsx workers/quality/run.ts --force              # Re-process all (ignore last_quality_at)
 *   npx tsx workers/quality/run.ts --parser esma-unified # Single parser
 *   DRY_RUN=true npx tsx workers/quality/run.ts         # Validate without writing
 *
 * Env vars (loaded via shared/config.ts):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Related: ARCH-008, DATA-003, DATA-005, DATA-006, S4.12
 */

import { config } from '../../shared/config.js';
import { getSupabase } from '../../shared/supabase.js';
import { logger, sendTelegramAlert } from '../../shared/logger.js';
import { SYSTEM_LIMITS, enforceBatchLimit, acquireLock, releaseLock, setRuntimeTimeout, withRetry } from '../../shared/guards.js';
import { processEntity, type QualityInput, type QualityResult } from './rules.js';

const SCOPE = 'quality';
const DEFAULT_LIMIT = 5000;
const BATCH_SIZE = SYSTEM_LIMITS.SUPABASE_WRITE_BATCH;  // Supabase write chunk size

/* ── Types ── */

interface RunStats {
  total: number;
  processed: number;
  garbage: number;
  cleaned: number;
  classified: number;
  scored: number;
  errors: number;
  durationMs: number;
  tierBreakdown: Record<string, number>;
  cryptoBreakdown: Record<string, number>;
}

/* ── CLI args ── */

function parseArgs(): {
  country: string | null;
  parser: string | null;
  limit: number;
  force: boolean;
} {
  const args = process.argv.slice(2);
  let country: string | null = null;
  let parser: string | null = null;
  let limit = DEFAULT_LIMIT;
  let force = args.includes('--force');

  const countryIdx = args.indexOf('--country');
  if (countryIdx !== -1 && args[countryIdx + 1]) {
    country = args[countryIdx + 1].toUpperCase();
  }

  const parserIdx = args.indexOf('--parser');
  if (parserIdx !== -1 && args[parserIdx + 1]) {
    parser = args[parserIdx + 1];
  }

  const limitIdx = args.indexOf('--limit');
  if (limitIdx !== -1 && args[limitIdx + 1]) {
    limit = parseInt(args[limitIdx + 1], 10);
    if (isNaN(limit) || limit <= 0) limit = DEFAULT_LIMIT;
  }

  return { country, parser, limit, force };
}

/* ── Supabase operations ── */

/** Fetch entities that need quality processing (with pagination) */
async function fetchEntities(
  country: string | null,
  parser: string | null,
  limit: number,
  force: boolean,
): Promise<QualityInput[]> {
  const sb = getSupabase();

  const selectCols = [
    'id', 'name', 'country_code', 'license_number', 'license_type',
    'entity_types', 'activities', 'status', 'regulator', 'website',
    'description', 'linkedin_url', 'parser_id',
    'crypto_status', 'is_garbage', 'quality_score',
  ].join(',');

  const PAGE_SIZE = 1000; // Supabase default max
  const allEntities: QualityInput[] = [];
  let offset = 0;

  while (allEntities.length < limit) {
    const pageLimit = Math.min(PAGE_SIZE, limit - allEntities.length);

    let query = sb.from('entities').select(selectCols);

    // Only process unprocessed entities unless --force
    if (!force) {
      query = query.is('last_quality_at', null);
    }

    if (country) {
      query = query.eq('country_code', country);
    }
    if (parser) {
      query = query.eq('parser_id', parser);
    }

    query = query.order('country_code').range(offset, offset + pageLimit - 1);

    const { data, error } = await query;

    if (error) throw new Error(`Failed to fetch entities (offset ${offset}): ${error.message}`);

    const rows = data ?? [];
    if (rows.length === 0) break; // No more data

    for (const row of rows) {
      allEntities.push({
        id: row.id as string,
        name: row.name as string,
        country_code: row.country_code as string,
        license_number: (row.license_number as string) ?? '',
        license_type: (row.license_type as string | null) ?? null,
        entity_types: (row.entity_types as string[]) ?? [],
        activities: (row.activities as string[]) ?? [],
        status: (row.status as string) ?? 'Unknown',
        regulator: (row.regulator as string | null) ?? null,
        website: (row.website as string | null) ?? null,
        description: (row.description as string | null) ?? null,
        linkedin_url: (row.linkedin_url as string | null) ?? null,
        parser_id: (row.parser_id as string | null) ?? null,
        crypto_status: (row.crypto_status as string | null) ?? 'unknown',
        is_garbage: (row.is_garbage as boolean) ?? false,
        quality_score: (row.quality_score as number) ?? 0,
      });
    }

    logger.info(SCOPE, `  Fetched page: ${rows.length} entities (total: ${allEntities.length})`);

    offset += rows.length;
    if (rows.length < pageLimit) break; // Last page
  }

  return allEntities;
}

/** Write quality results back to Supabase in batches */
async function writeResults(
  results: QualityResult[],
  dryRun: boolean,
): Promise<{ written: number; errors: string[] }> {
  const sb = getSupabase();
  let written = 0;
  const errors: string[] = [];
  const now = new Date().toISOString();

  for (let i = 0; i < results.length; i += BATCH_SIZE) {
    const batch = results.slice(i, i + BATCH_SIZE);

    for (const r of batch) {
      const updates: Record<string, unknown> = {
        canonical_name: r.canonical_name,
        is_garbage: r.is_garbage,
        quality_score: r.quality_score,
        quality_flags: r.quality_flags,
        crypto_status: r.crypto_status,
        last_quality_at: now,
      };
      if (r.brand_name) {
        updates.brand_name = r.brand_name;
      }

      if (dryRun) {
        logger.debug(SCOPE, `[DRY-RUN] Would update ${r.id}: score=${r.quality_score}, crypto=${r.crypto_status}${r.is_garbage ? ' [GARBAGE]' : ''}`);
        written++;
        continue;
      }

      const { error } = await sb.from('entities').update(updates).eq('id', r.id);

      if (error) {
        errors.push(`${r.id}: ${error.message}`);
        logger.debug(SCOPE, `Write error ${r.id}: ${error.message}`);
      } else {
        written++;
      }
    }

    // Progress log every 500
    if (i > 0 && i % 500 === 0) {
      logger.info(SCOPE, `  ...wrote ${i}/${results.length}`);
    }
  }

  // Also sync crypto_related boolean
  if (!dryRun) {
    logger.info(SCOPE, 'Syncing crypto_related boolean...');
    const { error: syncErr1 } = await sb
      .from('entities')
      .update({ crypto_related: true })
      .in('crypto_status', ['confirmed_crypto', 'crypto_adjacent']);

    if (syncErr1) {
      logger.warn(SCOPE, `crypto_related sync (true) error: ${syncErr1.message}`);
    }

    const { error: syncErr2 } = await sb
      .from('entities')
      .update({ crypto_related: false })
      .in('crypto_status', ['traditional', 'unknown']);

    if (syncErr2) {
      logger.warn(SCOPE, `crypto_related sync (false) error: ${syncErr2.message}`);
    }
  }

  return { written, errors };
}

/** Log quality run to scrape_runs */
async function logQualityRun(stats: RunStats, errors: string[]): Promise<void> {
  const sb = getSupabase();

  const status = stats.errors > stats.total * 0.1 ? 'error' : stats.errors > 0 ? 'partial' : 'success';

  const { error } = await sb.from('scrape_runs').insert({
    registry_id: 'quality-worker',
    status,
    entities_found: stats.total,
    entities_new: stats.garbage,  // repurpose: garbage count
    entities_updated: stats.processed,
    entities_removed: 0,
    duration_ms: stats.durationMs,
    error_message: errors.length > 0 ? errors.slice(0, 5).join('; ') : null,
    warnings: [
      `tiers: ${JSON.stringify(stats.tierBreakdown)}`,
      `crypto: ${JSON.stringify(stats.cryptoBreakdown)}`,
    ],
    delta_percent: 0,
    created_at: new Date().toISOString(),
  });

  if (error) {
    logger.debug(SCOPE, `Scrape run log skipped: ${error.message}`);
  }
}

/* ── Main ── */

async function main() {
  const startTime = Date.now();
  const { country, parser, limit: rawLimit, force } = parseArgs();
  const dryRun = config.flags.dryRun;

  // Enforce system limits + acquire process lock + set runtime timeout
  const limit = enforceBatchLimit(rawLimit, SYSTEM_LIMITS.QUALITY_MAX_BATCH, SCOPE);
  const lockFile = acquireLock(SCOPE);
  const clearRuntimeTimeout = setRuntimeTimeout(SCOPE);

  logger.info(SCOPE, '═══════════════════════════════════════════');
  logger.info(SCOPE, '  Quality Worker — Cleanup + Classify + Score');
  logger.info(SCOPE, '═══════════════════════════════════════════');
  logger.info(SCOPE, `Config: country=${country ?? 'all'}, parser=${parser ?? 'all'}, limit=${limit}, force=${force}, dryRun=${dryRun}`);

  // 1. Fetch entities
  logger.info(SCOPE, 'Fetching entities to process...');
  const entities = await fetchEntities(country, parser, limit, force);
  logger.info(SCOPE, `Found ${entities.length} entities to process`);

  if (entities.length === 0) {
    logger.info(SCOPE, 'No entities need processing. Done.');
    return;
  }

  // Country breakdown
  const countryBreakdown = new Map<string, number>();
  entities.forEach(e => {
    countryBreakdown.set(e.country_code, (countryBreakdown.get(e.country_code) ?? 0) + 1);
  });
  const breakdown = [...countryBreakdown.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([code, count]) => `${code}:${count}`)
    .join(', ');
  logger.info(SCOPE, `Countries (top 15): ${breakdown}`);

  // 2. Process all entities
  logger.info(SCOPE, 'Processing entities...');
  const stats: RunStats = {
    total: entities.length,
    processed: 0,
    garbage: 0,
    cleaned: 0,
    classified: 0,
    scored: 0,
    errors: 0,
    durationMs: 0,
    tierBreakdown: { T1: 0, T2: 0, T3: 0, T4: 0 },
    cryptoBreakdown: {},
  };

  const results: QualityResult[] = [];

  for (const entity of entities) {
    try {
      const result = processEntity(entity);
      results.push(result);

      stats.processed++;
      if (result.is_garbage) stats.garbage++;
      if (result.canonical_name !== entity.name.trim()) stats.cleaned++;
      if (result.crypto_status !== (entity.crypto_status ?? 'unknown')) stats.classified++;
      stats.scored++;

      // Track breakdowns
      const tier = result.quality_flags.tier;
      stats.tierBreakdown[tier] = (stats.tierBreakdown[tier] ?? 0) + 1;
      stats.cryptoBreakdown[result.crypto_status] = (stats.cryptoBreakdown[result.crypto_status] ?? 0) + 1;
    } catch (err) {
      stats.errors++;
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(SCOPE, `Error processing ${entity.id}: ${msg}`);
    }
  }

  logger.info(SCOPE, `Processed ${stats.processed} entities (${stats.errors} errors)`);

  // 3. Write results
  logger.info(SCOPE, 'Writing results to Supabase...');
  const { written, errors } = await writeResults(results, dryRun);
  logger.info(SCOPE, `Written: ${written} entities updated`);

  // 4. Log run
  stats.durationMs = Date.now() - startTime;
  await logQualityRun(stats, errors);

  // 5. Summary
  logger.info(SCOPE, '');
  logger.info(SCOPE, '═══════════════════════════════════════════');
  logger.info(SCOPE, '  Quality Worker Complete');
  logger.info(SCOPE, '═══════════════════════════════════════════');
  logger.info(SCOPE, `  Total entities:    ${stats.total}`);
  logger.info(SCOPE, `  Processed:         ${stats.processed}`);
  logger.info(SCOPE, `  Names cleaned:     ${stats.cleaned}`);
  logger.info(SCOPE, `  Garbage detected:  ${stats.garbage}`);
  logger.info(SCOPE, `  Reclassified:      ${stats.classified}`);
  logger.info(SCOPE, `  DB writes:         ${written}`);
  logger.info(SCOPE, `  Errors:            ${stats.errors}`);
  logger.info(SCOPE, '');
  logger.info(SCOPE, '  Tier breakdown:');
  for (const [tier, count] of Object.entries(stats.tierBreakdown).sort()) {
    const pct = ((count / stats.processed) * 100).toFixed(1);
    logger.info(SCOPE, `    ${tier}: ${count} (${pct}%)`);
  }
  logger.info(SCOPE, '');
  logger.info(SCOPE, '  Crypto status breakdown:');
  for (const [status, count] of Object.entries(stats.cryptoBreakdown).sort((a, b) => b[1] - a[1])) {
    const pct = ((count / stats.processed) * 100).toFixed(1);
    logger.info(SCOPE, `    ${status}: ${count} (${pct}%)`);
  }
  logger.info(SCOPE, '');
  logger.info(SCOPE, `  Duration: ${(stats.durationMs / 1000).toFixed(1)}s`);
  logger.info(SCOPE, '═══════════════════════════════════════════');

  // 6. Alert on high garbage rate
  if (stats.garbage > stats.total * 0.3 && stats.total > 50) {
    await sendTelegramAlert(
      SCOPE,
      `High garbage rate: ${stats.garbage}/${stats.total} (${((stats.garbage / stats.total) * 100).toFixed(0)}%)`,
      true,
    );
  }

  // 7. Cleanup
  clearRuntimeTimeout();
  releaseLock(lockFile);
}

main().catch(async (err) => {
  logger.error(SCOPE, `Fatal: ${err.message}`);
  await sendTelegramAlert(SCOPE, `Fatal error: ${err.message}`);
  process.exit(1);
});
