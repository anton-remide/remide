/**
 * Australia AUSTRAC — Digital Currency Exchange (DCE) Providers
 *
 * Source: AUSTRAC Registration Actions page (static HTML)
 * URL: https://www.austrac.gov.au/digital-currency-exchange-provider-registration-actions
 *
 * NOTE: AUSTRAC's full DCE register at online.austrac.gov.au requires interactive
 * search queries with no bulk download. We use the registration actions page
 * (cancellations, suspensions, conditions) as a partial data source and supplement
 * with known registered DCEs.
 *
 * For comprehensive data, a browser-based search automation would be needed.
 */

import * as cheerio from 'cheerio';
import type { RegistryParser, ParserConfig, ParseResult, ParsedEntity } from '../core/types.js';
import { fetchWithRetry } from '../core/client.js';
import { logger } from '../core/logger.js';

const ACTIONS_URL = 'https://www.austrac.gov.au/digital-currency-exchange-provider-registration-actions';
const DCE_PAGE_URL = 'https://www.austrac.gov.au/business/your-industry/digital-currency-cryptocurrency/digital-currency-exchange-providers';

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').replace(/[^\w\s]/g, '').trim();
}

function extractAustracId(text: string): string | undefined {
  const patterns = [
    /(?:abn|acn|id|registration)\s*[:#]?\s*([A-Z0-9\-\/]{4,})/i,
    /\b([A-Z]{2,5}-\d{3,}[A-Z0-9\-]*)\b/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return undefined;
}

function inferStatus(action: string): string {
  const actionLower = action.toLowerCase();
  if (actionLower.includes('cancel')) return 'Cancelled';
  if (actionLower.includes('suspend')) return 'Suspended';
  if (actionLower.includes('condition')) return 'Conditional';
  if (actionLower.includes('refuse') || actionLower.includes('reject')) return 'Refused';
  if (actionLower.includes('cease')) return 'Ceased';
  return 'Registered';
}

function looksLikeCompanyName(name: string): boolean {
  return /(?:pty|ltd|llc|inc|corp|co\.|company|gmbh|sa|plc|exchange|digital|crypto|coin|bit)/i.test(name);
}

export class AuAustracParser implements RegistryParser {
  config: ParserConfig = {
    id: 'au-austrac',
    name: 'Australia AUSTRAC Digital Currency Exchanges',
    countryCode: 'AU',
    country: 'Australia',
    regulator: 'AUSTRAC (Australian Transaction Reports and Analysis Centre)',
    url: ACTIONS_URL,
    sourceType: 'html',
    rateLimit: 15_000, // AUSTRAC is slow
    needsProxy: false,
    needsBrowser: true,
  };

  async parse(): Promise<ParseResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const errors: string[] = [];
    const entities: ParsedEntity[] = [];

    // Fetch the registration actions page
    try {
      logger.info(this.config.id, `Fetching AUSTRAC actions page: ${ACTIONS_URL}`);
      const html = await fetchWithRetry(ACTIONS_URL, {
        registryId: this.config.id,
        rateLimit: 15_000,
        timeout: 60_000,
      });

      const actionEntities = this.parseActionsPage(html);
      entities.push(...actionEntities);
      logger.info(this.config.id, `Found ${actionEntities.length} entities from registration actions`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`Failed to fetch actions page: ${msg}`);
    }

    // Also try to fetch the DCE info page for any listed entities
    try {
      logger.info(this.config.id, `Fetching AUSTRAC DCE page: ${DCE_PAGE_URL}`);
      const html = await fetchWithRetry(DCE_PAGE_URL, {
        registryId: this.config.id,
        timeout: 60_000,
      });

      const pageEntities = this.parseDcePage(html);
      // Add only new entities not already found
      const existingNames = new Set(entities.map((e) => e.name.toLowerCase()));
      for (const entity of pageEntities) {
        if (!existingNames.has(entity.name.toLowerCase())) {
          entities.push(entity);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`Failed to fetch DCE page: ${msg}`);
    }

    if (entities.length === 0) {
      warnings.push(
        'AUSTRAC full DCE register requires interactive search (online.austrac.gov.au). ' +
        'Only registration actions are available via static scraping. ' +
        'Consider implementing browser-based search for comprehensive data.'
      );
    }

    logger.info(this.config.id, `Total entities: ${entities.length}`);

    // Final dedup across strategies
    const byName = new Map<string, ParsedEntity>();
    for (const entity of entities) {
      const key = normalizeName(entity.name);
      if (!byName.has(key)) byName.set(key, entity);
    }
    const unique = Array.from(byName.values());

    return {
      registryId: this.config.id,
      countryCode: 'AU',
      entities: unique,
      totalFound: unique.length,
      durationMs: Date.now() - startTime,
      warnings,
      errors,
      timestamp: new Date().toISOString(),
    };
  }

  /** Parse the registration actions page for entity names and statuses */
  private parseActionsPage(html: string): ParsedEntity[] {
    const $ = cheerio.load(html);
    const entities: ParsedEntity[] = [];

    // Look for tables listing registration actions
    $('table').each((_, table) => {
      $(table).find('tbody tr, tr').each((_, row) => {
        const cells = $(row).find('td');
        if (cells.length < 2) return;

        const name = $(cells[0]).text().replace(/\s+/g, ' ').trim();
        const action = cells.length > 1 ? $(cells[1]).text().trim() : '';
        const rowText = $(row).text().replace(/\s+/g, ' ').trim();

        if (!name) return;
        const lowerName = name.toLowerCase();
        if (lowerName === 'business name' || lowerName === 'entity name' || lowerName === 'name') return;
        if ((lowerName.includes('business name') || lowerName.includes('entity')) && !looksLikeCompanyName(name)) return;
        if (name.length < 3) return;

        const status = inferStatus(action || rowText);

        entities.push({
          name,
          licenseNumber: extractAustracId(rowText) || `AUSTRAC-${name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 30)}`,
          countryCode: 'AU',
          country: 'Australia',
          status,
          regulator: 'AUSTRAC',
          licenseType: 'DCE Registration',
          activities: ['Digital Currency Exchange'],
          sourceUrl: ACTIONS_URL,
        });
      });
    });

    // Also check for non-table listings (definition lists, etc.)
    $('h3, h4').each((_, heading) => {
      const text = $(heading).text().trim();
      if (text.length > 5 && text.length < 100) {
        // Check if followed by details about registration action
        const next = $(heading).next().text().toLowerCase();
        if (next.includes('registr') || next.includes('cancel') || next.includes('suspend')) {
          const existingNames = entities.map((e) => e.name.toLowerCase());
          if (!existingNames.includes(text.toLowerCase())) {
            entities.push({
              name: text,
              licenseNumber: `AUSTRAC-${text.replace(/[^a-zA-Z0-9]/g, '').substring(0, 30)}`,
              countryCode: 'AU',
              country: 'Australia',
              status: 'Registration Action',
              regulator: 'AUSTRAC',
              licenseType: 'DCE Registration',
              activities: ['Digital Currency Exchange'],
              sourceUrl: ACTIONS_URL,
            });
          }
        }
      }
    });

    return entities;
  }

  /** Parse the DCE info page for any mentioned entity names */
  private parseDcePage(html: string): ParsedEntity[] {
    const $ = cheerio.load(html);
    const entities: ParsedEntity[] = [];

    // Look for any lists of registered entities
    $('ul li, ol li').each((_, item) => {
      const text = $(item).text().trim();
      // Look for text that mentions specific DCE providers
      if (text.length > 5 && text.length < 150) {
        const hasIndicators = /(?:Pty|Ltd|exchange|digital|crypto|coin|bit)/i.test(text);
        if (hasIndicators) {
          entities.push({
            name: text.split(/[(\n]/)[0].trim(),
            licenseNumber: extractAustracId(text) || `AUSTRAC-DCE-${text.replace(/[^a-zA-Z0-9]/g, '').substring(0, 25)}`,
            countryCode: 'AU',
            country: 'Australia',
            status: 'Registered',
            regulator: 'AUSTRAC',
            licenseType: 'DCE Registration',
            activities: ['Digital Currency Exchange'],
            sourceUrl: DCE_PAGE_URL,
          });
        }
      }
    });

    // Some AUSTRAC pages use plain tables instead of lists.
    $('table tbody tr, table tr').each((_, row) => {
      const cells = $(row).find('td');
      if (!cells.length) return;
      const first = $(cells[0]).text().replace(/\s+/g, ' ').trim();
      if (!first || first.length < 3) return;
      const lowerFirst = first.toLowerCase();
      if (lowerFirst === 'business name' || lowerFirst === 'entity name' || lowerFirst === 'name') return;
      if ((lowerFirst.includes('business name') || lowerFirst.includes('entity')) && !looksLikeCompanyName(first)) return;
      const rowText = $(row).text().replace(/\s+/g, ' ').trim();
      entities.push({
        name: first,
        licenseNumber: extractAustracId(rowText) || `AUSTRAC-DCE-${first.replace(/[^a-zA-Z0-9]/g, '').substring(0, 25)}`,
        countryCode: 'AU',
        country: 'Australia',
        status: inferStatus(rowText),
        regulator: 'AUSTRAC',
        licenseType: 'DCE Registration',
        activities: ['Digital Currency Exchange'],
        sourceUrl: DCE_PAGE_URL,
      });
    });

    return entities;
  }
}
