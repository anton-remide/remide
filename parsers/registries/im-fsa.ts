/**
 * Isle of Man FSA — Designated Businesses (incl. VASPs)
 *
 * Source: IoM Financial Services Authority Register
 * URL: https://www.iomfsa.im/register-results/?entity-name=&entity-current=on&BusinessType=8
 * ~300 designated businesses total (~22 are VASPs)
 * Format: HTML table with pagination (20 per page, 15 pages)
 *
 * ⚠️ Site is behind F5 BIG-IP WAF.
 * Requires browser session cookie (OClmoOot) to access.
 * Plain HTTP fetch will get "Request Rejected" page.
 * If blocked, needs Playwright to obtain session cookie.
 *
 * We collect ALL designated businesses (W0/W1 = full registry).
 * S4 enrichment will classify VASPs vs traditional.
 *
 * Entity detail pages: /registers/designated-business/?Id=<number>
 * Detail fields: Trading Name, Address, Category, Date Registered, Conditions
 */

import * as cheerio from 'cheerio';
import type { RegistryParser, ParserConfig, ParseResult, ParsedEntity } from '../core/types.js';
import { fetchWithRetry } from '../core/client.js';
import { logger } from '../core/logger.js';

const BASE_URL = 'https://www.iomfsa.im';
const REGISTER_URL = `${BASE_URL}/register-results/`;
const RESULTS_PER_PAGE = 20;

export class ImFsaParser implements RegistryParser {
  config: ParserConfig = {
    id: 'im-fsa',
    name: 'Isle of Man FSA Designated Businesses',
    countryCode: 'IM',
    country: 'Isle of Man',
    regulator: 'FSA (Financial Services Authority)',
    url: REGISTER_URL,
    sourceType: 'html',
    rateLimit: 5_000,
    needsProxy: false,
    needsBrowser: true, // F5 WAF requires browser session
  };

  async parse(): Promise<ParseResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const errors: string[] = [];
    const allEntities: ParsedEntity[] = [];

    // Fetch page 1 first to check accessibility and get total count
    const firstPageUrl = `${REGISTER_URL}?entity-name=&entity-current=on&BusinessType=8`;
    logger.info(this.config.id, `Fetching IoM FSA register page 1: ${firstPageUrl}`);

