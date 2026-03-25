/**
 * ESMA Unified Parser — All MiCA Register Types
 *
 * Fetches ALL ESMA MiCA CSV registers in one run:
 *   - CASPS.csv  — Crypto-Asset Service Providers (CASPs)
 *   - EMTWP.csv  — E-Money Token issuers (stablecoin issuers under MiCA)
 *   - ARTZZ.csv  — Asset-Referenced Token issuers
 *   - NCASP.csv  — Non-compliant entities (warnings)
 *
 * One CSV per type × 28 EU/EEA countries = comprehensive EU coverage.
 * Replaces running per-country ESMA parsers individually.
 *
 * Usage:
 *   npx tsx parsers/registries/esma-unified.ts --dry-run
 *   npx tsx parsers/registries/esma-unified.ts
 *   npx tsx parsers/registries/esma-unified.ts --country DE
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { fetchAllEsmaRegisters, type EsmaRegisterType } from '../core/esma-casp.js';
import type { EsmaCountryResult } from '../core/esma-casp.js';
import { upsertEntities, logScrapeRun, isDryRun, getEntityCount } from '../core/db.js';
import { verify } from '../core/validator.js';
import { logger } from '../core/logger.js';
import type { RegistryParser, ParserConfig, ParseResult, ParsedEntity, ScrapeRun } from '../core/types.js';

/** Registry ID for unified runs */
const REGISTRY_ID = 'esma-unified';

/** Build a registry ID for a specific country */
function countryRegistryId(countryCode: string): string {
  return `esma-${countryCode.toLowerCase()}`;
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
};

/** Per-country run result for the summary */
interface CountryRunResult {
  countryCode: string;
  countryName: string;
  regulator: string;
  entitiesFound: number;
  entitiesInserted: number;
  byType: Record<string, number>;
  status: 'success' | 'partial' | 'error' | 'skipped' | 'dry-run';
  durationMs: number;
  warnings: number;
  errors: string[];
}

/** Parser class (can be registered in run.ts) */
export class EsmaUnifiedParser implements RegistryParser {
  config: ParserConfig = {
    id: REGISTRY_ID,
    name: 'ESMA Unified MiCA Registers (CASP + EMT + ART + NCASP)',
    countryCode: 'EU',
    country: 'European Union',
    regulator: 'ESMA + NCAs',
    url: 'https://www.esma.europa.eu/',
    sourceType: 'csv',
    rateLimit: 5_000,
    needsProxy: false,
    needsBrowser: false,
  };

  async parse(): Promise<ParseResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const errors: string[] = [];

    logger.info(this.config.id, 'Starting ESMA unified fetch (CASP + EMTWP + ARTZZ + NCASP)...');

    const result = await fetchAllEsmaRegisters(this.config.id);

    // Collect all entities across all countries and types
    const allEntities: ParsedEntity[] = [];
    for (const [, countryResult] of result.mergedByCountry) {
      allEntities.push(...countryResult.entities);
      warnings.push(...countryResult.warnings);
    }

    // Log type summary
    for (const s of result.typeSummary) {
      logger.info(this.config.id, `  ${s.type}: ${s.entities} entities from ${s.countries} countries`);
    }
    logger.info(this.config.id, `  TOTAL: ${allEntities.length} entities from ${result.mergedByCountry.size} countries`);

    return {
      registryId: this.config.id,
      countryCode: 'EU',
      entities: allEntities,
      totalFound: allEntities.length,
      durationMs: Date.now() - startTime,
      warnings,
      errors,
      timestamp: new Date().toISOString(),
    };
  }
}

