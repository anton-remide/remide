/**
 * HK SFC — Virtual Asset Trading Platform Operators
 *
 * Source: Securities and Futures Commission (SFC)
 * URL: https://www.sfc.hk/en/Welcome-to-the-Fintech-Contact-Point/Virtual-assets/Virtual-asset-trading-platforms-operators/Lists-of-virtual-asset-trading-platforms
 *
 * Simple HTML page listing licensed, deemed-licensed, and applicant VATPs.
 * ~12 entities.
 */

import * as cheerio from 'cheerio';
import type { RegistryParser, ParserConfig, ParseResult, ParsedEntity } from '../core/types.js';
import { fetchWithRetry } from '../core/client.js';
import { logger } from '../core/logger.js';
import { isRegistryWebsite } from '../../shared/registry-domains.js';

const SOURCE_URL = 'https://www.sfc.hk/en/Welcome-to-the-Fintech-Contact-Point/Virtual-assets/Virtual-asset-trading-platforms-operators/Lists-of-virtual-asset-trading-platforms';

export class HkSfcParser implements RegistryParser {
  config: ParserConfig = {
    id: 'hk-sfc',
    name: 'Hong Kong SFC Virtual Asset Trading Platforms',
    countryCode: 'HK',
    country: 'Hong Kong',
    regulator: 'SFC (Securities and Futures Commission)',
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
    const seen = new Set<string>();

    try {
      logger.info(this.config.id, 'Fetching SFC VATP list');

      const html = await fetchWithRetry(SOURCE_URL, {
        registryId: this.config.id,
        rateLimit: 5_000,
      });

      const $ = cheerio.load(html);

      // SFC page has tables for different categories:
      // 1. Licensed VATPs
      // 2. Deemed Licensed VATPs
      // 3. Applicants for VATP Licence
      // 4. Closing Down / Returned

      let currentSection = 'Licensed';

      // Process all tables on the page
      $('table').each((_, table) => {
        // Try to determine section from preceding heading
        const prevHeading = $(table).prevAll('h2, h3, h4, p strong').first().text().trim().toLowerCase();
        if (prevHeading.includes('licensed') && !prevHeading.includes('deemed')) {
          currentSection = 'Licensed';
        } else if (prevHeading.includes('deemed')) {
          currentSection = 'Deemed Licensed';
        } else if (prevHeading.includes('applicant')) {
          currentSection = 'Applicant';
        } else if (prevHeading.includes('clos') || prevHeading.includes('return')) {
          currentSection = 'Closing Down';
        }

        $(table).find('tr').each((_, row) => {
          const cells = $(row).find('td');
          if (cells.length < 1) return;

          const name = $(cells[0]).text().trim();
          if (!name || name.length < 2) return;
          // Skip header rows
          if (/^(name|platform|entity|no\.|#)/i.test(name)) return;

          const key = name.toLowerCase();
          if (seen.has(key)) return;
          seen.add(key);

          const licenseNum = cells.length > 1 ? $(cells[1]).text().trim() : '';
          const rawLink = $(cells[0]).find('a').attr('href') || (cells.length > 2 ? $(cells[2]).find('a').attr('href') : '');
          const website = rawLink && rawLink.startsWith('http') && !isRegistryWebsite(rawLink) ? rawLink : undefined;

          entities.push({
            name,
            licenseNumber: licenseNum || `SFC-VATP-${name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 25)}`,
            countryCode: 'HK',
            country: 'Hong Kong',
            status: currentSection,
            regulator: 'SFC',
            licenseType: 'VATP Licence',
            activities: ['Virtual Asset Trading Platform'],
            website,
            sourceUrl: rawLink && rawLink.startsWith('http') ? rawLink : SOURCE_URL,
          });
        });
      });

      // Fallback: try list items and strong tags
      if (entities.length === 0) {
        $('li, .content-detail li').each((_, el) => {
          const text = $(el).text().trim();
          if (text && text.length > 3 && text.length < 200) {
            const name = text.split(/[–—\-\(]/)[0].trim();
            if (name && !seen.has(name.toLowerCase())) {
              seen.add(name.toLowerCase());
              entities.push({
                name,
                licenseNumber: `SFC-VATP-${name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 25)}`,
                countryCode: 'HK',
                country: 'Hong Kong',
                status: 'Listed',
                regulator: 'SFC',
                licenseType: 'VATP Licence',
                activities: ['Virtual Asset Trading Platform'],
                sourceUrl: SOURCE_URL,
              });
            }
          }
        });
      }

      if (entities.length === 0) {
        warnings.push('SFC VATP page returned 0 entities. Page structure may have changed or JS rendering needed.');
      }

      logger.info(this.config.id, `Found ${entities.length} entities`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`HK SFC scraping failed: ${msg}`);
      logger.error(this.config.id, msg);
    }

    return {
      registryId: this.config.id,
      countryCode: 'HK',
      entities,
      totalFound: entities.length,
      durationMs: Date.now() - startTime,
      warnings,
      errors,
      timestamp: new Date().toISOString(),
    };
  }
}
