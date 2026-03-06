/**
 * Shared ESMA MiCA Register parser — supports ALL register types.
 *
 * ESMA publishes 4 CSV registers under MiCA:
 *   - CASPS.csv  — Crypto-Asset Service Providers (CASPs)
 *   - EMTWP.csv  — E-Money Token (EMT) issuers + white papers
 *   - ARTZZ.csv  — Asset-Referenced Token (ART) issuers
 *   - NCASP.csv  — Non-compliant entities (warnings/infringements)
 *
 * Source: https://www.esma.europa.eu/
 * Updated: weekly (files updated in-place, URL path stays at 2024-12)
 */

import { fetchAndParseCsv, type CsvRow } from './csv-parser.js';
import { logger } from './logger.js';
import type { ParsedEntity } from './types.js';

/** Supported ESMA MiCA register types */
export type EsmaRegisterType = 'CASP' | 'EMTWP' | 'ARTZZ' | 'NCASP';

/**
 * Known ESMA CSV URLs per register type.
 * The 2024-12 path is stable (files updated in-place weekly).
 * Extra monthly URLs as fallback in case ESMA changes the path.
 */
const ESMA_REGISTER_URLS: Record<EsmaRegisterType, string[]> = {
  CASP: [
    'https://www.esma.europa.eu/sites/default/files/2024-12/CASPS.csv',
    'https://www.esma.europa.eu/sites/default/files/2025-03/CASPS.csv',
    'https://www.esma.europa.eu/sites/default/files/2025-02/CASPS.csv',
    'https://www.esma.europa.eu/sites/default/files/2025-01/CASPS.csv',
  ],
  EMTWP: [
    'https://www.esma.europa.eu/sites/default/files/2024-12/EMTWP.csv',
    'https://www.esma.europa.eu/sites/default/files/2025-03/EMTWP.csv',
  ],
  ARTZZ: [
    'https://www.esma.europa.eu/sites/default/files/2024-12/ARTZZ.csv',
    'https://www.esma.europa.eu/sites/default/files/2025-03/ARTZZ.csv',
  ],
  NCASP: [
    'https://www.esma.europa.eu/sites/default/files/2024-12/NCASP.csv',
    'https://www.esma.europa.eu/sites/default/files/2025-03/NCASP.csv',
  ],
};

/** License type labels per register */
const LICENSE_TYPES: Record<EsmaRegisterType, string> = {
  CASP: 'MiCAR CASP',
  EMTWP: 'MiCAR EMT Issuer',
  ARTZZ: 'MiCAR ART Issuer',
  NCASP: 'Non-Compliant CASP (Warning)',
};

/** Human-readable descriptions per register */
const REGISTER_DESCRIPTIONS: Record<EsmaRegisterType, string> = {
  CASP: 'Crypto-Asset Service Provider',
  EMTWP: 'E-Money Token Issuer',
  ARTZZ: 'Asset-Referenced Token Issuer',
  NCASP: 'Non-Compliant Entity',
};

// Keep backward-compatible alias
const ESMA_CSV_URLS = ESMA_REGISTER_URLS.CASP;

/** Try fetching an ESMA CSV from known URLs for a given register type */
async function fetchEsmaCsv(
  registryId: string,
  registerType: EsmaRegisterType = 'CASP',
): Promise<{ rows: CsvRow[]; sourceUrl: string }> {
  const urls = ESMA_REGISTER_URLS[registerType];
  for (const url of urls) {
    try {
      logger.info(registryId, `Trying ESMA ${registerType} CSV: ${url}`);
      const rows = await fetchAndParseCsv(url, registryId);
      if (rows.length > 0) {
        logger.info(registryId, `ESMA ${registerType} CSV loaded: ${rows.length} total rows from ${url}`);
        return { rows, sourceUrl: url };
      }
    } catch {
      logger.debug(registryId, `ESMA ${registerType} CSV not found at ${url}, trying next...`);
    }
  }

  throw new Error(`Failed to fetch ESMA ${registerType} CSV from any known URL`);
}

