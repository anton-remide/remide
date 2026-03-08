/**
 * EBA EUCLID Parser — EU Payment Institutions Register
 *
 * Fetches the EBA EUCLID PIR (Payment Institutions Register) bulk JSON download.
 * ~318,900 total entities, filtered to ~4,500 relevant ones:
 *   - PSD_EMI:  E-money Institutions (shown on frontend)
 *   - PSD_PI:   Payment Institutions (shown on frontend)
 *   - PSD_EPI:  E-money Payment Institutions — micro-businesses (hidden from frontend, used for worker learning)
 *   - PSD_EEMI: Exempt E-money Institutions (hidden from frontend)
 *   - PSD_ENL:  Entities under National Law (hidden from frontend)
 *
 * Hidden types (EPI/EEMI/ENL) are stored with is_hidden=true so workers can learn from them.
 *
 * Excluded (not our segment):
 *   - PSD_AG:   Agents (~312K — agents of PIs, not licensed themselves)
 *   - PSD_BR:   Branches
 *   - PSD_AISP: Account Information Service Providers only
 *   - PSD_EXC:  Excluded entities
 *
 * Data source: https://euclid.eba.europa.eu/register/pir/search
 * Bulk download: metadata API → ZIP → JSON (~18 MB compressed, ~201 MB uncompressed)
 *
 * Usage:
 *   npx tsx parsers/registries/eba-euclid.ts --dry-run
 *   npx tsx parsers/registries/eba-euclid.ts
 *   npx tsx parsers/registries/eba-euclid.ts --country DE
 *   npx tsx parsers/registries/eba-euclid.ts --force
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import AdmZip from 'adm-zip';
import { upsertEntities, logScrapeRun, isDryRun, getEntityCount } from '../core/db.js';
import { verify } from '../core/validator.js';
import { logger } from '../core/logger.js';
import type { RegistryParser, ParserConfig, ParseResult, ParsedEntity, ScrapeRun } from '../core/types.js';

// ─── Constants ───────────────────────────────────────────────────────

const REGISTRY_ID = 'eba-euclid';
const METADATA_URL = 'https://euclid.eba.europa.eu/register/api/filemetadata';

/** Entity types we store — EMI + PI shown on frontend, EPI + EEMI + ENL hidden (for worker learning).
 *  EPI (micro-payment kiosks), EEMI (exempt), ENL (national law) marked is_hidden=true. */
const RELEVANT_ENTITY_TYPES = new Set([
  'PSD_EMI',   // E-money Institutions — shown
  'PSD_PI',    // Payment Institutions — shown
  'PSD_EPI',   // E-money Payment Institutions — hidden (micro-businesses, 0% crypto)
  'PSD_EEMI',  // Exempt E-money Institutions — hidden
  'PSD_ENL',   // Entities under National Law — hidden
]);

/** Entity types that should be marked as is_hidden=true after upsert */
const HIDDEN_ENTITY_TYPES = new Set([
  'PSD_EPI',
  'PSD_EEMI',
  'PSD_ENL',
]);

/** Human-readable entity type labels */
const ENTITY_TYPE_LABELS: Record<string, string> = {
  PSD_EMI:  'E-Money Institution (EMI)',
  PSD_PI:   'Payment Institution (PI)',
  PSD_EPI:  'E-Money Payment Institution (EPI)',
  PSD_EEMI: 'Exempt EMI',
  PSD_ENL:  'Entity National Law',
};

/** EBA service codes → human-readable activity names */
const SERVICE_LABELS: Record<string, string> = {
  PS_01:   'Deposit & withdrawal operations',
  PS_02:   'Payment transactions (account-based)',
  PS_03A:  'Direct debits (incl. one-off)',
  PS_03B:  'Payment card transactions',
  PS_03C:  'Credit transfers (incl. standing orders)',
  PS_04:   'Payment transactions with credit line',
  PS_05A:  'Issuing payment instruments',
  PS_05B:  'Acquiring payment transactions',
  PS_06:   'Money remittance',
  PS_07:   'Payment initiation services (PIS)',
  PS_08:   'Account information services (AIS)',
  EMS_01:  'E-money issuance',
  EMS_02:  'E-money distribution',
  EMS_03:  'E-money redemption',
};

