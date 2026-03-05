/**
 * NG SEC — Nigeria Securities & Exchange Commission
 *
 * Source: SEC Nigeria FinTech Registered Operators
 * URL: https://home.sec.gov.ng/fintech-and-innovation-hub-finport/registered-fintech-operators/
 *
 * HTML page with tables listing registered fintech operators.
 * ~15 entities. Includes VASPs and digital asset exchanges.
 */

import * as cheerio from 'cheerio';
import type { RegistryParser, ParserConfig, ParseResult, ParsedEntity } from '../core/types.js';
import { fetchWithRetry } from '../core/client.js';
import { logger } from '../core/logger.js';

const SOURCE_URL = 'https://home.sec.gov.ng/fintech-and-innovation-hub-finport/registered-fintech-operators/';

export class NgSecParser implements RegistryParser {
  config: ParserConfig = {
    id: 'ng-sec',
    name: 'Nigeria SEC Registered Fintech Operators',
    countryCode: 'NG',
    country: 'Nigeria',
    regulator: 'SEC (Securities & Exchange Commission)',
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
      logger.info(this.config.id, 'Fetching Nigeria SEC fintech operators page');

      const html = await fetchWithRetry(SOURCE_URL, {
        registryId: this.config.id,
        rateLimit: 5_000,
      });

      const $ = cheerio.load(html);

      // Look for tables with registered operators
      $('table').each((_, table) => {
        // Determine table section from preceding heading
        const prevText = $(table).prevAll('h2, h3, h4, p, strong').first().text().trim();
        let category = 'Fintech Operator';
        if (/exchange|digital.*asset/i.test(prevText)) {
          category = 'Digital Asset Exchange';
        } else if (/VASP|virtual.*asset/i.test(prevText)) {
          category = 'Virtual Asset Service Provider';
        } else if (/robo|advisory/i.test(prevText)) {
          category = 'Robo-Advisory';
        } else if (/crowd/i.test(prevText)) {
          category = 'Crowdfunding';
        }

        $(table).find('tr').each((_, row) => {
          const cells = $(row).find('td');
          if (cells.length < 1) return;

          // First cell is usually S/N (serial number), second is name
          let nameIdx = 0;
          const firstCell = $(cells[0]).text().trim();
          if (/^\d+\.?$/.test(firstCell) && cells.length > 1) {
            nameIdx = 1;
          }

          const name = $(cells[nameIdx]).text().trim();
          if (!name || name.length < 3) return;
          if (/^(s\/n|name|company|serial|no\.)/i.test(name)) return;

          const key = name.toLowerCase();
          if (seen.has(key)) return;
          seen.add(key);

          // Try to extract registration number from next cell
          const regNum = cells.length > nameIdx + 1 ? $(cells[nameIdx + 1]).text().trim() : '';
          const website = $(cells[nameIdx]).find('a').attr('href') || '';

          entities.push({
            name,
            licenseNumber: regNum && regNum.length > 2 && !/^(reg|status|type)/i.test(regNum)
              ? regNum
              : `SEC-NG-${name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 25)}`,
            countryCode: 'NG',
            country: 'Nigeria',
            status: 'Registered',
            regulator: 'SEC Nigeria',
            licenseType: category,
            activities: [category, 'Fintech'],
            website: website && website.startsWith('http') ? website : undefined,
            sourceUrl: SOURCE_URL,
          });
        });
      });

      // Fallback: try ordered/unordered lists
      if (entities.length === 0) {
        $('ol li, .entry-content li, article li').each((_, el) => {
          const text = $(el).text().trim();
          if (text && text.length > 3 && text.length < 200) {
            // Extract company name (before any dash or parenthesis)
            const name = text.split(/[–—\-\(]/)[0].trim();
            if (name && name.length > 3 && !seen.has(name.toLowerCase())) {
              seen.add(name.toLowerCase());
              entities.push({
                name,
                licenseNumber: `SEC-NG-${name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 25)}`,
                countryCode: 'NG',
                country: 'Nigeria',
                status: 'Registered',
                regulator: 'SEC Nigeria',
                licenseType: 'Fintech Operator',
                activities: ['Fintech', 'Digital Assets'],
                sourceUrl: SOURCE_URL,
              });
            }
          }
        });
      }

      if (entities.length === 0) {
        warnings.push('Nigeria SEC page returned 0 entities. Page structure may have changed.');
      }

      logger.info(this.config.id, `Found ${entities.length} entities`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Nigeria SEC scraping failed: ${msg}`);
      logger.error(this.config.id, msg);
    }

    return {
      registryId: this.config.id,
      countryCode: 'NG',
      entities,
      totalFound: entities.length,
      durationMs: Date.now() - startTime,
      warnings,
      errors,
      timestamp: new Date().toISOString(),
    };
  }
}
