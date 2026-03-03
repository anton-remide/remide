/**
 * Switzerland FINMA — FinTech Licensed Entities
 *
 * Source: Excel download from FINMA website
 * URL: https://www.finma.ch/en/~/media/finma/dokumente/bewilligungstraeger/xlsx/fintech.xlsx
 * ~4-5 FinTech licence holders (small but important jurisdiction)
 * Also checks banks/securities firms for crypto entities
 *
 * Note: FINMA Excel files have non-standard headers:
 * - fintech.xlsx: Row 1 is title text, actual headers are in row 3
 * - beh.xlsx: Column A header is the full title "Authorised banks and securities firms"
 */

import * as XLSX from 'xlsx';
import type { RegistryParser, ParserConfig, ParseResult, ParsedEntity } from '../core/types.js';
import { logger } from '../core/logger.js';

const FINTECH_URL = 'https://www.finma.ch/en/~/media/finma/dokumente/bewilligungstraeger/xlsx/fintech.xlsx';
const BANKS_URL = 'https://www.finma.ch/en/~/media/finma/dokumente/bewilligungstraeger/xlsx/beh.xlsx';

/** Known crypto-related Swiss entities (by name patterns) */
const CRYPTO_KEYWORDS = [
  'crypto', 'bitcoin', 'digital asset', 'blockchain', 'token',
  'seba', 'sygnum', 'amina', 'leonteq', '21shares', 'taurus',
  'bitcoin suisse', 'bity', 'lykke', 'metaco',
];

function isCryptoRelated(name: string, extra: string): boolean {
  const text = `${name} ${extra}`.toLowerCase();
  return CRYPTO_KEYWORDS.some((kw) => text.includes(kw));
}

export class ChFinmaParser implements RegistryParser {
  config: ParserConfig = {
    id: 'ch-finma',
    name: 'Switzerland FINMA Licensed Crypto Entities',
    countryCode: 'CH',
    country: 'Switzerland',
    regulator: 'FINMA (Swiss Financial Market Supervisory Authority)',
    url: FINTECH_URL,
    sourceType: 'csv', // Excel
    rateLimit: 10_000,
    needsProxy: false,
    needsBrowser: false,
  };

  async parse(): Promise<ParseResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const errors: string[] = [];
    const entities: ParsedEntity[] = [];

    // 1. Fetch FinTech licence holders (all are relevant)
    try {
      const fintechEntities = await this.fetchFintechEntities();
      entities.push(...fintechEntities);
      logger.info(this.config.id, `FinTech licence holders: ${fintechEntities.length}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`Failed to fetch FinTech list: ${msg}`);
      logger.warn(this.config.id, `FinTech fetch failed: ${msg}`);
    }

    // 2. Fetch banks & securities firms, filter for crypto-related ones
    try {
      const bankEntities = await this.fetchBankEntities();
      entities.push(...bankEntities);
      logger.info(this.config.id, `Crypto-related banks/securities firms: ${bankEntities.length}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`Failed to fetch banks list: ${msg}`);
      logger.warn(this.config.id, `Banks fetch failed: ${msg}`);
    }

    logger.info(this.config.id, `Total entities: ${entities.length}`);

    return {
      registryId: this.config.id,
      countryCode: 'CH',
      entities,
      totalFound: entities.length,
      durationMs: Date.now() - startTime,
      warnings,
      errors,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * FinTech Excel: Row 1 is title, row 3 has real headers.
   * Use range:2 to skip title rows and parse from the actual header row.
   * All fintech licensees are crypto-relevant.
   */
  private async fetchFintechEntities(): Promise<ParsedEntity[]> {
    const buffer = await this.downloadExcel(FINTECH_URL);
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];

    const sheet = workbook.Sheets[sheetName];

    // Try range:2 first (skip title rows, use row 3 as headers)
    let rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
      raw: false,
      defval: '',
      range: 2,
    });

    // If that gives __EMPTY columns or no rows, try range:0 as fallback
    if (rows.length === 0 || (rows[0] && Object.keys(rows[0]).every((k) => k.startsWith('__EMPTY')))) {
      rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
        raw: false,
        defval: '',
      });
    }

    logger.debug(this.config.id, `FinTech rows: ${rows.length}, columns: ${rows[0] ? Object.keys(rows[0]).join(', ') : 'none'}`);

    const entities: ParsedEntity[] = [];

    for (const row of rows) {
      // Try finding name in standard columns first
      let name = this.findValue(row, ['Name', 'Institution', 'Firma', 'name', 'institution']);

      // Fallback: use first non-empty column value
      if (!name) {
        const firstKey = Object.keys(row).find((k) => row[k]?.trim());
        if (firstKey) name = row[firstKey].trim();
      }

      if (!name || name.length < 2) continue;
      // Skip header-like rows
      if (name.toLowerCase().includes('list of persons') || name.toLowerCase().includes('finma')) continue;

      const licenseNumber = `FINMA-FT-${name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 40)}`;

      entities.push({
        name: name.trim(),
        licenseNumber,
        countryCode: 'CH',
        country: 'Switzerland',
        status: 'Authorized',
        regulator: 'FINMA',
        licenseType: 'FinTech Licence',
        activities: ['FinTech Licence'],
        sourceUrl: FINTECH_URL,
      });
    }

    return entities;
  }

  /**
   * Banks Excel: Column A header is the long title text.
   * Filter for crypto-related entities by name matching.
   */
  private async fetchBankEntities(): Promise<ParsedEntity[]> {
    const buffer = await this.downloadExcel(BANKS_URL);
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];

    const sheet = workbook.Sheets[sheetName];

    // Try multiple range options
    let rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
      raw: false,
      defval: '',
    });

    logger.debug(this.config.id, `Banks rows: ${rows.length}, columns: ${rows[0] ? Object.keys(rows[0]).join(', ') : 'none'}`);

    const entities: ParsedEntity[] = [];

    for (const row of rows) {
      // Try standard column names
      let name = this.findValue(row, ['Name', 'Institution', 'Firma', 'name']);

      // Fallback: use first column value (the title-based column name)
      if (!name) {
        const firstKey = Object.keys(row)[0];
        if (firstKey) name = (row[firstKey] ?? '').trim();
      }

      if (!name || name.length < 2) continue;

      // Get category/type from second column if available
      const keys = Object.keys(row);
      const category = keys.length > 1 ? (row[keys[1]] ?? '').trim() : '';

      // Only include crypto-related banks
      if (!isCryptoRelated(name, category)) continue;

      const licenseNumber = `FINMA-BK-${name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 40)}`;

      entities.push({
        name: name.trim(),
        licenseNumber,
        countryCode: 'CH',
        country: 'Switzerland',
        status: 'Authorized',
        regulator: 'FINMA',
        licenseType: 'Bank/Securities Firm',
        activities: category ? [category] : ['Banking'],
        sourceUrl: BANKS_URL,
      });
    }

    return entities;
  }

  private async downloadExcel(url: string): Promise<ArrayBuffer> {
    logger.info(this.config.id, `Downloading: ${url}`);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from ${url}`);
    }

    return response.arrayBuffer();
  }

  private findValue(row: Record<string, string>, candidates: string[]): string {
    for (const key of candidates) {
      if (row[key] !== undefined && row[key].trim() !== '') return row[key].trim();
    }
    const keys = Object.keys(row);
    for (const candidate of candidates) {
      const found = keys.find((k) => k.toLowerCase() === candidate.toLowerCase());
      if (found && row[found].trim() !== '') return row[found].trim();
    }
    return '';
  }
}
