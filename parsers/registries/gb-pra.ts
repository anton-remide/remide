/**
 * GB PRA — UK Prudential Regulation Authority (Bank of England)
 *
 * Source: PRA Register — CSV Downloads
 * URL: https://www.bankofengland.co.uk/prudential-regulation/authorisations/which-firms-does-the-pra-regulate
 *
 * The PRA publishes free CSV files listing:
 * - Banks (incl. international banks authorized in UK)
 * - Building Societies
 * - Credit Unions
 * - Designated Investment Firms
 * - Insurance companies
 *
 * We focus on Banks + Building Societies + Designated Investment Firms.
 * ~400-500 entities.
 *
 * CSV URL pattern: varies, but typically available at the PRA web pages.
 * We try multiple known URLs.
 */

import type { RegistryParser, ParserConfig, ParseResult, ParsedEntity } from '../core/types.js';
import { fetchWithRetry } from '../core/client.js';
import { logger } from '../core/logger.js';

const SOURCE_URL = 'https://www.bankofengland.co.uk/prudential-regulation/authorisations/which-firms-does-the-pra-regulate';

// Known CSV download URLs — dynamically discovered + hardcoded fallbacks
const CSV_URLS: string[] = [];

// Fallback: try the main page and extract CSV links
const LIST_PAGE = 'https://www.bankofengland.co.uk/prudential-regulation/authorisations/which-firms-does-the-pra-regulate';

export class GbPraParser implements RegistryParser {
  config: ParserConfig = {
    id: 'gb-pra',
    name: 'UK PRA Regulated Banks & Firms',
    countryCode: 'GB',
    country: 'United Kingdom',
    regulator: 'PRA (Prudential Regulation Authority)',
    url: SOURCE_URL,
    sourceType: 'csv',
    rateLimit: 5_000,
    needsProxy: false,
    needsBrowser: false,
  };

  async parse(): Promise<ParseResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const errors: string[] = [];
    const entities: ParsedEntity[] = [];
    const seen = new Set<string>();

