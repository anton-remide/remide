/**
 * ESMA Unified Parser Runner
 *
 * Fetches the ESMA MiCAR CASP CSV once and processes ALL EU countries
 * in a single run, instead of 17+ separate parser invocations.
 *
 * Usage:
 *   npx tsx parsers/registries/esma-unified.ts
 *   npx tsx parsers/registries/esma-unified.ts --dry-run
 *   npx tsx parsers/registries/esma-unified.ts --country DE
 *   npx tsx parsers/registries/esma-unified.ts --country DE --dry-run
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { fetchAllEsmaCaspEntities } from '../core/esma-casp.js';
import type { EsmaCountryResult } from '../core/esma-casp.js';
import { upsertEntities, logScrapeRun, isDryRun, getEntityCount } from '../core/db.js';
import { verify } from '../core/validator.js';
import { logger } from '../core/logger.js';
import type { ParseResult, ScrapeRun } from '../core/types.js';

/** Registry ID prefix for ESMA unified runs */
const REGISTRY_PREFIX = 'esma-casp';

/** Build a registry ID for a specific country */
function registryId(countryCode: string): string {
  return `${REGISTRY_PREFIX}-${countryCode.toLowerCase()}`;
}

/** ANSI color helpers */
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgGreen: '\x1b[42m',
  bgRed: '\x1b[41m',
  bgYellow: '\x1b[43m',
};

/** Per-country run result for the summary */
interface CountryRunResult {
  countryCode: string;
  countryName: string;
  regulator: string;
  entitiesFound: number;
  entitiesInserted: number;
  status: 'success' | 'partial' | 'error' | 'skipped' | 'dry-run';
  durationMs: number;
  warnings: number;
  errors: string[];
}

/** Process a single country's entities */
async function processCountry(
  countryResult: EsmaCountryResult,
  sourceUrl: string,
  dryRun: boolean,
  startTime: number,
): Promise<CountryRunResult> {
  const { countryCode, countryName, regulator, entities, warnings } = countryResult;
  const rid = registryId(countryCode);
  const countryStart = Date.now();

  logger.info(rid, `Processing ${entities.length} entities for ${countryName} (${countryCode})`);

  if (warnings.length > 0) {
    logger.warn(rid, `Warnings: ${warnings.join('; ')}`);
  }

  // Build ParseResult
  const result: ParseResult = {
    registryId: rid,
    countryCode,
    entities,
    totalFound: entities.length,
    durationMs: Date.now() - startTime,
    warnings,
    errors: [],
    timestamp: new Date().toISOString(),
  };

  if (entities.length === 0) {
    const durationMs = Date.now() - countryStart;
    logger.warn(rid, `No entities found for ${countryName}`);

    if (!dryRun) {
      await logScrapeRun({
        registry_id: rid,
        status: 'error',
        entities_found: 0,
        entities_new: 0,
        entities_updated: 0,
        entities_removed: 0,
        duration_ms: durationMs,
        error_message: `No entities found for ${countryName} in ESMA register`,
        warnings,
        delta_percent: 0,
        timestamp: new Date().toISOString(),
      });
    }

    return {
      countryCode,
      countryName,
      regulator,
      entitiesFound: 0,
      entitiesInserted: 0,
      status: 'skipped',
      durationMs,
      warnings: warnings.length,
      errors: [`No entities found`],
    };
  }

  // Verify
  const previousCount = dryRun ? 0 : await getEntityCount(countryCode);
  const verification = await verify(result, previousCount);

  if (!verification.valid) {
    logger.warn(rid, `Verification: ${verification.schemaErrors.length} schema errors, anomaly=${verification.anomaly}`);
  }

  // Write to DB (unless dry-run or anomaly)
  let inserted = 0;
  let writeErrors: string[] = [];

  if (dryRun) {
    logger.info(rid, `DRY RUN: would upsert ${entities.length} entities for ${countryName}`);
  } else if (verification.anomaly) {
    logger.error(rid, `BLOCKED: anomaly (delta ${verification.deltaPercent.toFixed(1)}%), skipping write`);
    writeErrors.push(`Anomaly: ${verification.deltaPercent.toFixed(1)}% delta`);
  } else {
    // Filter out entities with missing required fields
    const validEntities = entities.filter(
      (e) => e.name?.trim() && e.licenseNumber?.trim() && e.countryCode?.length === 2,
    );
    const skipped = entities.length - validEntities.length;
    if (skipped > 0) {
      logger.warn(rid, `Filtered out ${skipped} invalid entities`);
    }

    const cleanResult = { ...result, entities: validEntities };
    const writeResult = await upsertEntities(cleanResult);
    inserted = writeResult.inserted;
    writeErrors = writeResult.errors;
  }

  // Log scrape run
  const durationMs = Date.now() - countryStart;
  const runStatus: ScrapeRun['status'] = verification.anomaly
    ? 'error'
    : writeErrors.length > 0
      ? 'partial'
      : inserted > 0
        ? 'success'
        : 'partial';

  const scrapeRun: ScrapeRun = {
    registry_id: rid,
    status: dryRun ? 'success' : runStatus,
    entities_found: entities.length,
    entities_new: inserted,
    entities_updated: 0,
    entities_removed: 0,
    duration_ms: durationMs,
    error_message: writeErrors.length > 0 ? writeErrors.join('; ') : null,
    warnings,
    delta_percent: verification.deltaPercent,
    timestamp: new Date().toISOString(),
  };

  if (!dryRun) {
    await logScrapeRun(scrapeRun);
  }

  return {
    countryCode,
    countryName,
    regulator,
    entitiesFound: entities.length,
    entitiesInserted: inserted,
    status: dryRun ? 'dry-run' : runStatus,
    durationMs,
    warnings: warnings.length,
    errors: writeErrors,
  };
}