/** Map a single CSV row to a ParsedEntity, respecting register-type differences */
function mapEsmaRow(
  row: CsvRow,
  registerType: EsmaRegisterType,
  countryCode: string,
  regulator: string,
  country: string,
  sourceUrl: string,
): ParsedEntity | null {
  // Common: name extraction
  const leiName = (row['ae_lei_name'] ?? '').trim();
  const commercialName = (row['ae_commercial_name'] ?? '').trim();
  const name = leiName || commercialName;
  if (!name) return null;

  // Common: LEI as primary identifier
  const lei = (row['ae_lei'] ?? '').trim();
  const prefix = registerType === 'NCASP' ? 'NCASP' : 'MICA';
  const licenseNumber = lei || `${prefix}-${countryCode}-${name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 30)}`;

  const website = (row['ae_website'] ?? '').trim() || undefined;
  const licenseType = LICENSE_TYPES[registerType];

  // Register-type-specific fields
  let activities: string[] = [];
  let status: string;

  switch (registerType) {
    case 'CASP': {
      // CASP has service codes (pipe-delimited)
      activities = (row['ac_serviceCode'] ?? '').split('|').map((s) => s.trim()).filter(Boolean);
      const endDate = (row['ac_authorisationEndDate'] ?? '').trim();
      status = endDate ? 'Expired' : 'Authorized';
      break;
    }
    case 'EMTWP': {
      // EMT issuers — stablecoin issuers under MiCA
      activities = ['E-Money Token Issuance'];
      const dti = (row['ae_DTI'] ?? '').trim();
      if (dti) activities.push(`DTI: ${dti}`);
      const endDate = (row['ac_authorisationEndDate'] ?? '').trim();
      status = endDate ? 'Expired' : 'Authorized';
      break;
    }
    case 'ARTZZ': {
      // ART issuers — asset-referenced token issuers
      activities = ['Asset-Referenced Token Issuance'];
      const isCreditInst = (row['ae_credit_institution'] ?? '').trim();
      if (isCreditInst) activities.push('Credit Institution');
      const endDate = (row['ac_authorisationEndDate'] ?? '').trim();
      status = endDate ? 'Expired' : 'Authorized';
      break;
    }
    case 'NCASP': {
      // Non-compliant entities — always "Warning" status
      const infringement = (row['ae_infrigment'] ?? row['ae_infringement'] ?? '').trim();
      const reason = (row['ae_reason'] ?? '').trim();
      activities = [];
      if (infringement) activities.push(infringement);
      if (reason) activities.push(reason);
      status = 'Warning';
      break;
    }
  }

  return {
    name,
    licenseNumber,
    countryCode,
    country,
    status,
    regulator,
    licenseType,
    activities,
    website,
    sourceUrl,
  };
}

/** Map of country codes to regulator names */
const REGULATORS: Record<string, string> = {
  DE: 'BaFin',
  FR: 'AMF',
  NL: 'AFM',
  IT: 'CONSOB',
  ES: 'CNMV',
  AT: 'FMA',
  IE: 'CBI',
  LU: 'CSSF',
  PT: 'CMVM',
  BE: 'FSMA',
  // Tier 2 EU countries
  MT: 'MFSA',
  LT: 'Bank of Lithuania',
  EE: 'Finantsinspektsioon',
  PL: 'KNF',
  CZ: 'CNB',
  CY: 'CySEC',
  SE: 'Finansinspektionen',
  FI: 'FIN-FSA',
  DK: 'Finanstilsynet',
  NO: 'Finanstilsynet',
  GR: 'HCMC',
  HR: 'HANFA',
  SK: 'NBS',
  SI: 'ATVP',
  BG: 'FSC',
  RO: 'ASF',
  LV: 'FKTK',
  HU: 'MNB',
};

