/**
 * CSV file parser using csv-parse library.
 * Downloads and parses CSV files into row arrays.
 */

import { parse } from 'csv-parse/sync';
import { logger } from './logger.js';

export interface CsvRow {
  [key: string]: string;
}

/**
 * Parse CSV string into array of row objects.
 */
export function parseCsvString(csvText: string, options?: {
  delimiter?: string;
  skipLines?: number;
  columns?: boolean | string[];
}): CsvRow[] {
  return parse(csvText, {
    columns: options?.columns ?? true,
    skip_empty_lines: true,
    trim: true,
    delimiter: options?.delimiter ?? ',',
    from_line: (options?.skipLines ?? 0) + 1,
    relax_column_count: true,
  }) as unknown as CsvRow[];
}

/**
 * Fetch and parse a CSV file from a URL.
 */
export async function fetchAndParseCsv(
  url: string,
  registryId: string,
  options?: Parameters<typeof parseCsvString>[1]
): Promise<CsvRow[]> {
  logger.info(registryId, `Downloading CSV from ${url}`);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      Accept: 'text/csv,application/csv,text/plain',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download CSV: HTTP ${response.status}`);
  }

  const text = await response.text();
  logger.info(registryId, `Downloaded ${(text.length / 1024).toFixed(1)} KB`);

  const rows = parseCsvString(text, options);
  logger.info(registryId, `Parsed ${rows.length} rows`);

  return rows;
}
