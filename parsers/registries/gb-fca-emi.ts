/**
 * UK FCA — Electronic Money Institutions (EMI)
 *
 * Source: FCA Financial Services Register.
 * API mode is preferred when FCA API credentials are configured.
 */

import * as cheerio from 'cheerio';
import type { ParsedEntity, ParseResult, ParserConfig, RegistryParser } from '../core/types.js';
import { fetchJsonWithRetry, fetchWithRetry } from '../core/client.js';
import { logger } from '../core/logger.js';

const REGISTER_URL = 'https://register.fca.org.uk/s/search?predefined=EMI';
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

type KnownEmi = { name: string; frn: string };

const KNOWN_EMI_FALLBACK: KnownEmi[] = [
  { name: 'Revolut Ltd', frn: '900562' },
  { name: 'PayPal (Europe) S.a r.l. et Cie, S.C.A.', frn: '994790' },
  { name: 'Stripe Payments UK Ltd', frn: '900461' },
  { name: 'Wise Payments Ltd', frn: '900507' },
  { name: 'Checkout Ltd', frn: '900816' },
  { name: 'Nium Fintech Ltd', frn: '901024' },
  { name: 'PPS EU SA UK Branch', frn: '900010' },
  { name: 'The Currency Cloud Limited', frn: '900199' },
];

export class GbFcaEmiParser implements RegistryParser {
  config: ParserConfig = {
    id: 'gb-fca-emi',
    name: 'UK FCA Electronic Money Institutions',
    countryCode: 'GB',
    country: 'United Kingdom',
    regulator: 'FCA (Financial Conduct Authority)',
    url: REGISTER_URL,
    sourceType: 'api',
    rateLimit: 5_000,
    needsProxy: false,
    needsBrowser: true,
  };

  async parse(): Promise<ParseResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const errors: string[] = [];

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
        warnings.push('FCA EMI API returned 0 entities. Falling back to HTML scraping.');
        const htmlEntities = await this.parseViaHtml(warnings);
        entities = this.mergeByName(entities, htmlEntities);
      }
    } else {
      warnings.push('No FCA_API_KEY set. Using HTML/fallback for EMI registry.');
      entities = await this.parseViaHtml(warnings);
    }

    if (entities.length === 0) {
      warnings.push('FCA EMI API/HTML returned 0 entities. Using known EMI fallback list.');
      entities = KNOWN_EMI_FALLBACK.map((firm) => this.toEntity(firm.name, firm.frn, 'Registered'));
    }

    return {
      registryId: this.config.id,
      countryCode: this.config.countryCode,
      entities,
      totalFound: entities.length,
      durationMs: Date.now() - startTime,
      warnings,
      errors,
      timestamp: new Date().toISOString(),
    };
  }

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
        const url = `${API_BASE}/Firm?q=&Type=Electronic%20Money%20Institution&page=${page}&per_page=${perPage}`;
        const response = await fetchJsonWithRetry<FcaApiResponse>(url, {
          registryId: this.config.id,
          rateLimit: 200,
          headers: {
            'X-Auth-Key': apiKey,
            ...(apiEmail ? { 'X-Auth-Email': apiEmail } : {}),
          },
        });

        if (response.Status !== 'Success' && response.Status !== 'FSR-API-02-01-11') {
          warnings.push(`FCA EMI API returned status: ${response.Status}`);
          break;
        }

        totalCount = parseInt(response.ResultInfo.total_count, 10);
        for (const firm of response.Data) {
          const name = (firm['Organisation Name'] ?? '').trim();
          if (!name) continue;
          entities.push(this.toEntity(name, firm['FRN'] ?? '', firm['Status'] ?? 'Registered'));
        }
        page++;
      } catch (err) {
        warnings.push(`FCA EMI API error on page ${page}: ${err instanceof Error ? err.message : String(err)}`);
        break;
      }
    } while (entities.length < totalCount && page <= 20);

    return entities;
  }

  private async parseViaHtml(warnings: string[]): Promise<ParsedEntity[]> {
    try {
      const html = await fetchWithRetry(REGISTER_URL, {
        registryId: this.config.id,
        rateLimit: 5_000,
      });
      const $ = cheerio.load(html);
      const entities: ParsedEntity[] = [];

      const selectors = ['.firm-name a', '.search-result-item', '[data-entity-name]', '.slds-table tbody tr'];
      for (const selector of selectors) {
        $(selector).each((_, el) => {
          const name = $(el).text().trim();
          if (!name || name.length < 4) return;
          const href = $(el).attr('href') ?? '';
          const frn = href.match(/\/(\d{6,})/)?.[1] ?? '';
          entities.push(this.toEntity(name, frn, 'Registered'));
        });
        if (entities.length > 0) break;
      }

      if (entities.length === 0) {
        warnings.push('FCA EMI HTML scraping returned 0 entities (SPA content likely not server-rendered).');
      }
      return entities;
    } catch (err) {
      warnings.push(`FCA EMI HTML scraping failed: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    }
  }

  private toEntity(name: string, frn: string, status: string): ParsedEntity {
    return {
      name: name.trim(),
      licenseNumber: frn?.trim() || `FCA-EMI-${name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 30)}`,
      countryCode: 'GB',
      country: 'United Kingdom',
      status: status.trim() || 'Registered',
      regulator: 'FCA',
      licenseType: 'Electronic Money Institution',
      activities: ['Electronic Money Services', 'Payment Services'],
      sourceUrl: REGISTER_URL,
    };
  }

  private mergeByName(primary: ParsedEntity[], secondary: ParsedEntity[]): ParsedEntity[] {
    const byName = new Map<string, ParsedEntity>();
    for (const e of primary) byName.set(e.name.toLowerCase().trim(), e);
    for (const e of secondary) {
      const key = e.name.toLowerCase().trim();
      if (!byName.has(key)) byName.set(key, e);
    }
    return Array.from(byName.values());
  }
}

