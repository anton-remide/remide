/**
 * Malaysia SC — Registered Digital Asset Exchanges (DAX)
 *
 * Source: Securities Commission Malaysia
 * URL: https://www.sc.com.my/regulation/guidelines/recognizedmarkets/list-of-registered-digital-asset-exchanges
 * ~6 active + ~83 revoked/transitional DAX operators
 * Format: Static HTML page with accordion sections and tables
 *
 * Sections:
 * A — Currently active registered operators (6 entities)
 * B — Registration revoked under Section 7C(1)(a) (19 entities)
 * C — Registration revoked under Section 7C(1)(b) (21 entities)
 * D — Entities granted transitional period (43 entities)
 *
 * We collect ALL sections (W0/W1 = full registry, no filtering).
 */

import * as cheerio from 'cheerio';
import type { RegistryParser, ParserConfig, ParseResult, ParsedEntity } from '../core/types.js';
import { fetchWithRetry } from '../core/client.js';
import { logger } from '../core/logger.js';

const SOURCE_URL =
  'https://www.sc.com.my/regulation/guidelines/recognizedmarkets/list-of-registered-digital-asset-exchanges';

/** Sections with their expected status */
const SECTIONS = [
  { id: 'A', status: 'Registered', label: 'Currently Registered DAX' },
  { id: 'B', status: 'Revoked', label: 'Revoked under 7C(1)(a)' },
  { id: 'C', status: 'Revoked', label: 'Revoked under 7C(1)(b)' },
  { id: 'D', status: 'Transitional', label: 'Transitional Period' },
];

export class MyScParser implements RegistryParser {
  config: ParserConfig = {
    id: 'my-sc',
    name: 'Malaysia SC Registered Digital Asset Exchanges',
    countryCode: 'MY',
    country: 'Malaysia',
    regulator: 'SC (Securities Commission Malaysia)',
    url: SOURCE_URL,
    sourceType: 'html',
    rateLimit: 8_000,
    needsProxy: false,
    needsBrowser: false,
  };

  async parse(): Promise<ParseResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const errors: string[] = [];

    logger.info(this.config.id, `Fetching SC Malaysia DAX register from ${SOURCE_URL}`);

