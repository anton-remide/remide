/**
 * Shared ESMA MiCAR CASP Register parser.
 *
 * The ESMA publishes a CSV of all MiCA-authorized crypto-asset service providers
 * across the EU. This helper fetches it and filters by country.
 *
 * Source: https://www.esma.europa.eu/
 * Updated: weekly
 */

import { fetchAndParseCsv, type CsvRow } from './csv-parser.js';
import { logger } from './logger.js';
import type { ParsedEntity } from './types.js';

/**
 * Known ESMA CASP CSV URLs (they update the filename periodically).
 * We try multiple URLs in order.
 */
const ESMA_CSV_URLS = [
  'https://www.esma.europa.eu/sites/default/files/2025-03/CASPS.csv',
  'https://www.esma.europa.eu/sites/default/files/2025-02/CASPS.csv',
  'https://www.esma.europa.eu/sites/default/files/2025-01/CASPS.csv',
  'https://www.esma.europa.eu/sites/default/files/2024-12/CASPS.csv',
];

/** Try fetching the ESMA CSV from known URLs */
async function fetchEsmaCsv(registryId: string): Promise<{ rows: CsvRow[]; sourceUrl: string }> {
  for (const url of ESMA_CSV_URLS) {
    try {
      logger.info(registryId, `Trying ESMA CSV: ${url}`);
      const rows = await fetchAndParseCsv(url, registryId);
      if (rows.length > 0) {
        logger.info(registryId, `ESMA CSV loaded: ${rows.length} total rows from ${url}`);
        return { rows, sourceUrl: url };
      }
    } catch {
      logger.debug(registryId, `ESMA CSV not found at ${url}, trying next...`);
    }
  }

  throw new Error('Failed to fetch ESMA CASP CSV from any known URL');
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
 * Fetch ESMA CASP register and filter by country code.
 */
export async function fetchEsmaCaspEntities(
  countryCode: string,
  registryId: string,
): Promise<{ entities: ParsedEntity[]; warnings: string[]; sourceUrl: string }> {
  const warnings: string[] = [];
  const { rows, sourceUrl } = await fetchEsmaCsv(registryId);

  // Filter by home member state
  const countryRows = rows.filter((row) => {
    const memberState = row['ae_homeMemberState'] ?? row['ae_home_member_state'] ?? '';
    return memberState.toUpperCase().trim() === countryCode.toUpperCase();
  });

  logger.info(registryId, `Filtered ${countryRows.length} entities for ${countryCode}`);

  if (countryRows.length === 0) {
    warnings.push(`No entities found for country ${countryCode} in ESMA register`);
  }

  const regulator = REGULATORS[countryCode] ?? 'National CA';
  const country = COUNTRIES[countryCode] ?? countryCode;

  const entities: ParsedEntity[] = [];

  for (const row of countryRows) {
    // Extract name: prefer legal name, fallback to commercial name
    const leiName = (row['ae_lei_name'] ?? '').trim();
    const commercialName = (row['ae_commercial_name'] ?? '').trim();
    const name = leiName || commercialName;

    if (!name) {
      warnings.push('Skipping row: no name found');
      continue;
    }

    // LEI as primary identifier
    const lei = (row['ae_lei'] ?? '').trim();
    // Generate a stable fallback ID if no LEI
    const licenseNumber = lei || `MICA-${countryCode}-${name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 30)}`;

    // Parse service codes (pipe-delimited)
    const serviceCodes = (row['ac_serviceCode'] ?? '').split('|').map((s) => s.trim()).filter(Boolean);

    // Determine status
    const endDate = (row['ac_authorisationEndDate'] ?? '').trim();
    const status = endDate ? 'Expired' : 'Authorized';

    const website = (row['ae_website'] ?? '').trim() || undefined;

    entities.push({
      name,
      licenseNumber,
      countryCode,
      country,
      status,
      regulator,
      licenseType: 'MiCAR CASP',
      activities: serviceCodes,
      website,
      sourceUrl,
    });
  }

  return { entities, warnings, sourceUrl };
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
 * Fetch ESMA CASP register ONCE and group all entities by country.
 * Returns a Map keyed by country code (e.g. "DE", "FR").
 * Only includes countries that exist in the COUNTRIES/REGULATORS maps.
 */
export async function fetchAllEsmaCaspEntities(
  registryId: string,
): Promise<EsmaBulkResult> {
  const { rows, sourceUrl } = await fetchEsmaCsv(registryId);

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
    // Only process countries we know about
    if (!COUNTRIES[countryCode]) {
      logger.debug(registryId, `Skipping unknown country code: ${countryCode} (${countryRows.length} rows)`);
      continue;
    }

    const warnings: string[] = [];
    const regulator = REGULATORS[countryCode] ?? 'National CA';
    const country = COUNTRIES[countryCode] ?? countryCode;
    const entities: ParsedEntity[] = [];

    for (const row of countryRows) {
      const leiName = (row['ae_lei_name'] ?? '').trim();
      const commercialName = (row['ae_commercial_name'] ?? '').trim();
      const name = leiName || commercialName;

      if (!name) {
        warnings.push('Skipping row: no name found');
        continue;
      }

      const lei = (row['ae_lei'] ?? '').trim();
      const licenseNumber = lei || `MICA-${countryCode}-${name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 30)}`;
      const serviceCodes = (row['ac_serviceCode'] ?? '').split('|').map((s) => s.trim()).filter(Boolean);
      const endDate = (row['ac_authorisationEndDate'] ?? '').trim();
      const status = endDate ? 'Expired' : 'Authorized';
      const website = (row['ae_website'] ?? '').trim() || undefined;

      entities.push({
        name,
        licenseNumber,
        countryCode,
        country,
        status,
        regulator,
        licenseType: 'MiCAR CASP',
        activities: serviceCodes,
        website,
        sourceUrl,
      });
    }

    countries.set(countryCode, {
      entities,
      warnings,
      countryCode,
      countryName: country,
      regulator,
    });
  }

  logger.info(registryId, `Bulk fetch complete: ${rows.length} total rows, ${countries.size} countries`);
  return { countries, sourceUrl, totalRows: rows.length };
}