/** Competent Authority ID → regulator name + country code */
const CA_MAP: Record<string, { regulator: string; countryCode: string; country: string }> = {
  'EU-AT-FMA':  { regulator: 'FMA', countryCode: 'AT', country: 'Austria' },
  'EU-BE-NBB':  { regulator: 'NBB', countryCode: 'BE', country: 'Belgium' },
  'EU-BG-BNB':  { regulator: 'BNB', countryCode: 'BG', country: 'Bulgaria' },
  'EU-HR-CNB':  { regulator: 'HNB', countryCode: 'HR', country: 'Croatia' },
  'EU-CY-CBC':  { regulator: 'CBC', countryCode: 'CY', country: 'Cyprus' },
  'EU-CZ-CNB':  { regulator: 'CNB', countryCode: 'CZ', country: 'Czech Republic' },
  'EU-DK-FSA':  { regulator: 'DFSA', countryCode: 'DK', country: 'Denmark' },
  'EU-EE-FSA':  { regulator: 'Finantsinspektsioon', countryCode: 'EE', country: 'Estonia' },
  'EU-FI-FSA':  { regulator: 'FIN-FSA', countryCode: 'FI', country: 'Finland' },
  'EU-FR-ACP':  { regulator: 'ACPR', countryCode: 'FR', country: 'France' },
  'EU-DE-BAF':  { regulator: 'BaFin', countryCode: 'DE', country: 'Germany' },
  'EU-GR-BOG':  { regulator: 'Bank of Greece', countryCode: 'GR', country: 'Greece' },
  'EU-HU-MNB':  { regulator: 'MNB', countryCode: 'HU', country: 'Hungary' },
  'EU-IE-CBI':  { regulator: 'CBI', countryCode: 'IE', country: 'Ireland' },
  'EU-IT-BOI':  { regulator: 'Banca d\'Italia', countryCode: 'IT', country: 'Italy' },
  'EU-LV-FKM':  { regulator: 'FKTK', countryCode: 'LV', country: 'Latvia' },
  'EU-LT-BOL':  { regulator: 'Bank of Lithuania', countryCode: 'LT', country: 'Lithuania' },
  'EU-LU-CSS':  { regulator: 'CSSF', countryCode: 'LU', country: 'Luxembourg' },
  'EU-MT-MFS':  { regulator: 'MFSA', countryCode: 'MT', country: 'Malta' },
  'EU-NL-DNB':  { regulator: 'DNB', countryCode: 'NL', country: 'Netherlands' },
  'EU-PL-KNF':  { regulator: 'KNF', countryCode: 'PL', country: 'Poland' },
  'EU-PT-BDP':  { regulator: 'Banco de Portugal', countryCode: 'PT', country: 'Portugal' },
  'EU-RO-NBR':  { regulator: 'NBR', countryCode: 'RO', country: 'Romania' },
  'EU-SK-NBS':  { regulator: 'NBS', countryCode: 'SK', country: 'Slovakia' },
  'EU-SI-BOS':  { regulator: 'Banka Slovenije', countryCode: 'SI', country: 'Slovenia' },
  'EU-ES-BDE':  { regulator: 'Banco de España', countryCode: 'ES', country: 'Spain' },
  'EU-SE-FSA':  { regulator: 'Finansinspektionen', countryCode: 'SE', country: 'Sweden' },
  // EEA (non-EU)
  'EU-IS-FME':  { regulator: 'FME', countryCode: 'IS', country: 'Iceland' },
  'EU-LI-FMA':  { regulator: 'FMA LI', countryCode: 'LI', country: 'Liechtenstein' },
  'EU-NO-FSA':  { regulator: 'Finanstilsynet', countryCode: 'NO', country: 'Norway' },
};

// ─── ANSI helpers ────────────────────────────────────────────────────

const c = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m',
  cyan: '\x1b[36m', white: '\x1b[37m',
  bgGreen: '\x1b[42m', bgRed: '\x1b[41m',
};

// ─── Types for EBA JSON ──────────────────────────────────────────────

/** Single property in EBA JSON: { "PROP_CODE": value } — value can be string, number, object, etc. */
type EbaProperty = Record<string, unknown>;

/** EBA entity record structure */
interface EbaEntity {
  EntityCode: string;
  EntityType: string;
  CA_OwnerID: string;
  Properties: EbaProperty[];
  Services: EbaService[] | null;
}

interface EbaService {
  ServiceCode: string;
  ServiceName?: string;
}

/** Metadata API response (single object for PIR register) */
interface EbaFileMetadata {
  golden_copy_path_context: string;
  latest_version_relative_zip_path: string;
  latest_version_relative_zip_size: string;
  latest_version_relative_sha256_path: string;
  sha256_hash: string;
  timestamp: string;
}