    let html: string;
    try {
      html = await fetchWithRetry(SOURCE_URL, {
        registryId: this.config.id,
        rateLimit: this.config.rateLimit,
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });
    } catch (err) {
      throw new Error(
        `Failed to fetch SC Malaysia register: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    const entities = this.parsePage(html, warnings);
    logger.info(this.config.id, `Parsed ${entities.length} entities`);

    if (entities.length === 0) {
      warnings.push('No entities found — page structure may have changed');
    }

    return {
      registryId: this.config.id,
      countryCode: 'MY',
      entities,
      totalFound: entities.length,
      durationMs: Date.now() - startTime,
      warnings,
      errors,
      timestamp: new Date().toISOString(),
    };
  }

  private parsePage(html: string, warnings: string[]): ParsedEntity[] {
    const $ = cheerio.load(html);
    const entities: ParsedEntity[] = [];

    // Strategy 1: Parse tables within accordion sections
    // SC Malaysia uses accordion/collapse sections labeled A, B, C, D
    const tables = $('table');
    logger.info(this.config.id, `Found ${tables.length} tables on page`);

    // Try to match tables to sections by looking at preceding headings
    tables.each((tableIdx, table) => {
      const rows = $(table).find('tr');
      const sectionLabel = this.detectSection($, $(table));

      rows.each((rowIdx, row) => {
        const cells = $(row).find('td');
        if (cells.length < 1) return;

        // Skip header rows
        const firstText = $(cells[0]).text().trim();
        if (
          firstText.toLowerCase().includes('no.') ||
          firstText.toLowerCase().includes('name') ||
          firstText === 'No' ||
          firstText === '#'
        ) {
          return;
        }

        // Extract entity
        const entity = this.parseTableRow($, cells, sectionLabel);
        if (entity) {
          entities.push(entity);
        }
      });
    });

    // Strategy 2: Parse ordered/unordered lists if no tables found
    if (entities.length === 0) {
      logger.info(this.config.id, 'No table entities, trying list-based extraction...');

      $('ol li, .accordion-body li, .card-body li').each((_, li) => {
        const text = $(li).text().trim();
        if (text.length > 3 && text.length < 300) {
          const name = this.extractCompanyName(text);
          if (name) {
            entities.push(this.createEntity(name, 'Registered'));
          }
        }
      });
    }

    // Strategy 3: Parse structured divs/paragraphs with company names
    if (entities.length === 0) {
      logger.info(this.config.id, 'No list entities, trying generic text extraction...');

      // Look for numbered items in content
      const contentArea = $('.field-item, .content-area, .entry-content, article, .post-content, main');
      const textContent = contentArea.length > 0 ? contentArea.text() : $('body').text();

      // Match patterns like "1. Company Name Sdn Bhd" or "Company Name Sdn. Bhd."
      const companyPattern = /(?:^|\n)\s*(?:\d+\.?\s+)?([A-Z][A-Za-z\s&.,'()-]+(?:Sdn\.?\s*Bhd\.?|Berhad|Ltd|Pte))/gm;
      let match;
      while ((match = companyPattern.exec(textContent)) !== null) {
        const name = match[1].trim();
        if (name.length > 3 && name.length < 200) {
          entities.push(this.createEntity(name, 'Registered'));
        }
      }
    }

    // Log section breakdown
    const byStatus = entities.reduce(
      (acc, e) => {
        const s = e.status || 'Unknown';
        acc[s] = (acc[s] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
    for (const [status, count] of Object.entries(byStatus)) {
      logger.info(this.config.id, `  ${status}: ${count} entities`);
    }

    return entities;
  }

  /** Detect which section (A/B/C/D) a table belongs to */
  private detectSection($: cheerio.CheerioAPI, table: cheerio.Cheerio<cheerio.Element>): string {
    // Look at parent elements and preceding headings
    const parent = table.parent();
    const parentText = parent.text().substring(0, 500).toLowerCase();
    const prevHeading = table.prevAll('h2, h3, h4, h5, strong, .heading').first().text().toLowerCase();
    const accordion = table.closest('.accordion-item, .card, .collapse, [class*="section"]');
    const accordionHeading = accordion.find('.accordion-header, .card-header, h3, h4').first().text().toLowerCase();

    const textToCheck = `${prevHeading} ${accordionHeading} ${parentText}`;

    if (textToCheck.includes('revok') && textToCheck.includes('7c(1)(b)')) return 'Revoked-7C1b';
    if (textToCheck.includes('revok') && textToCheck.includes('7c(1)(a)')) return 'Revoked-7C1a';
    if (textToCheck.includes('revok')) return 'Revoked';
    if (textToCheck.includes('transition')) return 'Transitional';
    if (textToCheck.includes('section a') || textToCheck.includes('currently')) return 'Registered';

    return 'Registered'; // Default to active
  }

  /** Parse a table row into an entity */
  private parseTableRow(
    $: cheerio.CheerioAPI,
    cells: cheerio.Cheerio<cheerio.Element>,
    sectionLabel: string
  ): ParsedEntity | null {
    let name = '';
    let address = '';

    if (cells.length >= 3) {
      // Pattern: [No] [Name] [Address]
      const first = $(cells[0]).text().trim();
      const offset = /^\d+$/.test(first) ? 1 : 0;
      name = $(cells[offset]).text().trim();
      if (cells.length > offset + 1) {
        address = $(cells[offset + 1]).text().trim();
      }
    } else if (cells.length === 2) {
      name = $(cells[0]).text().trim();
      address = $(cells[1]).text().trim();
    } else if (cells.length === 1) {
      name = $(cells[0]).text().trim();
    }

    // Clean up name
    name = this.cleanName(name);

    if (!name || name.length < 3) return null;

    // Determine status from section
    const status = this.mapSectionToStatus(sectionLabel);

    return this.createEntity(name, status);
  }

  private createEntity(name: string, status: string): ParsedEntity {
    return {
      name,
      licenseNumber: `MY-SC-DAX-${name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 25)}`,
      countryCode: 'MY',
      country: 'Malaysia',
      licenseType: 'Registered Digital Asset Exchange',
      status,
      regulator: 'SC Malaysia',
      activities: ['Digital Asset Exchange'],
      sourceUrl: SOURCE_URL,
    };
  }

  private mapSectionToStatus(section: string): string {
    if (section.includes('Revoked')) return 'Revoked';
    if (section.includes('Transitional')) return 'Transitional';
    return 'Registered';
  }

  private extractCompanyName(text: string): string | null {
    // Remove leading numbers: "1. " or "1) "
    const cleaned = text.replace(/^\d+[.)]\s*/, '').trim();
    // Split on newline/address markers — company name is usually first line
    const name = cleaned.split(/\n|address|registered office/i)[0].trim();
    if (name.length > 3 && name.length < 200) return name;
    return null;
  }

  private cleanName(name: string): string {
    return name
      .replace(/\s+/g, ' ')
      .replace(/^\d+[.)]\s*/, '') // Remove leading numbering
      .trim();
  }
}