/** Print colored summary table */
function printSummary(results: CountryRunResult[], totalDurationMs: number, sourceUrl: string): void {
  console.log('\n');
  console.log(`${c.bold}${'='.repeat(90)}${c.reset}`);
  console.log(`${c.bold}${c.cyan}  ESMA Unified Parser — Summary${c.reset}`);
  console.log(`${c.dim}  Source: ${sourceUrl}${c.reset}`);
  console.log(`${c.bold}${'='.repeat(90)}${c.reset}`);
  console.log('');

  // Header
  const hdr = `  ${'Country'.padEnd(6)} ${'Name'.padEnd(18)} ${'Regulator'.padEnd(22)} ${'Found'.padStart(6)} ${'Saved'.padStart(6)} ${'Status'.padEnd(10)} ${'Time'.padStart(7)}`;
  console.log(`${c.bold}${hdr}${c.reset}`);
  console.log(`  ${'-'.repeat(86)}`);

  // Rows sorted by entities found descending
  const sorted = [...results].sort((a, b) => b.entitiesFound - a.entitiesFound);
  let totalFound = 0;
  let totalInserted = 0;
  let successCount = 0;
  let errorCount = 0;

  for (const r of sorted) {
    totalFound += r.entitiesFound;
    totalInserted += r.entitiesInserted;
    if (r.status === 'success' || r.status === 'dry-run') successCount++;
    if (r.status === 'error') errorCount++;

    let statusColor: string;
    let statusLabel: string;
    switch (r.status) {
      case 'success':
        statusColor = c.green;
        statusLabel = 'OK';
        break;
      case 'dry-run':
        statusColor = c.cyan;
        statusLabel = 'DRY RUN';
        break;
      case 'partial':
        statusColor = c.yellow;
        statusLabel = 'PARTIAL';
        break;
      case 'error':
        statusColor = c.red;
        statusLabel = 'ERROR';
        break;
      case 'skipped':
        statusColor = c.dim;
        statusLabel = 'SKIP';
        break;
      default:
        statusColor = c.dim;
        statusLabel = r.status;
    }

    const timeStr = r.durationMs < 1000
      ? `${r.durationMs}ms`
      : `${(r.durationMs / 1000).toFixed(1)}s`;

    console.log(
      `  ${r.countryCode.padEnd(6)} ${r.countryName.padEnd(18)} ${r.regulator.padEnd(22)} ${String(r.entitiesFound).padStart(6)} ${String(r.entitiesInserted).padStart(6)} ${statusColor}${statusLabel.padEnd(10)}${c.reset} ${timeStr.padStart(7)}`,
    );
  }

  // Footer
  console.log(`  ${'-'.repeat(86)}`);
  console.log(
    `  ${'TOTAL'.padEnd(6)} ${`${sorted.length} countries`.padEnd(18)} ${''.padEnd(22)} ${String(totalFound).padStart(6)} ${String(totalInserted).padStart(6)}`,
  );
  console.log('');

  const totalTimeStr = totalDurationMs < 1000
    ? `${totalDurationMs}ms`
    : `${(totalDurationMs / 1000).toFixed(1)}s`;

  const summaryStatus = errorCount === 0
    ? `${c.bgGreen}${c.white}${c.bold} ALL OK ${c.reset}`
    : `${c.bgRed}${c.white}${c.bold} ${errorCount} ERRORS ${c.reset}`;

  console.log(`  ${summaryStatus}  ${successCount}/${sorted.length} countries processed in ${totalTimeStr}`);
  console.log('');
}