// ─── Per-country result ──────────────────────────────────────────────

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

// ─── Helpers ─────────────────────────────────────────────────────────

/** Extract a property value from EBA Properties array */
function getProp(props: EbaProperty[], code: string): string | undefined {
  for (const p of props) {
    if (code in p) {
      const val = p[code];
      if (val == null) return undefined;
      return String(val);
    }
  }
  return undefined;
}

/** Map authorization status to our status */
function mapAuthStatus(raw: unknown): string {
  if (!raw) return 'Licensed';
  const str = String(raw);
  const lower = str.toLowerCase();
  if (lower.includes('authorised') || lower.includes('authorized') || lower.includes('licensed')) return 'Licensed';
  if (lower.includes('registered')) return 'Registered';
  if (lower.includes('withdrawn') || lower.includes('revoked')) return 'Unknown';
  return 'Licensed';
}

/** Resolve CA_OwnerID to country info, with fallback to ENT_COU_RES property */
function resolveCountry(entity: EbaEntity): { countryCode: string; country: string; regulator: string } | null {
  // Try CA_OwnerID first
  const caInfo = CA_MAP[entity.CA_OwnerID];
  if (caInfo) return caInfo;

  // Fallback: parse ENT_COU_RES (country of residence) from Properties
  const couRes = getProp(entity.Properties, 'ENT_COU_RES');
  if (couRes && couRes.length === 2) {
    return {
      countryCode: couRes.toUpperCase(),
      country: couRes.toUpperCase(), // Will be resolved via DB
      regulator: entity.CA_OwnerID || 'Unknown NCA',
    };
  }

  return null;
}

/** Map EBA services to human-readable activities */
function mapServices(services: EbaService[] | null): string[] {
  if (!services || services.length === 0) return [];

  return services
    .map(s => SERVICE_LABELS[s.ServiceCode] ?? s.ServiceCode)
    .filter(Boolean);
}

/** Build a per-country registry ID */
function countryRegistryId(countryCode: string): string {
  return `eba-${countryCode.toLowerCase()}`;
}

// ─── Parser class ────────────────────────────────────────────────────

export class EbaEuclidParser implements RegistryParser {
  config: ParserConfig = {
    id: REGISTRY_ID,
    name: 'EBA EUCLID — EU Payment Institutions Register (EMI + PI + EPI + EEMI + ENL)',
    countryCode: 'EU',
    country: 'European Union',
    regulator: 'EBA + NCAs',
    url: 'https://euclid.eba.europa.eu/register/pir/search',
    sourceType: 'api',
    rateLimit: 5_000,
    needsProxy: false,
    needsBrowser: false,
  };

  async parse(): Promise<ParseResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const errors: string[] = [];

    logger.info(this.config.id, 'Starting EBA EUCLID fetch...');

    const { entities, stats } = await fetchAndFilterEbaEntities(this.config.id);

    for (const [type, count] of Object.entries(stats.byType)) {
      logger.info(this.config.id, `  ${type}: ${count} entities`);
    }
    logger.info(this.config.id, `  TOTAL: ${entities.length} entities from ${stats.countryCount} countries`);

    return {
      registryId: this.config.id,
      countryCode: 'EU',
      entities,
      totalFound: entities.length,
      durationMs: Date.now() - startTime,
      warnings,
      errors,
      timestamp: new Date().toISOString(),
    };
  }
}

// ─── Core: fetch, extract, parse ─────────────────────────────────────

interface EbaFetchResult {
  entities: ParsedEntity[];
  byCountry: Map<string, {
    countryCode: string;
    countryName: string;
    regulator: string;
    entities: ParsedEntity[];
    warnings: string[];
  }>;
  stats: {
    totalRaw: number;
    totalFiltered: number;
    byType: Record<string, number>;
    countryCount: number;
    skippedNoCountry: number;
    skippedAgents: number;
  };
}