/** Process a single country's entities and write to DB */
async function processCountry(
  countryResult: EsmaCountryResult,
  dryRun: boolean,
  globalStart: number,
): Promise<CountryRunResult> {
  const { countryCode, countryName, regulator, entities, warnings } = countryResult;
  const rid = countryRegistryId(countryCode);
  const countryStart = Date.now();

  // Count by license type
  const byType: Record<string, number> = {};
  for (const e of entities) {
    const t = e.licenseType ?? 'Unknown';
    byType[t] = (byType[t] ?? 0) + 1;
  }

  logger.info(rid, `Processing ${entities.length} entities for ${countryName} (${Object.entries(byType).map(([t, n]) => `${t}: ${n}`).join(', ')})`);

  if (entities.length === 0) {
    return {
      countryCode, countryName, regulator,
      entitiesFound: 0, entitiesInserted: 0, byType,
      status: 'skipped', durationMs: Date.now() - countryStart,
      warnings: warnings.length, errors: ['No entities found'],
    };
  }

  // Build ParseResult
  const result: ParseResult = {
    registryId: rid,
    countryCode,
    entities,
    totalFound: entities.length,
    durationMs: Date.now() - globalStart,
    warnings,
    errors: [],
    timestamp: new Date().toISOString(),
  };

  // Verify (scope to this parser's entities, not all country entities)
  const previousCount = dryRun ? 0 : await getEntityCount(countryCode, rid);
  const verification = await verify(result, previousCount);

  // Write to DB
  let inserted = 0;
  const writeErrors: string[] = [];
  const forceMode = process.env.FORCE_WRITE === 'true';

  if (forceMode && verification.anomaly) {
    logger.warn(rid, `FORCE: ignoring anomaly (delta ${verification.deltaPercent.toFixed(1)}%)`);
  }

  if (dryRun) {
    logger.info(rid, `DRY RUN: would upsert ${entities.length} entities`);
  } else if (verification.anomaly && !forceMode) {
    logger.error(rid, `BLOCKED: anomaly (delta ${verification.deltaPercent.toFixed(1)}%)`);
    writeErrors.push(`Anomaly: ${verification.deltaPercent.toFixed(1)}% delta`);
  } else {
    const validEntities = entities.filter(
      (e) => e.name?.trim() && e.licenseNumber?.trim() && e.countryCode?.length === 2,
    );
    const skipped = entities.length - validEntities.length;
    if (skipped > 0) logger.warn(rid, `Filtered out ${skipped} invalid entities`);

    const writeResult = await upsertEntities({ ...result, entities: validEntities });
    inserted = writeResult.inserted;
    writeErrors.push(...writeResult.errors);
  }

  // Log scrape run
  const durationMs = Date.now() - countryStart;
  const runStatus: ScrapeRun['status'] = (verification.anomaly && !forceMode)
    ? 'error'
    : writeErrors.length > 0 ? 'partial'
    : inserted > 0 ? 'success' : 'partial';

  if (!dryRun) {
    await logScrapeRun({
      registry_id: rid,
      status: runStatus,
      entities_found: entities.length,
      entities_new: inserted,
      entities_updated: 0,
      entities_removed: 0,
      duration_ms: durationMs,
      error_message: writeErrors.length > 0 ? writeErrors.join('; ') : null,
      warnings,
      delta_percent: verification.deltaPercent,
      timestamp: new Date().toISOString(),
    });
  }

  return {
    countryCode, countryName, regulator,
    entitiesFound: entities.length, entitiesInserted: inserted, byType,
    status: dryRun ? 'dry-run' : runStatus,
    durationMs, warnings: warnings.length, errors: writeErrors,
  };
}

/** Print colored summary table */
function printSummary(results: CountryRunResult[], totalDurationMs: number, typeSummary: { type: EsmaRegisterType; rows: number; entities: number; countries: number }[]): void {
  console.log('\n');
  console.log(`${c.bold}${'='.repeat(100)}${c.reset}`);
  console.log(`${c.bold}${c.cyan}  ESMA Unified Parser — All MiCA Register Types${c.reset}`);
  console.log(`${c.bold}${'='.repeat(100)}${c.reset}`);

  // Type summary
  console.log(`\n${c.bold}  Register Types:${c.reset}`);
  for (const s of typeSummary) {
    const icon = s.entities > 0 ? `${c.green}✓${c.reset}` : `${c.dim}✗${c.reset}`;
    console.log(`    ${icon} ${s.type.padEnd(8)} ${String(s.entities).padStart(5)} entities  ${String(s.countries).padStart(3)} countries  (${s.rows} CSV rows)`);
  }

  // Country table
  console.log(`\n${c.bold}  Per-Country Breakdown:${c.reset}`);
  const hdr = `  ${'CC'.padEnd(4)} ${'Country'.padEnd(18)} ${'Found'.padStart(6)} ${'Saved'.padStart(6)} ${'CASP'.padStart(5)} ${'EMT'.padStart(5)} ${'ART'.padStart(5)} ${'NCASP'.padStart(6)} ${'Status'.padEnd(10)}`;
  console.log(`${c.bold}${hdr}${c.reset}`);
  console.log(`  ${'-'.repeat(94)}`);

  const sorted = [...results].sort((a, b) => b.entitiesFound - a.entitiesFound);
  let totalFound = 0;
  let totalInserted = 0;

  for (const r of sorted) {
    totalFound += r.entitiesFound;
    totalInserted += r.entitiesInserted;

    const statusColor = r.status === 'success' || r.status === 'dry-run' ? c.green
      : r.status === 'error' ? c.red
      : r.status === 'partial' ? c.yellow : c.dim;

    const casp = r.byType['MiCAR CASP'] ?? 0;
    const emt = r.byType['MiCAR EMT Issuer'] ?? 0;
    const art = r.byType['MiCAR ART Issuer'] ?? 0;
    const ncasp = r.byType['Non-Compliant CASP (Warning)'] ?? 0;

    console.log(
      `  ${r.countryCode.padEnd(4)} ${r.countryName.padEnd(18)} ${String(r.entitiesFound).padStart(6)} ${String(r.entitiesInserted).padStart(6)} ${String(casp).padStart(5)} ${String(emt).padStart(5)} ${String(art).padStart(5)} ${String(ncasp).padStart(6)} ${statusColor}${r.status.toUpperCase().padEnd(10)}${c.reset}`,
    );
  }

  console.log(`  ${'-'.repeat(94)}`);
  console.log(`  ${''.padEnd(4)} ${'TOTAL'.padEnd(18)} ${String(totalFound).padStart(6)} ${String(totalInserted).padStart(6)}`);
  console.log('');

  const timeStr = `${(totalDurationMs / 1000).toFixed(1)}s`;
  const ok = results.filter(r => r.status === 'success' || r.status === 'dry-run').length;
  console.log(`  ${c.bold}${ok}/${sorted.length} countries${c.reset} processed in ${timeStr}`);
  console.log('');
}