/** Map of country codes to country names */
const COUNTRIES: Record<string, string> = {
  DE: 'Germany',
  FR: 'France',
  NL: 'Netherlands',
  IT: 'Italy',
  ES: 'Spain',
  AT: 'Austria',
  IE: 'Ireland',
  LU: 'Luxembourg',
  PT: 'Portugal',
  BE: 'Belgium',
  // Tier 2 EU countries
  MT: 'Malta',
  LT: 'Lithuania',
  EE: 'Estonia',
  PL: 'Poland',
  CZ: 'Czech Republic',
  CY: 'Cyprus',
  SE: 'Sweden',
  FI: 'Finland',
  DK: 'Denmark',
  NO: 'Norway',
  GR: 'Greece',
  HR: 'Croatia',
  SK: 'Slovakia',
  SI: 'Slovenia',
  BG: 'Bulgaria',
  RO: 'Romania',
  LV: 'Latvia',
  HU: 'Hungary',
};

/**
 * Fetch ESMA register for a specific type and filter by country code.
 * Works for all register types: CASP, EMTWP, ARTZZ, NCASP.
 */
export async function fetchEsmaEntities(
  countryCode: string,
  registryId: string,
  registerType: EsmaRegisterType = 'CASP',
): Promise<{ entities: ParsedEntity[]; warnings: string[]; sourceUrl: string }> {
  const warnings: string[] = [];
  const { rows, sourceUrl } = await fetchEsmaCsv(registryId, registerType);

  // Filter by home member state
  const countryRows = rows.filter((row) => {
    const memberState = row['ae_homeMemberState'] ?? row['ae_home_member_state'] ?? '';
    return memberState.toUpperCase().trim() === countryCode.toUpperCase();
  });

  logger.info(registryId, `[${registerType}] Filtered ${countryRows.length} entities for ${countryCode}`);

  if (countryRows.length === 0) {
    warnings.push(`No ${registerType} entities found for country ${countryCode} in ESMA register`);
  }

  const regulator = REGULATORS[countryCode] ?? 'National CA';
  const country = COUNTRIES[countryCode] ?? countryCode;

  const entities: ParsedEntity[] = [];
  for (const row of countryRows) {
    const entity = mapEsmaRow(row, registerType, countryCode, regulator, country, sourceUrl);
    if (entity) {
      entities.push(entity);
    } else {
      warnings.push('Skipping row: no name found');
    }
  }

  return { entities, warnings, sourceUrl };
}

/**
 * Backward-compatible alias: fetch CASP entities only.
 */
export async function fetchEsmaCaspEntities(
  countryCode: string,
  registryId: string,
): Promise<{ entities: ParsedEntity[]; warnings: string[]; sourceUrl: string }> {
  return fetchEsmaEntities(countryCode, registryId, 'CASP');
}

/** Result for a single country from the bulk fetch */
export interface EsmaCountryResult {
  entities: ParsedEntity[];
  warnings: string[];
  countryCode: string;
  countryName: string;
  regulator: string;
}

/** Result of fetching all ESMA CASP entities at once */
export interface EsmaBulkResult {
  countries: Map<string, EsmaCountryResult>;
  sourceUrl: string;
  totalRows: number;
}

/**
 * Fetch a single ESMA register type and group all entities by country.
 * Returns a Map keyed by country code (e.g. "DE", "FR").
 */
