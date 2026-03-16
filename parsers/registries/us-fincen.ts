/**
 * US FinCEN — Money Services Businesses (MSBs)
 *
 * Source: FinCEN MSB Registrant Search
 * URL: https://www.fincen.gov/msb-registrant-search
 *
 * NOTE: FinCEN's MSB search is a legacy HTML form inside an iframe with no API
 * and no bulk download. This parser attempts to submit the form programmatically
 * and parse results. For comprehensive data, browser automation is recommended.
 *
 * The search supports filtering by:
 * - State/jurisdiction
 * - MSB activities (money transmitter, currency dealer, etc.)
 * - Legal name
 */

import * as cheerio from 'cheerio';
import type { RegistryParser, ParserConfig, ParseResult, ParsedEntity } from '../core/types.js';
import { logger } from '../core/logger.js';

const SOURCE_URL = 'https://www.fincen.gov/msb-registrant-search';

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

export class UsFincenParser implements RegistryParser {
  config: ParserConfig = {
    id: 'us-fincen',
    name: 'US FinCEN Money Services Businesses',
    countryCode: 'US',
    country: 'United States',
    regulator: 'FinCEN (Financial Crimes Enforcement Network)',
    url: SOURCE_URL,
    sourceType: 'html',
    rateLimit: 15_000,
    needsProxy: false,
    needsBrowser: true, // Form-based search needs browser automation
  };

  async parse(): Promise<ParseResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const errors: string[] = [];
    const entities: ParsedEntity[] = [];

    // FinCEN MSB search requires form submission
    // Try to fetch and parse the search results for money transmitters
    // (the most common category for crypto businesses)

    try {
      logger.info(this.config.id, 'Attempting to fetch FinCEN MSB search page');

      const response = await fetch(SOURCE_URL, {
        headers: DEFAULT_HEADERS,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Try to find the iframe source URL
      const iframeSrc = $('iframe').attr('src') ?? '';
      logger.info(this.config.id, `Found iframe: ${iframeSrc || 'none'}`);

      // The actual search form is inside the iframe
      // We need to submit it with appropriate parameters
      if (iframeSrc) {
        const formEntities = await this.searchViaForm(iframeSrc, warnings);
        entities.push(...formEntities);
      }

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`FinCEN search failed: ${msg}`);
    }

    // If form-based search didn't work, try to scrape any listed entities from the main page
    if (entities.length === 0) {
      warnings.push(
        'FinCEN MSB search requires browser automation for comprehensive results. ' +
        'The search form is embedded in an iframe and requires interactive form submission. ' +
        'Consider using Playwright for production data collection.'
      );
    }

    logger.info(this.config.id, `Total entities: ${entities.length}`);

    return {
      registryId: this.config.id,
      countryCode: 'US',
      entities,
      totalFound: entities.length,
      durationMs: Date.now() - startTime,
      warnings,
      errors,
      timestamp: new Date().toISOString(),
    };
  }

  /** Attempt to submit the FinCEN search form programmatically */
  private async searchViaForm(formUrl: string, warnings: string[]): Promise<ParsedEntity[]> {
    const entities: ParsedEntity[] = [];

    try {
      // Resolve the full URL if relative
      const url = formUrl.startsWith('http') ? formUrl : `https://www.fincen.gov${formUrl}`;

      // First, fetch the form to get any CSRF tokens or hidden fields
      const formResponse = await fetch(url, {
        headers: DEFAULT_HEADERS,
      });

      if (!formResponse.ok) {
        warnings.push(`Form page HTTP ${formResponse.status}`);
        return entities;
      }

      const formHtml = await formResponse.text();
      const $ = cheerio.load(formHtml);

      // Try to find and submit the search form
      // Look for form action URL
      const form = $('form').first();
      const action = form.attr('action') ?? '';
      const method = (form.attr('method') ?? 'GET').toUpperCase();

      logger.info(this.config.id, `Form action: ${action}, method: ${method}`);

      // Collect form fields
      const params = new URLSearchParams();
      form.find('input, select').each((_, el) => {
        const tagName = el.tagName?.toLowerCase();
        const name = $(el).attr('name');
        if (!name) return;

        // Skip submit/reset controls.
        const inputType = ($(el).attr('type') ?? '').toLowerCase();
        if (tagName === 'input' && (inputType === 'submit' || inputType === 'reset' || inputType === 'button')) return;

        // Set money transmitter on activity-like controls.
        if (name.toLowerCase().includes('activity') || name.toLowerCase().includes('type')) {
          params.set(name, 'Money Transmitter');
          return;
        }

        if (tagName === 'select') {
          const selected = $(el).find('option[selected]').first();
          const firstOption = $(el).find('option').first();
          const selectedValue = selected.attr('value') ?? selected.text().trim();
          const fallbackValue = firstOption.attr('value') ?? firstOption.text().trim();
          params.set(name, selectedValue || fallbackValue || '');
          return;
        }

        const value = $(el).attr('value') ?? '';
        params.set(name, value);
      });

      // Submit the form
      const searchUrl = action ? new URL(action, url).toString() : url;

      const searchResponse = await fetch(
        method === 'GET' ? `${searchUrl}?${params.toString()}` : searchUrl,
        {
          method,
          headers: method === 'POST'
            ? { ...DEFAULT_HEADERS, 'Content-Type': 'application/x-www-form-urlencoded' }
            : DEFAULT_HEADERS,
          body: method === 'POST' ? params.toString() : undefined,
        },
      );

      if (!searchResponse.ok) {
        warnings.push(`Search response HTTP ${searchResponse.status}`);
        return entities;
      }

      const resultHtml = await searchResponse.text();
      const $results = cheerio.load(resultHtml);

      // Parse search results
      const seen = new Set<string>();
      $results('table tr').each((_, row) => {
        const cells = $results(row).find('td');
        if (cells.length < 2) return;

        const name = $results(cells[0]).text().trim();
        if (!name || name.toLowerCase().includes('legal name')) return;

        const dba = cells.length > 1 ? $results(cells[1]).text().trim() : '';
        const key = `${name.toLowerCase()}|${(dba || '').toLowerCase()}`;
        if (seen.has(key)) return;
        seen.add(key);

        entities.push({
          name,
          licenseNumber: `FINCEN-${name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 30)}`,
          countryCode: 'US',
          country: 'United States',
          status: 'Registered',
          regulator: 'FinCEN',
          licenseType: 'MSB Registration',
          activities: ['Money Transmitter'],
          entityTypes: dba ? [dba] : undefined,
          sourceUrl: SOURCE_URL,
        });
      });

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`Form submission failed: ${msg}`);
    }

    return entities;
  }
}
