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
    needsBrowser: true, // Changed to true as content might be loaded dynamically
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
        rateLimit: 10_000,
        timeout: 30_000, // Increased timeout
      });

      const $ = cheerio.load(html);

      // Check if we got a complete page
      const bodyContent = $('body').html() || '';
      const hasMainContent = bodyContent.includes('virtual asset trading platform') || 
                            bodyContent.includes('VATP') ||
                            bodyContent.includes('Licensed') ||
                            bodyContent.includes('table') ||
                            bodyContent.length > 10000;

      if (!hasMainContent) {
        warnings.push('Page appears incomplete - content may be loaded dynamically or truncated');
      }

      // SFC page has tables for different categories:
      // 1. Licensed VATPs
      // 2. Deemed Licensed VATPs
      // 3. Applicants for VATP Licence
      // 4. Closing Down / Returned

      let currentSection = 'Licensed';

      // Process all tables on the page
      $('table').each((_, table) => {
        // Try to determine section from preceding heading
        const prevHeading = $(table).prevAll('h1, h2, h3, h4, p strong, .heading').first().text().trim().toLowerCase();
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
          const cells = $(row).find('td, th');
          if (cells.length < 1) return;

          const name = $(cells[0]).text().trim();
          if (!name || name.length < 2) return;
          // Skip header rows
          if (/^(name|platform|entity|no\.|#|type|status)/i.test(name)) return;

          const key = name.toLowerCase();
          if (seen.has(key)) return;
          seen.add(key);

          const licenseNum = cells.length > 1 ? $(cells[1]).text().trim() : '';
          const rawLink = $(cells[0]).find('a').attr('href') || (cells.length > 2 ? $(cells[2]).find('a').attr('href') : '');
          let website = rawLink && rawLink.startsWith('http') && !isRegistryWebsite(rawLink) ? rawLink : undefined;
          
          // Handle relative URLs
          if (rawLink && rawLink.startsWith('/')) {
            const fullUrl = `https://www.sfc.hk${rawLink}`;
            if (!isRegistryWebsite(fullUrl)) {
              website = fullUrl;
            }
          }

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
            sourceUrl: website || SOURCE_URL,
          });
        });
      });

      // Enhanced fallback: try content sections and divs
      if (entities.length === 0) {
        $('li, .content-detail li, .main-content li, .content li').each((_, el) => {
          const text = $(el).text().trim();
          if (text && text.length > 3 && text.length < 200) {
            // Extract name (everything before dash, bracket, or other separator)
            const name = text.split(/[–—\-\(\[\|]/)[0].trim();
            if (name && name.length > 2 && !seen.has(name.toLowerCase())) {
              seen.add(name.toLowerCase());
              
              const link = $(el).find('a').attr('href');
              let website = undefined;
              if (link && link.startsWith('http') && !isRegistryWebsite(link)) {
                website = link;
              } else if (link && link.startsWith('/')) {
                const fullUrl = `https://www.sfc.hk${link}`;
                if (!isRegistryWebsite(fullUrl)) {
                  website = fullUrl;
                }
              }

              entities.push({
                name,
                licenseNumber: `SFC-VATP-${name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 25)}`,
                countryCode: 'HK',
                country: 'Hong Kong',
                status: 'Listed',
                regulator: 'SFC',
                licenseType: 'VATP Licence',
                activities: ['Virtual Asset Trading Platform'],
                website,
                sourceUrl: website || SOURCE_URL,
              });
            }
          }
        });
      }

      // Additional fallback: look for div containers with VATP information
      if (entities.length === 0) {
        $('.vatp-list, .entity-list, .platform-list, .content-wrapper div, .main-content div').each((_, el) => {
          const text = $(el).text().trim();
          // Look for text that looks like entity names
          if (text && text.length > 5 && text.length < 150 && 
              /^[A-Z][a-zA-Z0-9\s&\-\.]+$/i.test(text) &&
              !text.includes('©') && !text.includes('www.') && !text.includes('http')) {
            
            const name = text.split(/[–—\-\(\[\|]/)[0].trim();
            if (name && name.length > 2 && !seen.has(name.toLowerCase())) {
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
        if (!hasMainContent) {
          warnings.push('SFC VATP page appears incomplete - may need browser rendering or content is dynamically loaded');
        } else {
          warnings.push('SFC VATP page returned 0 entities. Page structure may have changed or content is not accessible');
        }
        
        // Check if we can detect any relevant content at all
        const relevantContent = $('body').text().toLowerCase();
        if (relevantContent.includes('virtual asset') || relevantContent.includes('vatp')) {
          warnings.push('Page contains VATP-related content but entities could not be extracted');
        } else {
          warnings.push('Page does not appear to contain VATP-related content');
        }
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