/**
 * US NYDFS — BitLicense & Virtual Currency Businesses
 *
 * Source: NY Department of Financial Services
 * URL: https://www.dfs.ny.gov/virtual_currency_businesses
 *
 * Simple HTML page with a list of licensed/chartered entities.
 * ~40-50 entities. Straightforward scraping.
 */

import * as cheerio from 'cheerio';
import type { RegistryParser, ParserConfig, ParseResult, ParsedEntity } from '../core/types.js';
import { fetchWithRetry } from '../core/client.js';
import { logger } from '../core/logger.js';

const SOURCE_URL = 'https://www.dfs.ny.gov/virtual_currency_businesses';

export class UsNydfsParser implements RegistryParser {
  config: ParserConfig = {
    id: 'us-nydfs',
    name: 'US NYDFS BitLicense & Virtual Currency',
    countryCode: 'US',
    country: 'United States',
    regulator: 'NYDFS (NY Department of Financial Services)',
    url: SOURCE_URL,
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

    try {
      logger.info(this.config.id, 'Fetching NYDFS virtual currency businesses page');

      const html = await fetchWithRetry(SOURCE_URL, {
        registryId: this.config.id,
        rateLimit: 5_000,
      });

      const $ = cheerio.load(html);

      // The page has sections for BitLicense holders and chartered entities
      // Look for lists and tables with entity names

      // Try multiple selector strategies
      const seen = new Set<string>();

      // Strategy 1: Look for list items in content area
      $('.field--name-body li, .node__content li, .content li, article li').each((_, el) => {
        const text = $(el).text().trim();
        if (text && text.length > 3 && text.length < 200) {
          // Skip navigation/menu items
          if (text.toLowerCase().includes('home') || text.toLowerCase().includes('contact') ||
              text.toLowerCase().includes('click here') || text.toLowerCase().includes('learn more')) {
            return;
          }
          const name = text.split(/[–—\-\(]/)[0].trim();
          if (name && name.length > 3 && !seen.has(name.toLowerCase())) {
            seen.add(name.toLowerCase());
            entities.push(this.createEntity(name, 'BitLicense'));
          }
        }
      });

      // Strategy 2: Look for table rows
      $('table tr').each((_, row) => {
        const cells = $(row).find('td');
        if (cells.length >= 1) {
          const name = $(cells[0]).text().trim();
          if (name && name.length > 3 && !seen.has(name.toLowerCase())) {
            seen.add(name.toLowerCase());
            const type = cells.length > 1 ? $(cells[1]).text().trim() : 'BitLicense';
            entities.push(this.createEntity(name, type));
          }
        }
      });

      // Strategy 3: Look for strong/bold text in paragraphs (company names)
      $('.field--name-body strong, .node__content strong, .content strong').each((_, el) => {
        const text = $(el).text().trim();
        if (text && text.length > 3 && text.length < 150 && !seen.has(text.toLowerCase())) {
          // Heuristic: company names usually have Inc, LLC, Corp, Ltd, etc.
          if (/(?:Inc|LLC|Corp|Ltd|Limited|Co\.|Trust|Bank|Financial|Capital|Exchange|Pay|Bit|Crypto|Coin|Digital|Block)/i.test(text)) {
            seen.add(text.toLowerCase());
            entities.push(this.createEntity(text, 'BitLicense'));
          }
        }
      });

      // Strategy 4: paragraphs with entity-like names
      $('p, div.field-item').each((_, el) => {
        const text = $(el).text().trim();
        // Look for lines that look like "Company Name — BitLicense" or similar patterns
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 5);
        for (const line of lines) {
          if (/(?:Inc|LLC|Corp|Ltd|Limited|Co\.|Trust|Bank|N\.?A\.?)/i.test(line) && line.length < 150) {
            const name = line.split(/[–—\-]/)[0].trim();
            if (name && name.length > 3 && !seen.has(name.toLowerCase())) {
              seen.add(name.toLowerCase());
              entities.push(this.createEntity(name, 'BitLicense'));
            }
          }
        }
      });

      if (entities.length === 0) {
        warnings.push(
          'NYDFS page structure may have changed. Got 0 entities. Check HTML selectors.'
        );
      }

      logger.info(this.config.id, `Found ${entities.length} entities`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`NYDFS scraping failed: ${msg}`);
      logger.error(this.config.id, msg);
    }

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

  private createEntity(name: string, licenseType: string): ParsedEntity {
    // Determine if it's a BitLicense or Charter
    const isCharter = /charter/i.test(licenseType);
    const cleanType = isCharter ? 'Virtual Currency Charter' : 'BitLicense';

    return {
      name: name.trim(),
      licenseNumber: `NYDFS-${name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 30)}`,
      countryCode: 'US',
      country: 'United States',
      status: 'Licensed',
      regulator: 'NYDFS',
      licenseType: cleanType,
      activities: isCharter
        ? ['Virtual Currency Business', 'Banking']
        : ['Virtual Currency Business', 'Money Transmission'],
      sourceUrl: SOURCE_URL,
    };
  }
}
