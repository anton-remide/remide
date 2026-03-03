/**
 * Japan FSA — Crypto-Asset Exchange Service Providers
 *
 * Source: Excel file from FSA website
 * URL: https://www.fsa.go.jp/en/regulated/licensed/en_kasoutuka.xlsx
 * ~28 registered exchanges
 * Format: .xlsx with complex headers (rows 0-5 metadata, row 6 headers, data from row 7)
 */

import * as XLSX from 'xlsx';
import type { RegistryParser, ParserConfig, ParseResult, ParsedEntity } from '../core/types.js';
import { logger } from '../core/logger.js';

const SOURCE_URL = 'https://www.fsa.go.jp/en/regulated/licensed/en_kasoutuka.xlsx';

export class JpFsaParser implements RegistryParser {
  config: ParserConfig = {
    id: 'jp-fsa',
    name: 'Japan FSA Crypto-Asset Exchange Service Providers',
    countryCode: 'JP',
    country: 'Japan',
    regulator: 'Financial Services Agency (FSA)',
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
    logger.info(this.config.id, `Downloading Excel from ${SOURCE_URL}`);
    const response = await fetch(SOURCE_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download JP-FSA Excel: HTTP ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    logger.info(this.config.id, `Downloaded ${(buffer.byteLength / 1024).toFixed(1)} KB`);

    // Parse workbook
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error('No sheets in workbook');

    const sheet = workbook.Sheets[sheetName];
    // Parse as raw arrays (no header interpretation) — keeps all rows including metadata
    const rawRows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
      header: 1,
      raw: false,
      defval: '',
    });

    logger.info(this.config.id, `Raw rows: ${rawRows.length}`);

    // Find the header row — contains "Registration Number" or similar
    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(rawRows.length, 15); i++) {
      const row = rawRows[i];
      const rowText = row.map(String).join(' ').toLowerCase();
      if (rowText.includes('registration') && rowText.includes('name')) {
        headerRowIdx = i;
        break;
      }
    }

    if (headerRowIdx === -1) {
      // Fallback: assume row 6 (0-indexed) is the header
      headerRowIdx = 6;
      warnings.push('Could not detect header row, defaulting to row 6');
    }

    logger.info(this.config.id, `Header row at index ${headerRowIdx}`);

    // Data rows start after header
    const dataRows = rawRows.slice(headerRowIdx + 1).filter((row) => {
      // Skip empty rows — at least one cell must have content
      return row.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== '');
    });

    logger.info(this.config.id, `Data rows: ${dataRows.length}`);

    // Column mapping (based on research):
    // A(0): Bureau grouping (merged cells, may be empty for most rows)
    // B(1): Registration Number
    // C(2): Date of Registration (Excel serial or text)
    // D(3): Name
    // E(4): Corporate Number
    // F(5): Postal Code
    // G(6): Address
    // H(7): Phone Number
    // I(8): Crypto-assets handled

    const entities: ParsedEntity[] = [];

    for (const row of dataRows) {
      const regNumber = String(row[1] ?? '').trim();
      const name = String(row[3] ?? '').trim();

      // Skip rows without a name or registration number
      if (!name || !regNumber) {
        // Check if this might be a continuation row or bureau header
        if (name && !regNumber) {
          warnings.push(`Skipping row with name "${name}" — no registration number`);
        }
        continue;
      }

      // Skip if it looks like a header repeat or metadata
      if (regNumber.toLowerCase().includes('registration') || name.toLowerCase().includes('name of')) {
        continue;
      }

      // Extract clean license number: "Director of the Kanto ... No.00001" → "No.00001"
      let licenseNumber = regNumber;
      const noMatch = regNumber.match(/No\.\s*(\d+)/i);
      if (noMatch) {
        licenseNumber = `No.${noMatch[1]}`;
      }

      const corporateNumber = String(row[4] ?? '').trim();
      const cryptoAssets = String(row[8] ?? '').trim();

      // Parse activities from crypto assets list
      const activities = cryptoAssets
        ? cryptoAssets.split(/[、,]/).map((s) => s.trim()).filter(Boolean)
        : [];

      entities.push({
        name,
        licenseNumber,
        countryCode: 'JP',
        country: 'Japan',
        status: 'Registered',
        regulator: 'FSA',
        licenseType: 'Crypto-Asset Exchange Service Provider',
        activities: activities.length > 0 ? activities : ['Crypto-Asset Exchange'],
        entityTypes: corporateNumber ? [`Corp: ${corporateNumber}`] : undefined,
        sourceUrl: SOURCE_URL,
      });
    }

    logger.info(this.config.id, `Parsed ${entities.length} entities`);

    return {
      registryId: this.config.id,
      countryCode: 'JP',
      entities,
      totalFound: entities.length,
      durationMs: Date.now() - startTime,
      warnings,
      errors,
      timestamp: new Date().toISOString(),
    };
  }
}
