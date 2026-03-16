/**
 * UK FCA — Crypto Asset Registered Firms
 *
 * Source: FCA Financial Services Register
 * URL: https://register.fca.org.uk/s/search?predefined=CA
 * ~40-50 crypto-registered firms
 *
 * The FCA Register is a Salesforce Lightning SPA that cannot be scraped via simple HTTP.
 * There is a free REST API that requires registration for an API key.
 * This parser uses the public search results page and attempts HTML extraction.
 * For production use, register for FCA API key and use API mode.
 *
 * API Base: https://register.fca.org.uk/services/V0.1/
 * Rate Limit: 50 requests per 10 seconds
 */

import * as cheerio from 'cheerio';
import type { RegistryParser, ParserConfig, ParseResult, ParsedEntity } from '../core/types.js';
import { fetchWithRetry, fetchJsonWithRetry } from '../core/client.js';
import { logger } from '../core/logger.js';

const REGISTER_URL = 'https://register.fca.org.uk/s/search?predefined=CA';
const API_BASE = 'https://register.fca.org.uk/services/V0.1';

interface FcaApiResponse {
  Status: string;
  ResultInfo: {
    page: string;
    per_page: string;
    total_count: string;
  };
  Data: Array<{
    'Organisation Name': string;
    'FRN': string;
    'Status': string;
    'Type': string;
  }>;
}

export class GbFcaParser implements RegistryParser {
  config: ParserConfig = {
    id: 'gb-fca',
    name: 'UK FCA Crypto Asset Registered Firms',
    countryCode: 'GB',
    country: 'United Kingdom',
    regulator: 'FCA (Financial Conduct Authority)',
    url: REGISTER_URL,
    sourceType: 'api',
    rateLimit: 5_000,
    needsProxy: false,
    needsBrowser: true, // SPA needs browser for full scraping
  };

  async parse(): Promise<ParseResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const errors: string[] = [];

    // Try API first (if API key is configured)
    const apiKey = process.env.FCA_API_KEY;
    const apiEmail = process.env.FCA_API_EMAIL;
    let entities: ParsedEntity[] = [];

    if (apiKey) {
      logger.info(this.config.id, 'Using FCA API with API key');
      if (!apiEmail) {
        warnings.push('FCA_API_EMAIL is not set. If FCA API rejects requests, add FCA_API_EMAIL in .env.local.');
      }
      entities = await this.parseViaApi(apiKey, apiEmail, warnings);
      if (entities.length === 0) {
        warnings.push('FCA API returned 0 entities. Falling back to HTML scraping.');
        const htmlEntities = await this.parseViaHtml(warnings);
        entities = this.mergeByName(entities, htmlEntities);
      }
    } else {
      logger.info(this.config.id, 'No FCA_API_KEY configured, attempting HTML scraping');
      warnings.push('No FCA_API_KEY set. HTML scraping may yield limited results. Register at register.fca.org.uk for API access.');

      entities = await this.parseViaHtml(warnings);
    }

    logger.info(this.config.id, `Parsed ${entities.length} entities`);

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

  /** Parse using FCA REST API */
  private async parseViaApi(
    apiKey: string,
    apiEmail: string | undefined,
    warnings: string[],
  ): Promise<ParsedEntity[]> {
    const entities: ParsedEntity[] = [];
    let page = 1;
    const perPage = 20;
    let totalCount = 0;

    do {
      try {
        const url = `${API_BASE}/Firm?q=&Type=Crypto%20Asset&page=${page}&per_page=${perPage}`;
        logger.info(this.config.id, `Fetching FCA API page ${page}`);

        const response = await fetchJsonWithRetry<FcaApiResponse>(url, {
          registryId: this.config.id,
          rateLimit: 200, // 50 req/10s = 200ms apart
          headers: {
            'X-Auth-Key': apiKey,
            ...(apiEmail ? { 'X-Auth-Email': apiEmail } : {}),
          },
        });

        if (response.Status !== 'Success' && response.Status !== 'FSR-API-02-01-11') {
          warnings.push(`FCA API returned status: ${response.Status}`);
          break;
        }

        totalCount = parseInt(response.ResultInfo.total_count, 10);

        for (const firm of response.Data) {
          const name = firm['Organisation Name'] ?? '';
          const frn = firm['FRN'] ?? '';
          const status = firm['Status'] ?? '';

          if (!name) continue;

          entities.push({
            name: name.trim(),
            licenseNumber: frn,
            countryCode: 'GB',
            country: 'United Kingdom',
            status: status.trim() || 'Registered',
            regulator: 'FCA',
            licenseType: 'Crypto Asset Registration',
            activities: ['Crypto Asset Activities'],
            sourceUrl: `${REGISTER_URL}`,
          });
        }

        page++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        warnings.push(`FCA API error on page ${page}: ${msg}`);
        break;
      }
    } while (entities.length < totalCount && page <= 10);

    return entities;
  }

  /** Fallback: attempt HTML scraping (limited due to SPA) */
  private async parseViaHtml(warnings: string[]): Promise<ParsedEntity[]> {
    try {
      const html = await fetchWithRetry(REGISTER_URL, {
        registryId: this.config.id,
        rateLimit: 5_000,
      });

      const $ = cheerio.load(html);
      const entities: ParsedEntity[] = [];

      // The FCA register SPA may not render data in initial HTML
      // Try to find any pre-rendered content
      const selectors = [
        '.slds-table tbody tr',
        '[data-entity-name]',
        '.search-result-item',
        '.firm-name a',
      ];

      for (const selector of selectors) {
        $(selector).each((_, el) => {
          const name = $(el).text().trim();
          const href = $(el).attr('href') ?? '';

          if (name && name.length > 3) {
            // Extract FRN from link if available
            const frnMatch = href.match(/\/(\d{6,})/);
            const frn = frnMatch ? frnMatch[1] : '';

            entities.push({
              name,
              licenseNumber: frn || `FCA-${name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 30)}`,
              countryCode: 'GB',
              country: 'United Kingdom',
              status: 'Registered',
              regulator: 'FCA',
              licenseType: 'Crypto Asset Registration',
              activities: ['Crypto Asset Activities'],
              sourceUrl: REGISTER_URL,
            });
          }
        });

        if (entities.length > 0) break;
      }

      if (entities.length === 0) {
        warnings.push(
          'FCA Register is a Salesforce SPA — HTML scraping returned 0 results. ' +
          'Set FCA_API_KEY env var or use Playwright browser for proper data extraction.'
        );
      }

      return entities;
    } catch (err) {
      warnings.push(`HTML scraping failed: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    }
  }

  private mergeByName(primary: ParsedEntity[], secondary: ParsedEntity[]): ParsedEntity[] {
    const byName = new Map<string, ParsedEntity>();
    for (const entity of primary) {
      byName.set(entity.name.toLowerCase().trim(), entity);
    }
    for (const entity of secondary) {
      const key = entity.name.toLowerCase().trim();
      if (!byName.has(key)) {
        byName.set(key, entity);
      }
    }
    return Array.from(byName.values());
  }
}