    let firstPageHtml: string;
    try {
      firstPageHtml = await fetchWithRetry(firstPageUrl, {
        registryId: this.config.id,
        rateLimit: this.config.rateLimit,
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-GB,en;q=0.9',
        },
      });
    } catch (err) {
      throw new Error(
        `Failed to fetch IoM FSA register: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    // Check for WAF block
    if (this.isWafBlocked(firstPageHtml)) {
      warnings.push('F5 WAF blocked request — "Request Rejected" page received. Needs Playwright for session cookie.');
      logger.warn(this.config.id, 'WAF blocked. Cannot proceed without browser session.');

      return {
        registryId: this.config.id,
        countryCode: 'IM',
        entities: [],
        totalFound: 0,
        durationMs: Date.now() - startTime,
        warnings,
        errors,
        timestamp: new Date().toISOString(),
      };
    }

    // Parse first page and determine total pages
    const firstPageEntities = this.parseResultsPage(firstPageHtml, warnings);
    allEntities.push(...firstPageEntities);

    const totalCount = this.extractTotalCount(firstPageHtml);
    const totalPages = totalCount > 0 ? Math.ceil(totalCount / RESULTS_PER_PAGE) : 1;

    logger.info(this.config.id, `Page 1: ${firstPageEntities.length} entities. Total: ${totalCount} (${totalPages} pages)`);

    // Fetch remaining pages
    for (let page = 2; page <= totalPages; page++) {
      const pageUrl = `${REGISTER_URL}?entity-name=&entity-current=on&BusinessType=8&Page=${page}`;
      logger.info(this.config.id, `Fetching page ${page}/${totalPages}...`);

      try {
        const html = await fetchWithRetry(pageUrl, {
          registryId: this.config.id,
          rateLimit: this.config.rateLimit,
          headers: {
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        });

        if (this.isWafBlocked(html)) {
          warnings.push(`WAF blocked page ${page}`);
          continue;
        }

        const pageEntities = this.parseResultsPage(html, warnings);
        allEntities.push(...pageEntities);
        logger.info(this.config.id, `  Page ${page}: ${pageEntities.length} entities`);
      } catch (err) {
        const msg = `Failed to fetch page ${page}: ${err instanceof Error ? err.message : String(err)}`;
        warnings.push(msg);
        logger.warn(this.config.id, msg);
      }
    }

    logger.info(this.config.id, `Total: ${allEntities.length} entities across ${totalPages} pages`);

    if (allEntities.length === 0) {
      warnings.push('No entities found — WAF may be blocking all requests');
    }

    return {
      registryId: this.config.id,
      countryCode: 'IM',
      entities: allEntities,
      totalFound: allEntities.length,
      durationMs: Date.now() - startTime,
      warnings,
      errors,
      timestamp: new Date().toISOString(),
    };
  }

  /** Check if the response is a WAF "Request Rejected" page */
  private isWafBlocked(html: string): boolean {
    return (
      html.includes('Request Rejected') ||
      html.includes('The requested URL was rejected') ||
      html.includes('support ID') && html.includes('blocked') ||
      html.length < 500 && html.includes('error')
    );
  }

  /** Extract total result count from heading: "300 result(s) for:" */
  private extractTotalCount(html: string): number {
    const $ = cheerio.load(html);

    // Try h1 with result count
    const h1Text = $('h1').text();
    const countMatch = h1Text.match(/(\d+)\s*result/i);
    if (countMatch) {
      return parseInt(countMatch[1], 10);
    }

    // Try any element with result count text
    const bodyText = $('body').text();
    const bodyMatch = bodyText.match(/(\d+)\s*result\(?s?\)?/i);
    if (bodyMatch) {
      return parseInt(bodyMatch[1], 10);
    }

    return 0;
  }

  /** Parse a single results page */
  private parseResultsPage(html: string, warnings: string[]): ParsedEntity[] {
    const $ = cheerio.load(html);
    const entities: ParsedEntity[] = [];

    // The table has class "reg-results" with columns: Name, Trading/Business Name, Business Type
    const table = $('table.reg-results, table');

    table.find('tbody tr, tr').each((_, row) => {
      const cells = $(row).find('td');
      if (cells.length < 2) return;

      // Column 1: Name (with link to detail page)
      const nameCell = $(cells[0]);
      const nameLink = nameCell.find('a').first();
      const name = (nameLink.length > 0 ? nameLink.text() : nameCell.text()).trim();
      const detailHref = nameLink.attr('href') || '';

      if (!name || name.length < 2) return;

      // Column 2: Trading/Business Name
      const tradingName = $(cells[1]).text().trim();

      // Column 3: Business Type (usually "Designated Business")
      const businessType = cells.length > 2 ? $(cells[2]).text().trim() : 'Designated Business';

      // Extract entity ID from detail URL: /registers/designated-business/?Id=67 → 67
      const idMatch = detailHref.match(/[?&]Id=(\d+)/i);
      const entityId = idMatch ? idMatch[1] : '';

      entities.push({
        name: this.cleanName(name),
        licenseNumber: entityId
          ? `IM-FSA-DB-${entityId}`
          : `IM-FSA-DB-${name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 25)}`,
        countryCode: 'IM',
        country: 'Isle of Man',
        licenseType: 'Designated Business',
        entityTypes: tradingName ? [tradingName] : undefined,
        status: 'Registered',
        regulator: 'FSA Isle of Man',
        activities: [businessType],
        sourceUrl: detailHref.startsWith('/')
          ? `${BASE_URL}${detailHref}`
          : `${REGISTER_URL}?entity-name=&entity-current=on&BusinessType=8`,
      });
    });

    return entities;
  }

  private cleanName(name: string): string {
    return name.replace(/\s+/g, ' ').trim();
  }
}
