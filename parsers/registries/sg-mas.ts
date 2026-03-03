/**
 * Singapore MAS — Digital Payment Token (DPT) Service Providers
 *
 * Source: HTML scraping from MAS Financial Institutions Directory
 * URL: https://eservices.mas.gov.sg/fid/institution
 * ~37 DPT licensed entities
 * Format: HTML cards, paginated (10/50/100/All per page)
 */

import * as cheerio from 'cheerio';
import type { RegistryParser, ParserConfig, ParseResult, ParsedEntity } from '../core/types.js';
import { fetchWithRetry } from '../core/client.js';
import { logger } from '../core/logger.js';

const BASE_URL = 'https://eservices.mas.gov.sg/fid/institution';

export class SgMasParser implements RegistryParser {
  config: ParserConfig = {
    id: 'sg-mas',
    name: 'Singapore MAS Digital Payment Token Service Providers',
    countryCode: 'SG',
    country: 'Singapore',
    regulator: 'MAS (Monetary Authority of Singapore)',
    url: BASE_URL,
    sourceType: 'html',
    rateLimit: 10_000,
    needsProxy: false,
    needsBrowser: false,
  };

  async parse(): Promise<ParseResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const errors: string[] = [];
    const entities: ParsedEntity[] = [];

    // Fetch list page with all results (rows=100 should get most/all)
    const listUrls = [
      // Major Payment Institutions with DPT
      `${BASE_URL}?sector=Payments&category=Major+Payment+Institution&activity=Digital+Payment+Token+Service&rows=100`,
      // Standard Payment Institutions with DPT
      `${BASE_URL}?sector=Payments&category=Standard+Payment+Institution&activity=Digital+Payment+Token+Service&rows=100`,
    ];

    for (const url of listUrls) {
      try {
        logger.info(this.config.id, `Fetching: ${url}`);
        const html = await fetchWithRetry(url, {
          registryId: this.config.id,
          rateLimit: 5_000,
        });

        const pageEntities = this.parseListPage(html, url);
        entities.push(...pageEntities);
        logger.info(this.config.id, `Found ${pageEntities.length} entities from page`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        warnings.push(`Failed to fetch ${url}: ${msg}`);
      }
    }

    // Deduplicate by name (same entity might appear in both categories)
    const seen = new Set<string>();
    const unique = entities.filter((e) => {
      const key = e.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    logger.info(this.config.id, `Total unique entities: ${unique.length}`);

    return {
      registryId: this.config.id,
      countryCode: 'SG',
      entities: unique,
      totalFound: unique.length,
      durationMs: Date.now() - startTime,
      warnings,
      errors,
      timestamp: new Date().toISOString(),
    };
  }

  private parseListPage(html: string, sourceUrl: string): ParsedEntity[] {
    const $ = cheerio.load(html);
    const entities: ParsedEntity[] = [];

    // MAS FID uses card-style layout. Look for institution name links/headers
    // Typical structure: <div class="..."> with institution name as <a> or <h> element

    // Try multiple selectors for institution names
    const selectors = [
      '.institution-name a',
      '.institution-name',
      '.search-result-name a',
      '.search-result-name',
      'h4.inst-name a',
      '.entity-name a',
      '[data-entity-name]',
      // Generic: links that go to institution detail pages
      'a[href*="/fid/institution/detail/"]',
    ];

    for (const selector of selectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        elements.each((_, el) => {
          const name = $(el).text().trim();
          const href = $(el).attr('href') ?? '';

          if (name && name.length > 2 && !name.toLowerCase().includes('search')) {
            // Extract license info from detail link if available
            const detailUrl = href.startsWith('http') ? href : href.startsWith('/') ? `https://eservices.mas.gov.sg${href}` : '';

            entities.push({
              name,
              licenseNumber: `MAS-DPT-${name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 30)}`,
              countryCode: 'SG',
              country: 'Singapore',
              status: 'Licensed',
              regulator: 'MAS',
              licenseType: 'Major Payment Institution',
              activities: ['Digital Payment Token Service'],
              website: detailUrl || undefined,
              sourceUrl,
            });
          }
        });

        if (entities.length > 0) break; // Found entities with this selector
      }
    }

    // Fallback: try to extract from any structured list
    if (entities.length === 0) {
      // Look for table rows
      $('table tbody tr').each((_, row) => {
        const cells = $(row).find('td');
        if (cells.length >= 2) {
          const name = $(cells[0]).text().trim();
          if (name && name.length > 2) {
            entities.push({
              name,
              licenseNumber: `MAS-DPT-${name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 30)}`,
              countryCode: 'SG',
              country: 'Singapore',
              status: 'Licensed',
              regulator: 'MAS',
              licenseType: 'Payment Institution',
              activities: ['Digital Payment Token Service'],
              sourceUrl,
            });
          }
        }
      });
    }

    return entities;
  }
}
