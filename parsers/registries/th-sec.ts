/**
 * Thailand SEC — Digital Asset Business Operators
 *
 * Source: SEC Thailand license check portal
 * URL: https://market.sec.or.th/LicenseCheck/views/DABusiness
 * ~42 licensed operators across 7 categories: Exchange, Broker, Dealer,
 * Fund Manager, Advisory, Custodial Wallet, ICO Portal
 * Format: ASP.NET WebForms GridView tables (server-rendered HTML)
 *
 * Notes:
 * - Buddhist Era calendar: displayed years = CE + 543
 * - Each category is a separate GridView on the page
 * - English version: append /en to URLs
 */

import * as cheerio from 'cheerio';
import type { RegistryParser, ParserConfig, ParseResult, ParsedEntity } from '../core/types.js';
import { fetchWithRetry } from '../core/client.js';
import { logger } from '../core/logger.js';

const BASE_URL = 'https://market.sec.or.th/LicenseCheck/views/DABusiness';

/** Categories mapping: URL path → license type label */
const CATEGORIES: { path: string; label: string; gridPrefix: string }[] = [
  { path: 'Exchange', label: 'Digital Asset Exchange', gridPrefix: 'gvExchange' },
  { path: 'Broker', label: 'Digital Asset Broker', gridPrefix: 'gvBroker' },
  { path: 'Dealer', label: 'Digital Asset Dealer', gridPrefix: 'gvDealer' },
  { path: 'FundManager', label: 'Digital Asset Fund Manager', gridPrefix: 'gvFundManager' },
  { path: 'Advisory', label: 'Digital Asset Advisory Service', gridPrefix: 'gvAdvisory' },
  { path: 'CustodialWallet', label: 'Custodial Wallet Provider', gridPrefix: 'gvCustodialWallet' },
  { path: 'ICO', label: 'ICO Portal', gridPrefix: 'gvICO' },
];

export class ThSecParser implements RegistryParser {
  config: ParserConfig = {
    id: 'th-sec',
    name: 'Thailand SEC Digital Asset Business Operators',
    countryCode: 'TH',
    country: 'Thailand',
    regulator: 'SEC (Securities and Exchange Commission)',
    url: BASE_URL,
    sourceType: 'html',
    rateLimit: 8_000,
    needsProxy: false,
    needsBrowser: false,
  };

  async parse(): Promise<ParseResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const errors: string[] = [];
    const allEntities: ParsedEntity[] = [];

    // Strategy 1: Fetch the main page (might contain all GridViews)
    logger.info(this.config.id, `Fetching main page: ${BASE_URL}`);
    const mainHtml = await this.fetchPage(`${BASE_URL}/en`);
    const mainEntities = this.parseAllGridViews(mainHtml, warnings);

    if (mainEntities.length > 0) {
      logger.info(this.config.id, `Found ${mainEntities.length} entities on main page`);
      allEntities.push(...mainEntities);
    } else {
      // Strategy 2: Fetch each category page separately
      logger.info(this.config.id, 'Main page empty, trying individual category pages...');

      for (const cat of CATEGORIES) {
        const url = `${BASE_URL}/${cat.path}/en`;
        logger.info(this.config.id, `Fetching category: ${cat.label} → ${url}`);

        try {
          const html = await this.fetchPage(url);
          const entities = this.parseCategoryPage(html, cat, warnings);
          logger.info(this.config.id, `  ${cat.label}: ${entities.length} entities`);
          allEntities.push(...entities);
        } catch (err) {
          const msg = `Failed to fetch ${cat.label}: ${err instanceof Error ? err.message : String(err)}`;
          warnings.push(msg);
          logger.warn(this.config.id, msg);
        }
      }
    }

    // Strategy 3: Try query-string format (?exchange/en)
    if (allEntities.length === 0) {
      logger.info(this.config.id, 'Category pages empty, trying query-string format...');

      for (const cat of CATEGORIES) {
        const url = `${BASE_URL}?${cat.path.toLowerCase()}/en`;
        try {
          const html = await this.fetchPage(url);
          const entities = this.parseCategoryPage(html, cat, warnings);
          if (entities.length > 0) {
            logger.info(this.config.id, `  ${cat.label}: ${entities.length} entities`);
            allEntities.push(...entities);
          }
        } catch {
          // Silent — just a fallback
        }
      }
    }