    // Try to find CSV links from the main page first
    let csvUrls = [...CSV_URLS];
    try {
      logger.info(this.config.id, 'Fetching PRA main page to find CSV download links');
      const html = await fetchWithRetry(LIST_PAGE, {
        registryId: this.config.id,
        rateLimit: 3_000,
      });

      // Extract CSV/Excel links
      const linkMatches = html.match(/href="([^"]*\.csv[^"]*)"/gi) || [];
      for (const match of linkMatches) {
        const href = match.replace(/^href="/, '').replace(/"$/, '');
        const fullUrl = href.startsWith('http') ? href : `https://www.bankofengland.co.uk${href}`;
        if (!csvUrls.includes(fullUrl)) {
          csvUrls.unshift(fullUrl); // Prefer freshly discovered URLs
        }
      }
    } catch (err) {
      warnings.push(`Could not fetch PRA page: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Parse ALL CSV files (each has a different category)
    for (const csvUrl of csvUrls) {
      try {
        logger.info(this.config.id, `Trying CSV: ${csvUrl}`);

        const csvText = await fetchWithRetry(csvUrl, {
          registryId: this.config.id,
          rateLimit: 3_000,
          headers: {
            Accept: 'text/csv,application/csv,text/plain,*/*',
          },
        });

        // Skip if we got HTML instead of CSV
        if (csvText.trim().startsWith('<!DOCTYPE') || csvText.trim().startsWith('<html')) {
          warnings.push(`${csvUrl} returned HTML, not CSV`);
          continue;
        }

        // Parse CSV — Bank of England CSVs have metadata rows before the actual header
        // Format: "BANK OF ENGLAND (PRA)",, then info rows, then blank, then header row like "Firm Name","FRN","LEI"
        const lines = csvText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length < 2) {
          warnings.push(`${csvUrl} has ${lines.length} lines`);
          continue;
        }

        // Detect category from URL filename
        let csvCategory = 'bank';
        const urlLower = csvUrl.toLowerCase();
        if (urlLower.includes('building-societ')) csvCategory = 'building_society';
        else if (urlLower.includes('designated') || urlLower.includes('investment')) csvCategory = 'investment_firm';
        else if (urlLower.includes('credit-union')) csvCategory = 'credit_union';
        else if (urlLower.includes('insurer')) csvCategory = 'insurer';

        // Find the actual header row by scanning for "Firm Name"
        let headerIdx = -1;
        for (let i = 0; i < Math.min(lines.length, 20); i++) {
          const lower = lines[i].toLowerCase();
          if (lower.includes('firm name') || lower.includes('"firm name"')) {
            headerIdx = i;
            break;
          }
        }

        if (headerIdx === -1) {
          warnings.push(`No 'Firm Name' header found in ${csvUrl} (first 20 lines scanned)`);
          continue;
        }

        // Parse header
        const header = this.parseCsvLine(lines[headerIdx]).map(h => h.toLowerCase().trim());
        const nameIdx = header.findIndex(h => /firm.?name|name/i.test(h));
        const frnIdx = header.findIndex(h => /frn|firm.*ref/i.test(h));
        const leiIdx = header.findIndex(h => /lei/i.test(h));

        if (nameIdx === -1) {
          warnings.push(`No name column in header: ${header.join(', ')}`);
          continue;
        }

        logger.info(this.config.id, `CSV header at line ${headerIdx}: ${header.join(' | ')} (category=${csvCategory})`);

        // Also detect sections within the CSV (e.g. "Banks incorporated in UK", "International banks")
        let currentSection = '';

        for (let i = headerIdx + 1; i < lines.length; i++) {
          const cols = this.parseCsvLine(lines[i]);

          // Detect section headers: single cell with no FRN (description rows)
          if (cols.length >= 1 && cols[0] && (!cols[frnIdx] || cols[frnIdx].trim() === '') && !cols[0].match(/^\d/)) {
            const text = cols[0].trim();
            if (text.length > 5 && text.length < 200 && !text.includes('http') && /[A-Z]/.test(text[0])) {
              // Looks like a section header, check if next line has data
              if (i + 1 < lines.length) {
                const nextCols = this.parseCsvLine(lines[i + 1]);
                if (nextCols[frnIdx]?.trim().match(/^\d+$/)) {
                  currentSection = text;
                  continue;
                }
              }
            }
          }

          const name = cols[nameIdx]?.trim();
          if (!name || name.length < 3) continue;

          // Skip non-data rows (section headers, notes, etc.)
          const frn = frnIdx >= 0 ? cols[frnIdx]?.trim() : '';
          if (!frn && !name.match(/[A-Z]/i)) continue;

          const lei = leiIdx >= 0 ? cols[leiIdx]?.trim() : '';

          const key = (frn || name).toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);

          // Determine license type from category + section
          let licenseType = 'PRA Authorised Bank';
          const activities: string[] = ['Banking'];
          if (csvCategory === 'building_society') {
            licenseType = 'Building Society';
            activities.push('Building Society');
          } else if (csvCategory === 'investment_firm') {
            licenseType = 'Designated Investment Firm';
            activities[0] = 'Investment';
            activities.push('Designated Investment Firm');
          } else if (csvCategory === 'credit_union') {
            licenseType = 'Credit Union';
            activities[0] = 'Credit Union';
          } else if (csvCategory === 'insurer') {
            licenseType = 'Insurance Company';
            activities[0] = 'Insurance';
          } else if (/international/i.test(currentSection)) {
            licenseType = 'International Bank (PRA Authorised)';
          }

          entities.push({
            name,
            licenseNumber: frn ? `FRN-${frn}` : `PRA-${name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 30)}`,
            countryCode: 'GB',
            country: 'United Kingdom',
            status: 'Authorised',
            regulator: 'PRA',
            licenseType,
            activities,
            entityTypes: currentSection ? [currentSection] : undefined,
            sourceUrl: csvUrl,
          });
        }

        logger.info(this.config.id, `Parsed ${entities.length} entities so far from ${csvUrl}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        warnings.push(`CSV ${csvUrl} failed: ${msg}`);
      }
    }

    if (entities.length === 0) {
      warnings.push('No PRA CSV data could be parsed. All CSV URLs may be stale. Check Bank of England website.');
    }

    return {
      registryId: this.config.id,
      countryCode: 'GB',
      entities,
      totalFound: entities.length,
      durationMs: Date.now() - startTime,
      warnings,
      errors,
      timestamp: new Date().toISOString(),
    };
  }

  /** Parse a CSV line handling quoted fields */
  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  }
}