async function fetchAndFilterEbaEntities(registryId: string): Promise<EbaFetchResult> {
  // Step 1: Get metadata to find current download URL
  logger.info(registryId, 'Fetching file metadata from EBA...');
  const metadataResp = await fetch(METADATA_URL, {
    headers: { Accept: 'application/json' },
  });
  if (!metadataResp.ok) {
    throw new Error(`Metadata API failed: HTTP ${metadataResp.status}`);
  }
  const pirMeta: EbaFileMetadata = await metadataResp.json() as EbaFileMetadata;

  if (!pirMeta.golden_copy_path_context || !pirMeta.latest_version_relative_zip_path) {
    throw new Error(`Invalid metadata response: missing download paths. Keys: ${Object.keys(pirMeta).join(', ')}`);
  }

  // Construct download URL
  const downloadUrl = `${pirMeta.golden_copy_path_context}${pirMeta.latest_version_relative_zip_path}`;
  logger.info(registryId, `Download URL: ${downloadUrl}`);
  logger.info(registryId, `Data timestamp: ${pirMeta.timestamp}`);
  logger.info(registryId, `ZIP size: ${(parseInt(pirMeta.latest_version_relative_zip_size) / 1024 / 1024).toFixed(1)} MB`);

  // Step 2: Download ZIP
  logger.info(registryId, 'Downloading ZIP file (~18 MB)...');
  const zipResp = await fetch(downloadUrl);
  if (!zipResp.ok) {
    throw new Error(`Download failed: HTTP ${zipResp.status} from ${downloadUrl}`);
  }
  const zipBuffer = Buffer.from(await zipResp.arrayBuffer());
  logger.info(registryId, `ZIP downloaded: ${(zipBuffer.length / 1024 / 1024).toFixed(1)} MB`);

  // Step 3: Extract JSON from ZIP
  logger.info(registryId, 'Extracting JSON from ZIP...');
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();
  const jsonEntry = entries.find(e => e.entryName.endsWith('.json'));
  if (!jsonEntry) {
    throw new Error(`No JSON file in ZIP. Contents: ${entries.map(e => e.entryName).join(', ')}`);
  }

  const jsonBuffer = jsonEntry.getData();
  logger.info(registryId, `JSON extracted: ${(jsonBuffer.length / 1024 / 1024).toFixed(1)} MB (${jsonEntry.entryName})`);

  // Step 4: Parse JSON — structure: [[disclaimer], [entities]]
  logger.info(registryId, 'Parsing JSON...');
  const rawData = JSON.parse(jsonBuffer.toString('utf-8')) as [unknown[], EbaEntity[]];

  if (!Array.isArray(rawData) || rawData.length < 2) {
    throw new Error(`Unexpected JSON structure: expected [[disclaimer], [entities]], got array length ${rawData.length}`);
  }

  const allEntities = rawData[1];
  if (!Array.isArray(allEntities)) {
    throw new Error(`Expected array of entities at index 1, got ${typeof allEntities}`);
  }

  logger.info(registryId, `Total raw entities: ${allEntities.length}`);

  // Step 5: Filter and transform
  const byType: Record<string, number> = {};
  const byTypeAll: Record<string, number> = {};
  let skippedNoCountry = 0;
  let skippedAgents = 0;

  const byCountry = new Map<string, {
    countryCode: string;
    countryName: string;
    regulator: string;
    entities: ParsedEntity[];
    warnings: string[];
  }>();

  const parsedEntities: ParsedEntity[] = [];

  for (const entity of allEntities) {
    // Count all types for stats
    byTypeAll[entity.EntityType] = (byTypeAll[entity.EntityType] ?? 0) + 1;

    // Filter by type
    if (!RELEVANT_ENTITY_TYPES.has(entity.EntityType)) {
      if (entity.EntityType === 'PSD_AG') skippedAgents++;
      continue;
    }

    // Resolve country
    const countryInfo = resolveCountry(entity);
    if (!countryInfo) {
      skippedNoCountry++;
      continue;
    }

    // Extract properties
    const props = entity.Properties;
    const name = getProp(props, 'ENT_NAM') ?? getProp(props, 'ENT_NAM_COM') ?? '';
    const tradeName = getProp(props, 'ENT_NAM_COM');
    const licenseNumber = getProp(props, 'ENT_NAT_REF_COD') ?? entity.EntityCode;
    const authStatus = getProp(props, 'ENT_AUT');
    const address = getProp(props, 'ENT_ADD');
    const city = getProp(props, 'ENT_TOW_CIT_RES');
    const postalCode = getProp(props, 'ENT_POS_COD');

    if (!name.trim()) continue;

    // Map services to activities
    const activities = mapServices(entity.Services);

    // Build ParsedEntity
    const parsed: ParsedEntity = {
      name: name.trim(),
      licenseNumber: licenseNumber.trim() || entity.EntityCode,
      countryCode: countryInfo.countryCode,
      country: countryInfo.country,
      licenseType: ENTITY_TYPE_LABELS[entity.EntityType] ?? entity.EntityType,
      entityTypes: [entity.EntityType],
      activities,
      status: mapAuthStatus(authStatus),
      regulator: countryInfo.regulator,
      website: undefined,
      sourceUrl: 'https://euclid.eba.europa.eu/register/pir/search',
    };

    parsedEntities.push(parsed);

    // Group by country
    byType[entity.EntityType] = (byType[entity.EntityType] ?? 0) + 1;

    if (!byCountry.has(countryInfo.countryCode)) {
      byCountry.set(countryInfo.countryCode, {
        countryCode: countryInfo.countryCode,
        countryName: countryInfo.country,
        regulator: countryInfo.regulator,
        entities: [],
        warnings: [],
      });
    }
    byCountry.get(countryInfo.countryCode)!.entities.push(parsed);
  }

  // Log type distribution
  logger.info(registryId, 'Entity type distribution (all):');
  for (const [type, count] of Object.entries(byTypeAll).sort((a, b) => b[1] - a[1])) {
    const relevant = RELEVANT_ENTITY_TYPES.has(type) ? ' ✓' : ' (skip)';
    logger.info(registryId, `  ${type}: ${count}${relevant}`);
  }

  logger.info(registryId, `Filtered: ${parsedEntities.length} relevant entities from ${byCountry.size} countries`);
  if (skippedNoCountry > 0) {
    logger.warn(registryId, `Skipped ${skippedNoCountry} entities: could not resolve country`);
  }
  logger.info(registryId, `Skipped ${skippedAgents} agent entities (PSD_AG)`);

  return {
    entities: parsedEntities,
    byCountry,
    stats: {
      totalRaw: allEntities.length,
      totalFiltered: parsedEntities.length,
      byType,
      countryCount: byCountry.size,
      skippedNoCountry,
      skippedAgents,
    },
  };
}