    // Deduplicate by name (same company can appear in multiple categories)
    const deduped = this.deduplicateEntities(allEntities);
    if (allEntities.length !== deduped.length) {
      warnings.push(`Deduplicated: ${allEntities.length} → ${deduped.length} entities`);
    }

    if (deduped.length === 0) {
      warnings.push('No entities found — page may require JavaScript rendering or ASP.NET ViewState POST');
    }

    logger.info(this.config.id, `Total: ${deduped.length} unique entities`);

    return {
      registryId: this.config.id,
      countryCode: 'TH',
      entities: deduped,
      totalFound: deduped.length,
      durationMs: Date.now() - startTime,
      warnings,
      errors,
      timestamp: new Date().toISOString(),
    };
  }

  private async fetchPage(url: string): Promise<string> {
    return fetchWithRetry(url, {
      registryId: this.config.id,
      rateLimit: this.config.rateLimit,
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,th;q=0.8',
      },
    });
  }

  /** Parse ALL GridView tables on a single page (Strategy 1) */
  private parseAllGridViews(html: string, warnings: string[]): ParsedEntity[] {
    const $ = cheerio.load(html);
    const entities: ParsedEntity[] = [];

    for (const cat of CATEGORIES) {
      // Try finding GridView by known prefix patterns
      const gridSelectors = [
        `[id*="${cat.gridPrefix}"]`,
        `table[id*="${cat.gridPrefix}"]`,
        `#ContentPlaceHolder1_${cat.gridPrefix}`,
        `#ctl00_ContentPlaceHolder1_${cat.gridPrefix}`,
      ];

      for (const selector of gridSelectors) {
        const grid = $(selector).first();
        if (grid.length > 0) {
          const parsed = this.parseGridView($, grid, cat.label, warnings);
          entities.push(...parsed);
          break;
        }
      }
    }

    return entities;
  }

  /** Parse a single category page */
  private parseCategoryPage(
    html: string,
    cat: { path: string; label: string; gridPrefix: string },
    warnings: string[]
  ): ParsedEntity[] {
    const $ = cheerio.load(html);
    const entities: ParsedEntity[] = [];

    // Try GridView by ID
    const gridSelectors = [
      `[id*="${cat.gridPrefix}"]`,
      `table[id*="gv"]`,
      `#ContentPlaceHolder1_${cat.gridPrefix}`,
      'table.table',
      '.table-responsive table',
      'table',
    ];

    for (const selector of gridSelectors) {
      $(selector).each((_, table) => {
        const parsed = this.parseGridView($, $(table), cat.label, warnings);
        entities.push(...parsed);
      });
      if (entities.length > 0) break;
    }

    // Fallback: parse any visible text that looks like entity data
    if (entities.length === 0) {
      this.parseGenericContent($, cat.label, entities, warnings);
    }

    return entities;
  }

  /** Parse an ASP.NET GridView table */
  private parseGridView(
    $: cheerio.CheerioAPI,
    table: cheerio.Cheerio<cheerio.Element>,
    licenseType: string,
    _warnings: string[]
  ): ParsedEntity[] {
    const entities: ParsedEntity[] = [];

    table.find('tr').each((rowIdx, row) => {
      const cells = $(row).find('td');
      if (cells.length < 2) return;

      // Skip header rows
      const firstCellText = $(cells[0]).text().trim();
      if (
        firstCellText.toLowerCase().includes('no.') ||
        firstCellText.toLowerCase().includes('company') ||
        firstCellText === '#' ||
        firstCellText === '' && rowIdx === 0
      ) {
        return;
      }

      // Try to extract entity data
      // Common GridView patterns:
      // [No] [Name] [License#] [Date] [Status]
      // or [Name] [License#] [Type] [Date]
      let name = '';
      let licenseNumber = '';
      let status = 'Licensed';
      let dateStr = '';

      if (cells.length >= 4) {
        // Skip row number if first cell is numeric
        const offset = /^\d+$/.test(firstCellText) ? 1 : 0;
        name = $(cells[offset]).text().trim();
        licenseNumber = $(cells[offset + 1]).text().trim();
        dateStr = $(cells[offset + 2]).text().trim();
        if (cells.length > offset + 3) {
          status = $(cells[offset + 3]).text().trim() || 'Licensed';
        }
      } else if (cells.length >= 2) {
        name = $(cells[0]).text().trim();
        licenseNumber = $(cells[1]).text().trim();
      }

      // Also try extracting from span elements with specific IDs
      if (!name) {
        const nameSpan = $(row).find('[id*="txtName"], [id*="lblName"], [id*="NameEN"]').first();
        name = nameSpan.text().trim();
      }
      if (!licenseNumber) {
        const licSpan = $(row).find('[id*="txtLicense"], [id*="lblLicense"], [id*="LicenseNo"]').first();
        licenseNumber = licSpan.text().trim();
      }

      if (name && name.length > 2) {
        // Convert Buddhist Era date to CE if present
        if (dateStr) {
          dateStr = this.convertBuddhistEra(dateStr);
        }

        entities.push({
          name: this.cleanName(name),
          licenseNumber: licenseNumber || `TH-SEC-${name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 20)}`,
          countryCode: 'TH',
          country: 'Thailand',
          licenseType,
          status: this.normalizeStatus(status),
          regulator: 'SEC Thailand',
          activities: [licenseType],
          sourceUrl: `${BASE_URL}/en`,
        });
      }
    });

    return entities;
  }

  /** Fallback: parse any structured content that looks like entities */
  private parseGenericContent(
    $: cheerio.CheerioAPI,
    licenseType: string,
    entities: ParsedEntity[],
    _warnings: string[]
  ): void {
    // Look for company names in various containers
    const containers = $('div.panel, div.card, .content-area, .main-content, #content, .panel-body');

    containers.find('h4, h5, strong, b, .company-name, [class*="name"]').each((_, el) => {
      const text = $(el).text().trim();
      if (
        text.length > 3 &&
        text.length < 200 &&
        !text.match(/^(home|about|contact|menu|search|login|register|page)/i) &&
        (text.match(/co\.?,?\s*ltd/i) || text.match(/company|plc|inc|corp/i) || text.match(/จำกัด/))
      ) {
        entities.push({
          name: this.cleanName(text),
          licenseNumber: `TH-SEC-${text.replace(/[^a-zA-Z0-9]/g, '').substring(0, 20)}`,
          countryCode: 'TH',
          country: 'Thailand',
          licenseType,
          status: 'Licensed',
          regulator: 'SEC Thailand',
          activities: [licenseType],
          sourceUrl: `${BASE_URL}/en`,
        });
      }
    });
  }

  /** Convert Buddhist Era year to CE (subtract 543) */
  private convertBuddhistEra(dateStr: string): string {
    return dateStr.replace(/\b(25\d{2}|26\d{2})\b/g, (match) => {
      const ce = parseInt(match, 10) - 543;
      return ce.toString();
    });
  }

  private cleanName(name: string): string {
    return name
      .replace(/\s+/g, ' ')
      .replace(/^\d+\.\s*/, '') // Remove leading numbering
      .trim();
  }

  private normalizeStatus(status: string): string {
    const s = status.toLowerCase();
    if (s.includes('revok') || s.includes('cancel')) return 'Revoked';
    if (s.includes('suspend')) return 'Suspended';
    if (s.includes('approv') || s.includes('licens') || s.includes('active')) return 'Licensed';
    if (s.includes('pend')) return 'Pending';
    return status || 'Licensed';
  }

  /** Deduplicate entities by name (keep first occurrence = richer data) */
  private deduplicateEntities(entities: ParsedEntity[]): ParsedEntity[] {
    const seen = new Map<string, ParsedEntity>();
    for (const entity of entities) {
      const key = entity.name.toLowerCase().replace(/\s+/g, ' ').trim();
      if (!seen.has(key)) {
        seen.set(key, entity);
      } else {
        // Merge activities if same company has multiple license types
        const existing = seen.get(key)!;
        if (entity.activities) {
          const existingActivities = new Set(existing.activities || []);
          for (const act of entity.activities) {
            if (!existingActivities.has(act)) {
              existing.activities = [...(existing.activities || []), act];
            }
          }
        }
      }
    }
    return Array.from(seen.values());
  }
}
