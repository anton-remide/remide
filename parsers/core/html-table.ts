/**
 * HTML table extraction using Cheerio.
 *
 * Supports:
 * - Standard <table> parsing with header detection
 * - Custom selectors for non-standard layouts
 * - Cell text cleaning (trim, normalize whitespace)
 */

import * as cheerio from 'cheerio';

export interface TableRow {
  [key: string]: string;
}

export interface ExtractTableOptions {
  /** CSS selector for the table (default: 'table') */
  tableSelector?: string;
  /** CSS selector for header row (default: auto-detect from <thead> or first <tr>) */
  headerSelector?: string;
  /** CSS selector for data rows (default: auto-detect from <tbody> or remaining <tr>) */
  rowSelector?: string;
  /** Custom header names to use instead of auto-detection */
  headers?: string[];
  /** Whether to normalize header names to camelCase */
  normalizeHeaders?: boolean;
  /** Skip rows where all cells are empty */
  skipEmptyRows?: boolean;
}

/**
 * Clean text from a cell: trim whitespace, normalize internal spaces, remove zero-width chars.
 */
export function cleanCellText(text: string): string {
  return text
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, '') // zero-width chars
    .replace(/\s+/g, ' ') // normalize whitespace
    .trim();
}

/**
 * Normalize a header string to a consistent key.
 */
export function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .trim();
}

/**
 * Extract rows from an HTML table.
 */
export function extractTable(html: string, options: ExtractTableOptions = {}): TableRow[] {
  const {
    tableSelector = 'table',
    headers: customHeaders,
    skipEmptyRows = true,
  } = options;

  const $ = cheerio.load(html);
  const table = $(tableSelector).first();

  if (table.length === 0) {
    return [];
  }

  // Detect headers
  let headers: string[];
  if (customHeaders) {
    headers = customHeaders;
  } else {
    const headerRow = table.find('thead tr').first();
    if (headerRow.length > 0) {
      headers = headerRow.find('th, td').map((_, el) => normalizeHeader(cleanCellText($(el).text()))).get();
    } else {
      // Use first row as header
      const firstRow = table.find('tr').first();
      headers = firstRow.find('th, td').map((_, el) => normalizeHeader(cleanCellText($(el).text()))).get();
    }
  }

  if (headers.length === 0) {
    return [];
  }

  // Extract data rows
  const rows: TableRow[] = [];
  const dataRows = table.find('thead').length > 0
    ? table.find('tbody tr')
    : table.find('tr').slice(1); // skip header row

  dataRows.each((_, row) => {
    const cells = $(row).find('td, th');
    const rowData: TableRow = {};
    let isEmpty = true;

    cells.each((i, cell) => {
      if (i < headers.length) {
        const value = cleanCellText($(cell).text());
        rowData[headers[i]] = value;
        if (value) isEmpty = false;
      }
    });

    // Also extract links from cells
    cells.each((i, cell) => {
      if (i < headers.length) {
        const link = $(cell).find('a').first().attr('href');
        if (link) {
          rowData[`${headers[i]}_link`] = link;
        }
      }
    });

    if (!skipEmptyRows || !isEmpty) {
      rows.push(rowData);
    }
  });

  return rows;
}

/**
 * Extract all tables from HTML.
 */
export function extractAllTables(html: string, tableSelector = 'table'): TableRow[][] {
  const $ = cheerio.load(html);
  const tables: TableRow[][] = [];

  $(tableSelector).each((i) => {
    const tableHtml = $(tableSelector).eq(i).parent().html() ?? '';
    const rows = extractTable(tableHtml, { tableSelector });
    if (rows.length > 0) {
      tables.push(rows);
    }
  });

  return tables;
}

/**
 * Parse an HTML page and extract specific elements by selector.
 */
export function extractElements(html: string, selector: string): string[] {
  const $ = cheerio.load(html);
  return $(selector).map((_, el) => cleanCellText($(el).text())).get();
}

/**
 * Extract links from an HTML page.
 */
export function extractLinks(html: string, selector: string): Array<{ text: string; href: string }> {
  const $ = cheerio.load(html);
  return $(selector)
    .map((_, el) => ({
      text: cleanCellText($(el).text()),
      href: $(el).attr('href') ?? '',
    }))
    .get()
    .filter((link) => link.href);
}
