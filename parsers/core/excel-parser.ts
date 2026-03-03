/**
 * Excel file parser using xlsx library.
 * Downloads and parses .xlsx/.xls files into row arrays.
 */

import * as XLSX from 'xlsx';
import { logger } from './logger.js';

export interface ExcelRow {
  [key: string]: string | number | boolean | null;
}

/**
 * Parse Excel buffer into array of row objects.
 * Uses first row as headers by default.
 */
export function parseExcelBuffer(buffer: ArrayBuffer, options?: {
  sheet?: number | string;
  headerRow?: number;
  skipRows?: number;
}): ExcelRow[] {
  const workbook = XLSX.read(buffer, { type: 'array' });

  const sheetName = typeof options?.sheet === 'number'
    ? workbook.SheetNames[options.sheet]
    : options?.sheet ?? workbook.SheetNames[0];

  if (!sheetName || !workbook.Sheets[sheetName]) {
    logger.warn('excel', `Sheet "${sheetName}" not found. Available: ${workbook.SheetNames.join(', ')}`);
    return [];
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<ExcelRow>(sheet, {
    header: options?.headerRow !== undefined ? options.headerRow : undefined,
    defval: null,
    raw: false,
  });

  const skipRows = options?.skipRows ?? 0;
  return skipRows > 0 ? rows.slice(skipRows) : rows;
}

/**
 * Fetch and parse an Excel file from a URL.
 */
export async function fetchAndParseExcel(
  url: string,
  registryId: string,
  options?: Parameters<typeof parseExcelBuffer>[1]
): Promise<ExcelRow[]> {
  logger.info(registryId, `Downloading Excel from ${url}`);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download Excel: HTTP ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  logger.info(registryId, `Downloaded ${(buffer.byteLength / 1024).toFixed(1)} KB`);

  const rows = parseExcelBuffer(buffer, options);
  logger.info(registryId, `Parsed ${rows.length} rows`);

  return rows;
}

/**
 * Normalize Excel column headers: lowercase, replace spaces with underscores.
 */
export function normalizeExcelHeaders(row: ExcelRow): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = key.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    result[normalizedKey] = value != null ? String(value).trim() : '';
  }
  return result;
}
