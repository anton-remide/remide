/**
 * UAE VARA — Virtual Asset Service Providers (Dubai)
 *
 * Source: HTML page from VARA website
 * URL: https://www.vara.ae/en/licenses-and-register/public-register/
 * ~23-31 licensed VASPs
 * Format: Static HTML table/cards
 */

import * as cheerio from 'cheerio';
import type { RegistryParser, ParserConfig, ParseResult, ParsedEntity } from '../core/types.js';
import { fetchWithRetry } from '../core/client.js';
import { logger } from '../core/logger.js';

const SOURCE_URL = 'https://www.vara.ae/en/licenses-and-register/public-register/';

export class AeVaraParser implements RegistryParser {
  config: ParserConfig = {
    id: 'ae-vara',
    name: 'UAE VARA Virtual Asset Service Providers',
    countryCode: 'AE',
    country: 'United Arab Emirates',
    regulator: 'VARA (Virtual Assets Regulatory Authority)',
    url: SOURCE_URL,
    sourceType: 'html',
    rateLimit: 10_000,
    needsProxy: false,
    needsBrowser: true, // May need JS rendering
  };

  async parse(): Promise<ParseResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const errors: string[] = [];

    logger.info(this.config.id, `Fetching VARA register from ${SOURCE_URL}`);

    let html: string;
    try {
      html = await fetchWithRetry(SOURCE_URL, {
        registryId: this.config.id,
        rateLimit: 5_000,
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });
    } catch (err) {
      throw new Error(`Failed to fetch VARA register: ${err instanceof Error ? err.message : String(err)}`);
    }

    const entities = this.parseRegisterPage(html, warnings);
    logger.info(this.config.id, `Parsed ${entities.length} entities`);

    // If HTML scraping yields no results, the page might need JS rendering
    if (entities.length === 0) {
      warnings.push('No entities found — page may require JavaScript rendering (Playwright)');
    }

    return {
      registryId: this.config.id,
      countryCode: 'AE',
      entities,
      totalFound: entities.length,
      durationMs: Date.now() - startTime,
      warnings,
      errors,
      timestamp: new Date().toISOString(),
    };
  }

  private parseRegisterPage(html: string, _warnings: string[]): ParsedEntity[] {
    const $ = cheerio.load(html);
    const entities: ParsedEntity[] = [];

    // VARA uses a table-like layout with CSS classes tr-registry, th-tp, etc.
    // Try multiple extraction strategies

    // Strategy 1: Standard HTML table
    $('table tr, .tr-registry').each((_, row) => {
      const cells = $(row).find('td, .td-cell, [class*="td"]');
      if (cells.length < 2) return;

      const name = $(cells[0]).text().trim();
      if (!name || name.toLowerCase().includes('entity') || name.toLowerCase().includes('name')) return;

      const status = cells.length > 1 ? $(cells[1]).text().trim() : 'Licensed';
      const activities = cells.length > 2 ? $(cells[2]).text().trim() : '';

      entities.push(this.createEntity(name, status, activities));
    });

    // Strategy 2: Card-based layout
    if (entities.length === 0) {
      const cardSelectors = [
        '.register-card',
        '.registry-item',
        '.vasp-card',
        '[class*="register"]',
        '[class*="registry"]',
      ];

      for (const selector of cardSelectors) {
        $(selector).each((_, card) => {
          const name = $(card).find('h3, h4, .name, .title, [class*="name"]').first().text().trim();
          const status = $(card).find('.status, [class*="status"], .badge').first().text().trim();
          const activities = $(card).find('.activities, [class*="activity"], .services').first().text().trim();

          if (name && name.length > 2) {
            entities.push(this.createEntity(name, status || 'Licensed', activities));
          }
        });

        if (entities.length > 0) break;
      }
    }

    // Strategy 3: Generic structured data extraction
    if (entities.length === 0) {
      // Look for any list-like structure with company names
      $('li, .list-item, [class*="item"]').each((_, item) => {
        const text = $(item).text().trim();
        // Skip navigation items, short text
        if (text.length < 5 || text.length > 200) return;
        if (text.toLowerCase().includes('menu') || text.toLowerCase().includes('nav')) return;

        // Check if it looks like a company name
        const hasCompanyIndicators = /(?:LLC|Ltd|Inc|Corp|FZE|DMCC|exchange|crypto|digital|token|bit|coin)/i.test(text);
        if (hasCompanyIndicators) {
          entities.push(this.createEntity(text.split('\n')[0].trim(), 'Licensed', ''));
        }
      });
    }

    return entities;
  }

  private createEntity(name: string, status: string, activitiesRaw: string): ParsedEntity {
    const activities = activitiesRaw
      ? activitiesRaw.split(/[,;|]/).map((s) => s.trim()).filter(Boolean)
      : [];

    // Determine license type from status
    let licenseType = 'Full VASP License';
    const statusLower = status.toLowerCase();
    if (statusLower.includes('principle') || statusLower.includes('ipa')) {
      licenseType = 'In-Principle Approval';
    } else if (statusLower.includes('provisional')) {
      licenseType = 'Provisional License';
    }

    return {
      name,
      licenseNumber: `VARA-${name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 30)}`,
      countryCode: 'AE',
      country: 'United Arab Emirates',
      status: status || 'Licensed',
      regulator: 'VARA',
      licenseType,
      activities: activities.length > 0 ? activities : ['Virtual Asset Services'],
      sourceUrl: SOURCE_URL,
    };
  }
}