/** Main CLI entry */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--dry-run')) {
    process.env.DRY_RUN = 'true';
  }

  const dryRun = isDryRun() || args.includes('--dry-run');

  // Optional: filter to a single country
  const countryIdx = args.indexOf('--country');
  const filterCountry = countryIdx !== -1 ? (args[countryIdx + 1] ?? '').toUpperCase() : null;

  if (filterCountry && filterCountry.length !== 2) {
    console.error('Error: --country requires a 2-letter ISO country code (e.g. DE, FR, NL)');
    process.exit(1);
  }

  console.log('');
  console.log(`${c.bold}${c.cyan}ESMA Unified Parser${c.reset}`);
  console.log(`${c.dim}Mode: ${dryRun ? 'DRY RUN (no DB writes)' : 'LIVE'}${filterCountry ? ` | Country filter: ${filterCountry}` : ''}${c.reset}`);
  console.log('');

  const globalStart = Date.now();

  // Step 1: Fetch CSV once
  logger.info('esma-unified', 'Fetching ESMA CASP CSV (single download for all countries)...');
  const bulkResult = await fetchAllEsmaCaspEntities('esma-unified');
  const fetchDuration = Date.now() - globalStart;

  logger.info('esma-unified', `CSV fetched in ${(fetchDuration / 1000).toFixed(1)}s: ${bulkResult.totalRows} rows, ${bulkResult.countries.size} countries`);

  // Step 2: Determine which countries to process
  let countriesToProcess: Map<string, EsmaCountryResult>;
  if (filterCountry) {
    const countryData = bulkResult.countries.get(filterCountry);
    if (!countryData) {
      const available = [...bulkResult.countries.keys()].sort().join(', ');
      console.error(`Error: Country ${filterCountry} not found in ESMA data.`);
      console.error(`Available: ${available}`);
      process.exit(1);
    }
    countriesToProcess = new Map([[filterCountry, countryData]]);
  } else {
    countriesToProcess = bulkResult.countries;
  }

  // Step 3: Process each country sequentially
  const results: CountryRunResult[] = [];
  const total = countriesToProcess.size;
  let idx = 0;

  for (const [_cc, countryData] of countriesToProcess) {
    idx++;
    logger.info('esma-unified', `[${idx}/${total}] Processing ${countryData.countryName} (${countryData.countryCode})...`);

    try {
      const result = await processCountry(countryData, bulkResult.sourceUrl, dryRun, globalStart);
      results.push(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('esma-unified', `Failed to process ${countryData.countryName}: ${message}`);
      results.push({
        countryCode: countryData.countryCode,
        countryName: countryData.countryName,
        regulator: countryData.regulator,
        entitiesFound: countryData.entities.length,
        entitiesInserted: 0,
        status: 'error',
        durationMs: 0,
        warnings: 0,
        errors: [message],
      });
    }
  }

  // Step 4: Print summary
  const totalDuration = Date.now() - globalStart;
  printSummary(results, totalDuration, bulkResult.sourceUrl);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