/** Main CLI entry */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--dry-run')) {
    process.env.DRY_RUN = 'true';
  }
  if (args.includes('--force')) {
    process.env.FORCE_WRITE = 'true';
  }

  const dryRun = isDryRun() || args.includes('--dry-run');
  const forceWrite = process.env.FORCE_WRITE === 'true';

  // Optional: filter to a single country
  const countryIdx = args.indexOf('--country');
  const filterCountry = countryIdx !== -1 ? (args[countryIdx + 1] ?? '').toUpperCase() : null;

  console.log('');
  console.log(`${c.bold}${c.cyan}ESMA Unified Parser — CASP + EMT + ART + NCASP${c.reset}`);
  console.log(`${c.dim}Mode: ${dryRun ? 'DRY RUN (no DB writes)' : 'LIVE'}${forceWrite ? ' + FORCE' : ''}${filterCountry ? ` | Country filter: ${filterCountry}` : ''}${c.reset}`);
  console.log('');

  const globalStart = Date.now();

  // Step 1: Fetch ALL register types at once
  logger.info(REGISTRY_ID, 'Fetching all ESMA MiCA registers...');
  const fullResult = await fetchAllEsmaRegisters(REGISTRY_ID);
  const fetchDuration = Date.now() - globalStart;
  logger.info(REGISTRY_ID, `All CSVs fetched in ${(fetchDuration / 1000).toFixed(1)}s: ${fullResult.totalEntities} entities total`);

  // Step 2: Determine which countries to process
  let countriesToProcess: Map<string, EsmaCountryResult>;
  if (filterCountry) {
    const countryData = fullResult.mergedByCountry.get(filterCountry);
    if (!countryData) {
      const available = [...fullResult.mergedByCountry.keys()].sort().join(', ');
      console.error(`Error: Country ${filterCountry} not found. Available: ${available}`);
      process.exit(1);
    }
    countriesToProcess = new Map([[filterCountry, countryData]]);
  } else {
    countriesToProcess = fullResult.mergedByCountry;
  }

  // Step 3: Process each country sequentially
  const results: CountryRunResult[] = [];
  const total = countriesToProcess.size;
  let idx = 0;

  for (const [, countryData] of countriesToProcess) {
    idx++;
    logger.info(REGISTRY_ID, `[${idx}/${total}] ${countryData.countryName} (${countryData.countryCode}): ${countryData.entities.length} entities`);

    try {
      const result = await processCountry(countryData, dryRun, globalStart);
      results.push(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(REGISTRY_ID, `Failed: ${countryData.countryName}: ${message}`);
      results.push({
        countryCode: countryData.countryCode,
        countryName: countryData.countryName,
        regulator: countryData.regulator,
        entitiesFound: countryData.entities.length,
        entitiesInserted: 0,
        byType: {},
        status: 'error',
        durationMs: 0,
        warnings: 0,
        errors: [message],
      });
    }
  }

  // Step 4: Print summary
  const totalDuration = Date.now() - globalStart;
  printSummary(results, totalDuration, fullResult.typeSummary);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
