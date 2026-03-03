/**
 * Canada FINTRAC — Money Services Businesses (MSBs)
 *
 * Source: Excel bulk download from FINTRAC
 * URL: https://fintrac-canafe.canada.ca/msb-esm/reg-eng.xlsx
 * ~7500+ MSBs total, ~3000+ with Virtual Currency activities
 * Updated: monthly
 */

import * as XLSX from 'xlsx';
import type { RegistryParser, ParserConfig, ParseResult, ParsedEntity } from '../core/types.js';
import { logger } from '../core/logger.js';

const SOURCE_URL = 'https://fintrac-canafe.canada.ca/msb-esm/reg-eng.xlsx';

/** FINTRAC activities that indicate crypto/virtual currency services */
const CRYPTO_ACTIVITIES = [
  'virtual currency',
  'digital currency',
  'crypto',
  'cryptocurrency',
];

function isCryptoRelated(activities: string): boolean {
  const lower = activities.toLowerCase();
  return CRYPTO_ACTIVITIES.some((term) => lower.includes(term));
}

export class CaFintracParser implements RegistryParser {
  config: ParserConfig = {
    id: 'ca-fintrac',
    name: 'Canada FINTRAC Money Services Businesses',
    countryCode: 'CA',
    country: 'Canada',
    regulator: 'FINTRAC (Financial Transactions and Reports Analysis Centre)',
    url: SOURCE_URL,
    sourceType: 'csv', // Excel
    rateLimit: 10_000,
    needsProxy: false,
    needsBrowser: false,
  };

  async parse(): Promise<ParseResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const errors: string[] = [];

    // Download Excel file
    logger.info(this.config.id, `Downloading FINTRAC MSB register from ${SOURCE_URL}`);
    const response = await fetch(SOURCE_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download FINTRAC Excel: HTTP ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    logger.info(this.config.id, `Downloaded ${(buffer.byteLength / 1024).toFixed(1)} KB`);

    // Parse workbook
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error('No sheets in FINTRAC workbook');

    const sheet = workbook.Sheets[sheetName];
    const allRows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
      raw: false,
      defval: '',
    });

    logger.info(this.config.id, `Total MSBs in register: ${allRows.length}`);

    // Log column names for debugging
    const sampleRow = allRows[0];
    if (sampleRow) {
      logger.debug(this.config.id, `Column names: ${Object.keys(sampleRow).join(', ')}`);
    }

    const entities: ParsedEntity[] = [];

    for (const row of allRows) {
      // Activities column: "Services Offered" (actual header from FINTRAC Excel)
      const activitiesRaw = this.findColumn(row, [
        'Services Offered',
        'MSB Activities',
        'Activities',
        'Services',
      ]);

      // Filter: only include crypto/virtual currency related MSBs
      if (!activitiesRaw || !isCryptoRelated(activitiesRaw)) {
        continue;
      }

      // Name column: "Organization Names (Legal and Operating)"
      // Format: "Legal Name: XXX, \r\nOperating Name: YYY"
      const nameRaw = this.findColumn(row, [
        'Organization Names (Legal and Operating)',
        'Legal Name',
        'Name',
        'Business Name',
      ]);

      // Extract legal name and operating name
      const legalMatch = nameRaw.match(/Legal Name:\s*([^,\r\n]+)/i);
      const legalName = legalMatch ? legalMatch[1].trim() : nameRaw.trim();

      const opMatch = nameRaw.match(/Operating Name:\s*([^,\r\n]+)/i);
      const operatingName = opMatch ? opMatch[1].trim() : '';

      // Prefer operating name when legal name is numeric/meaningless
      // In Canada, ~30% are "numbered companies" like "12345678 Canada Inc."
      const isNumberedCompany = /^\d{5,}/.test(legalName) || /^\d+\s*(canada|ltd|inc|corp)/i.test(legalName);
      const name = (isNumberedCompany && operatingName) ? operatingName : (legalName || operatingName);
      const tradeName = (isNumberedCompany && operatingName) ? legalName : operatingName;

      if (!name) {
        continue; // Skip rows without names
      }

      // Registration number
      const regNumber = this.findColumn(row, [
        'MSB Registration Number',
        'Registration Number',
      ]);

      const licenseNumber = regNumber || `FINTRAC-${name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 30)}`;

      // Status
      const status = this.findColumn(row, [
        'MSB Registration Status',
        'Status',
        'Registration Status',
      ]) || 'Registered';

      // Website (header has \r\n artifact from Excel)
      const website = this.findColumn(row, ['Website\r\n', 'Website', 'website']);

      // Parse activities
      const activities = activitiesRaw
        .split(/[;,|]/)
        .map((s) => s.trim())
        .filter(Boolean);

      entities.push({
        name: name.trim(),
        licenseNumber,
        countryCode: 'CA',
        country: 'Canada',
        status: status.trim(),
        regulator: 'FINTRAC',
        licenseType: 'MSB Registration',
        activities,
        entityTypes: tradeName ? [tradeName] : undefined,
        website: website || undefined,
        sourceUrl: SOURCE_URL,
      });
    }

    logger.info(this.config.id, `Filtered ${entities.length} crypto-related MSBs from ${allRows.length} total`);

    return {
      registryId: this.config.id,
      countryCode: 'CA',
      entities,
      totalFound: entities.length,
      durationMs: Date.now() - startTime,
      warnings,
      errors,
      timestamp: new Date().toISOString(),
    };
  }

  /** Find a value in a row by trying multiple possible column names */
  private findColumn(row: Record<string, string>, candidates: string[]): string {
    // Direct match first (exact column name)
    for (const key of candidates) {
      if (row[key] !== undefined && row[key] !== '') return row[key];
    }
    // Case-insensitive fallback (ignoring whitespace)
    const rowKeys = Object.keys(row);
    for (const candidate of candidates) {
      const norm = candidate.toLowerCase().replace(/[\s\r\n]+/g, ' ').trim();
      const found = rowKeys.find((k) => k.toLowerCase().replace(/[\s\r\n]+/g, ' ').trim() === norm);
      if (found && row[found] !== '') return row[found];
    }
    return '';
  }
}