// ─── Mark hidden entities (EPI/EEMI/ENL) ─────────────────────────────

const HIDDEN_REASON_MAP: Record<string, string> = {
  'E-Money Payment Institution (EPI)': 'epi_micro',
  'Exempt EMI': 'exempt_emi',
  'Entity National Law': 'enl_national',
};

async function markHiddenEntities(countryCode: string, registryId: string): Promise<void> {
  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(
    process.env.VITE_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  );

  for (const [licenseType, reason] of Object.entries(HIDDEN_REASON_MAP)) {
    const { count, error } = await sb
      .from('entities')
      .update({ is_hidden: true, hidden_reason: reason })
      .eq('country_code', countryCode)
      .eq('parser_id', registryId)
      .eq('license_type', licenseType)
      .eq('is_hidden', false);

    if (error) {
      logger.warn(registryId, `Failed to mark hidden (${licenseType}): ${error.message}`);
    } else if (count && count > 0) {
      logger.info(registryId, `  Marked ${count} ${licenseType} as hidden (${reason})`);
    }
  }
}

// ─── Process per-country ─────────────────────────────────────────────

async function processCountry(
  countryData: { countryCode: string; countryName: string; regulator: string; entities: ParsedEntity[]; warnings: string[] },
  dryRun: boolean,
  globalStart: number,
): Promise<CountryRunResult> {
  const { countryCode, countryName, regulator, entities, warnings } = countryData;
  const rid = countryRegistryId(countryCode);
  const countryStart = Date.now();

  // Count by type
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

  // Verify
  const previousCount = dryRun ? 0 : await getEntityCount(countryCode);
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

    // Mark hidden entity types (EPI, EEMI, ENL) — valid data but not shown on frontend
    if (inserted > 0) {
      await markHiddenEntities(countryCode, rid);
    }
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

// ─── Summary printer ─────────────────────────────────────────────────

function printSummary(results: CountryRunResult[], totalDurationMs: number, stats: EbaFetchResult['stats']): void {
  console.log('\n');
  console.log(`${c.bold}${'='.repeat(100)}${c.reset}`);
  console.log(`${c.bold}${c.cyan}  EBA EUCLID Parser — EU Payment Institutions Register${c.reset}`);
  console.log(`${c.bold}${'='.repeat(100)}${c.reset}`);

  // Type summary
  console.log(`\n${c.bold}  Entity Types (filtered):${c.reset}`);
  for (const [type, count] of Object.entries(stats.byType).sort((a, b) => b[1] - a[1])) {
    const label = ENTITY_TYPE_LABELS[type] ?? type;
    console.log(`    ${c.green}✓${c.reset} ${label.padEnd(40)} ${String(count).padStart(6)}`);
  }
  console.log(`    ${c.dim}Total raw: ${stats.totalRaw.toLocaleString()} | Filtered: ${stats.totalFiltered.toLocaleString()} | Agents skipped: ${stats.skippedAgents.toLocaleString()}${c.reset}`);

  // Country table
  console.log(`\n${c.bold}  Per-Country Breakdown:${c.reset}`);
  const hdr = `  ${'CC'.padEnd(4)} ${'Country'.padEnd(22)} ${'Found'.padStart(6)} ${'Saved'.padStart(6)} ${'EMI'.padStart(5)} ${'PI'.padStart(5)} ${'EPI'.padStart(6)} ${'EEMI'.padStart(5)} ${'ENL'.padStart(5)} ${'Status'.padEnd(10)}`;
  console.log(`${c.bold}${hdr}${c.reset}`);
  console.log(`  ${'-'.repeat(96)}`);

  const sorted = [...results].sort((a, b) => b.entitiesFound - a.entitiesFound);
  let totalFound = 0;
  let totalInserted = 0;

  for (const r of sorted) {
    totalFound += r.entitiesFound;
    totalInserted += r.entitiesInserted;

    const statusColor = r.status === 'success' || r.status === 'dry-run' ? c.green
      : r.status === 'error' ? c.red
      : r.status === 'partial' ? c.yellow : c.dim;

    const emi = r.byType['E-Money Institution (EMI)'] ?? 0;
    const pi = r.byType['Payment Institution (PI)'] ?? 0;
    const epi = r.byType['E-Money Payment Institution (EPI)'] ?? 0;
    const eemi = r.byType['Exempt EMI'] ?? 0;
    const enl = r.byType['Entity National Law'] ?? 0;

    console.log(
      `  ${r.countryCode.padEnd(4)} ${r.countryName.substring(0, 22).padEnd(22)} ${String(r.entitiesFound).padStart(6)} ${String(r.entitiesInserted).padStart(6)} ${String(emi).padStart(5)} ${String(pi).padStart(5)} ${String(epi).padStart(6)} ${String(eemi).padStart(5)} ${String(enl).padStart(5)} ${statusColor}${r.status.toUpperCase().padEnd(10)}${c.reset}`,
    );
  }

  console.log(`  ${'-'.repeat(96)}`);
  console.log(`  ${''.padEnd(4)} ${'TOTAL'.padEnd(22)} ${String(totalFound).padStart(6)} ${String(totalInserted).padStart(6)}`);
  console.log('');

  const timeStr = `${(totalDurationMs / 1000).toFixed(1)}s`;
  const ok = results.filter(r => r.status === 'success' || r.status === 'dry-run').length;
  console.log(`  ${c.bold}${ok}/${sorted.length} countries${c.reset} processed in ${timeStr}`);
  console.log('');
}

// ─── Main CLI ────────────────────────────────────────────────────────

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
  console.log(`${c.bold}${c.cyan}EBA EUCLID Parser — EMI + PI + EPI + EEMI + ENL${c.reset}`);
  console.log(`${c.dim}Mode: ${dryRun ? 'DRY RUN (no DB writes)' : 'LIVE'}${forceWrite ? ' + FORCE' : ''}${filterCountry ? ` | Country filter: ${filterCountry}` : ''}${c.reset}`);
  console.log('');

  const globalStart = Date.now();

  // Step 1: Fetch and filter all entities
  logger.info(REGISTRY_ID, 'Fetching EBA EUCLID data...');
  const fetchResult = await fetchAndFilterEbaEntities(REGISTRY_ID);
  const fetchDuration = Date.now() - globalStart;
  logger.info(REGISTRY_ID, `Data fetched in ${(fetchDuration / 1000).toFixed(1)}s: ${fetchResult.stats.totalRaw.toLocaleString()} raw → ${fetchResult.entities.length.toLocaleString()} filtered`);

  // Step 2: Determine which countries to process
  let countriesToProcess: typeof fetchResult.byCountry;
  if (filterCountry) {
    const countryData = fetchResult.byCountry.get(filterCountry);
    if (!countryData) {
      const available = [...fetchResult.byCountry.keys()].sort().join(', ');
      console.error(`Error: Country ${filterCountry} not found. Available: ${available}`);
      process.exit(1);
    }
    countriesToProcess = new Map([[filterCountry, countryData]]);
  } else {
    countriesToProcess = fetchResult.byCountry;
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
  printSummary(results, totalDuration, fetchResult.stats);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