export async function fetchAllEsmaEntitiesByType(
  registryId: string,
  registerType: EsmaRegisterType = 'CASP',
): Promise<EsmaBulkResult> {
  const { rows, sourceUrl } = await fetchEsmaCsv(registryId, registerType);

  // Group rows by home member state
  const grouped = new Map<string, CsvRow[]>();
  for (const row of rows) {
    const memberState = (row['ae_homeMemberState'] ?? row['ae_home_member_state'] ?? '').toUpperCase().trim();
    if (!memberState) continue;
    const existing = grouped.get(memberState);
    if (existing) {
      existing.push(row);
    } else {
      grouped.set(memberState, [row]);
    }
  }

  const countries = new Map<string, EsmaCountryResult>();

  for (const [countryCode, countryRows] of grouped) {
    if (!COUNTRIES[countryCode]) {
      logger.debug(registryId, `[${registerType}] Skipping unknown country code: ${countryCode} (${countryRows.length} rows)`);
      continue;
    }

    const warnings: string[] = [];
    const regulator = REGULATORS[countryCode] ?? 'National CA';
    const country = COUNTRIES[countryCode] ?? countryCode;
    const entities: ParsedEntity[] = [];

    for (const row of countryRows) {
      const entity = mapEsmaRow(row, registerType, countryCode, regulator, country, sourceUrl);
      if (entity) {
        entities.push(entity);
      } else {
        warnings.push('Skipping row: no name found');
      }
    }

    countries.set(countryCode, {
      entities,
      warnings,
      countryCode,
      countryName: country,
      regulator,
    });
  }

  logger.info(registryId, `[${registerType}] Bulk fetch: ${rows.length} rows, ${countries.size} countries`);
  return { countries, sourceUrl, totalRows: rows.length };
}

/**
 * Backward-compatible alias: fetch CASP entities only (grouped by country).
 */
export async function fetchAllEsmaCaspEntities(
  registryId: string,
): Promise<EsmaBulkResult> {
  return fetchAllEsmaEntitiesByType(registryId, 'CASP');
}

/** Result of fetching ALL ESMA register types at once */
export interface EsmaFullResult {
  /** Per-type results */
  byType: Map<EsmaRegisterType, EsmaBulkResult>;
  /** Merged entities per country (all types combined) */
  mergedByCountry: Map<string, EsmaCountryResult>;
  /** Total entities across all types */
  totalEntities: number;
  /** Summary per type */
  typeSummary: { type: EsmaRegisterType; rows: number; entities: number; countries: number }[];
}

/**
 * Fetch ALL ESMA MiCA register types and merge by country.
 * This is the main entry point for the unified runner.
 */
export async function fetchAllEsmaRegisters(
  registryId: string,
): Promise<EsmaFullResult> {
  const types: EsmaRegisterType[] = ['CASP', 'EMTWP', 'ARTZZ', 'NCASP'];
  const byType = new Map<EsmaRegisterType, EsmaBulkResult>();
  const mergedByCountry = new Map<string, EsmaCountryResult>();
  let totalEntities = 0;
  const typeSummary: EsmaFullResult['typeSummary'] = [];

  for (const type of types) {
    try {
      logger.info(registryId, `Fetching ESMA ${type} register...`);
      const result = await fetchAllEsmaEntitiesByType(registryId, type);
      byType.set(type, result);

      let typeEntityCount = 0;
      for (const [countryCode, countryResult] of result.countries) {
        typeEntityCount += countryResult.entities.length;

        // Merge into combined map
        const existing = mergedByCountry.get(countryCode);
        if (existing) {
          existing.entities.push(...countryResult.entities);
          existing.warnings.push(...countryResult.warnings);
        } else {
          mergedByCountry.set(countryCode, {
            entities: [...countryResult.entities],
            warnings: [...countryResult.warnings],
            countryCode: countryResult.countryCode,
            countryName: countryResult.countryName,
            regulator: countryResult.regulator,
          });
        }
      }

      totalEntities += typeEntityCount;
      typeSummary.push({
        type,
        rows: result.totalRows,
        entities: typeEntityCount,
        countries: result.countries.size,
      });

      logger.info(registryId, `ESMA ${type}: ${typeEntityCount} entities from ${result.countries.size} countries`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(registryId, `ESMA ${type} fetch failed: ${msg}`);
      typeSummary.push({ type, rows: 0, entities: 0, countries: 0 });
    }
  }

  logger.info(registryId, `ESMA ALL: ${totalEntities} total entities from ${mergedByCountry.size} countries`);
  return { byType, mergedByCountry, totalEntities, typeSummary };
}
