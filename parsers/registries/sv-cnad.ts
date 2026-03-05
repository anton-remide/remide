/**
 * SV CNAD — El Salvador Digital Asset Service Providers
 *
 * Source: Comisión Nacional de Activos Digitales
 * URL: https://cnad.gob.sv/registro-publico/proveedores-de-servicio-de-activos-digitales/
 *
 * HTML page with cards/lists of registered DASPs.
 * ~44+ entities. El Salvador was early Bitcoin Legal Tender adopter.
 */

import * as cheerio from 'cheerio';
import type { RegistryParser, ParserConfig, ParseResult, ParsedEntity } from '../core/types.js';
import { fetchWithRetry } from '../core/client.js';
import { logger } from '../core/logger.js';

const SOURCE_URL = 'https://cnad.gob.sv/registro-publico/proveedores-de-servicio-de-activos-digitales/';

export class SvCnadParser implements RegistryParser {
  config: ParserConfig = {
    id: 'sv-cnad',
    name: 'El Salvador CNAD Digital Asset Service Providers',
    countryCode: 'SV',
    country: 'El Salvador',
    regulator: 'CNAD (Comisión Nacional de Activos Digitales)',
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
      logger.info(this.config.id, 'Fetching El Salvador CNAD DASP registry');

      const html = await fetchWithRetry(SOURCE_URL, {
        registryId: this.config.id,
        rateLimit: 5_000,
      });

      const $ = cheerio.load(html);

      // Strategy 1: Look for card-style layouts (WordPress common)
      $('.wp-block-column, .elementor-widget-container, .entry-content .wp-block-group, .card, .provider-card').each((_, card) => {
        const name = $(card).find('h2, h3, h4, h5, strong, .title').first().text().trim();
        if (!name || name.length < 3 || seen.has(name.toLowerCase())) return;

        // Try to find registration number
        const fullText = $(card).text();
        const regMatch = fullText.match(/(?:registro|reg|no|#|número)[:\s]*([A-Z0-9\-\.]+)/i);
        const regNum = regMatch ? regMatch[1] : '';

        seen.add(name.toLowerCase());
        entities.push(this.createEntity(name, regNum));
      });

      // Strategy 2: Tables
      $('table').each((_, table) => {
        $(table).find('tr').each((_, row) => {
          const cells = $(row).find('td');
          if (cells.length < 1) return;

          let nameIdx = 0;
          const first = $(cells[0]).text().trim();
          if (/^\d+\.?$/.test(first) && cells.length > 1) nameIdx = 1;

          const name = $(cells[nameIdx]).text().trim();
          if (!name || name.length < 3) return;
          if (/^(no|#|nombre|name|razón|proveedor)/i.test(name)) return;

          const key = name.toLowerCase();
          if (seen.has(key)) return;
          seen.add(key);

          const regNum = cells.length > nameIdx + 1 ? $(cells[nameIdx + 1]).text().trim() : '';
          entities.push(this.createEntity(name, regNum));
        });
      });

      // Strategy 3: List items
      if (entities.length === 0) {
        $('ol li, .entry-content li, article li').each((_, el) => {
          const text = $(el).text().trim();
          if (text && text.length > 3 && text.length < 200) {
            const name = text.split(/[–—\(]/)[0].trim();
            if (name && name.length > 3 && !seen.has(name.toLowerCase())) {
              seen.add(name.toLowerCase());
              entities.push(this.createEntity(name, ''));
            }
          }
        });
      }

      // Strategy 4: Paragraphs/divs with strong tags
      if (entities.length === 0) {
        $('strong, b').each((_, el) => {
          const text = $(el).text().trim();
          if (text && text.length > 5 && text.length < 150) {
            if (/(?:S\.?A\.?|Inc|LLC|Ltd|Corp|Bitcoin|Crypto|Digital|Exchange|Pay|Finance|Capital)/i.test(text)) {
              const key = text.toLowerCase();
              if (!seen.has(key)) {
                seen.add(key);
                entities.push(this.createEntity(text, ''));
              }
            }
          }
        });
      }

      if (entities.length === 0) {
        warnings.push('CNAD page returned 0 entities. May need JS rendering or page structure changed.');
      }

      logger.info(this.config.id, `Found ${entities.length} entities`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`SV CNAD scraping failed: ${msg}`);
      logger.error(this.config.id, msg);
    }

    return {
      registryId: this.config.id,
      countryCode: 'SV',
      entities,
      totalFound: entities.length,
      durationMs: Date.now() - startTime,
      warnings,
      errors,
      timestamp: new Date().toISOString(),
    };
  }

  private createEntity(name: string, regNum: string): ParsedEntity {
    return {
      name: name.trim(),
      licenseNumber: regNum && regNum.length > 2 && !/^(reg|tipo|type)/i.test(regNum)
        ? regNum
        : `CNAD-${name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 25)}`,
      countryCode: 'SV',
      country: 'El Salvador',
      status: 'Registered',
      regulator: 'CNAD',
      licenseType: 'DASP Registration',
      activities: ['Digital Asset Services', 'Bitcoin Services'],
      sourceUrl: SOURCE_URL,
    };
  }
}
