/**
 * Seychelles FSA — Licensed Virtual Asset Service Providers (VASPs)
 *
 * Source: Financial Services Authority of Seychelles
 * URL: https://fsaseychelles.sc/vasp/licensed-vasps
 * ~8 unique companies (14 entries including duplicates across sections)
 * Format: Joomla/SP Page Builder with Bootstrap accordion cards
 *
 * Sections:
 * - Licensed VASPs (currently may be empty)
 * - Assessment stage VASPs
 *
 * Notes:
 * - Page uses custom `<spanl>` tags for labeled data
 * - Entity data in accordion cards: Name, Address, Date of Approval, Status
 * - Some companies appear in both Licensed and Assessment sections
 */

import * as cheerio from 'cheerio';
import type { RegistryParser, ParserConfig, ParseResult, ParsedEntity } from '../core/types.js';
import { fetchWithRetry } from '../core/client.js';
import { logger } from '../core/logger.js';

const SOURCE_URL = 'https://fsaseychelles.sc/vasp/licensed-vasps';

export class ScFsaParser implements RegistryParser {
  config: ParserConfig = {
    id: 'sc-fsa',
    name: 'Seychelles FSA Virtual Asset Service Providers',
    countryCode: 'SC',
    country: 'Seychelles',
    regulator: 'FSA (Financial Services Authority)',
    url: SOURCE_URL,
    sourceType: 'html',
    rateLimit: 8_000,
    needsProxy: false,
    needsBrowser: false,
  };

  async parse(): Promise<ParseResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const errors: string[] = [];

    logger.info(this.config.id, `Fetching FSA Seychelles VASP register from ${SOURCE_URL}`);

    let html: string;
    try {
      html = await fetchWithRetry(SOURCE_URL, {
        registryId: this.config.id,
        rateLimit: this.config.rateLimit,
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });
    } catch (err) {
      throw new Error(
        `Failed to fetch FSA Seychelles register: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    const allEntities = this.parsePage(html, warnings);

    // Deduplicate by company name (same company can be in Licensed + Assessment)
    const deduped = this.deduplicateEntities(allEntities);
    if (allEntities.length !== deduped.length) {
      warnings.push(`Deduplicated: ${allEntities.length} → ${deduped.length} entities`);
    }

    logger.info(this.config.id, `Parsed ${deduped.length} unique entities`);

    if (deduped.length === 0) {
      warnings.push('No entities found — page structure may have changed');
    }

    return {
      registryId: this.config.id,
      countryCode: 'SC',
      entities: deduped,
      totalFound: deduped.length,
      durationMs: Date.now() - startTime,
      warnings,
      errors,
      timestamp: new Date().toISOString(),
    };
  }

  private parsePage(html: string, warnings: string[]): ParsedEntity[] {
    const $ = cheerio.load(html);
    const entities: ParsedEntity[] = [];

    // Strategy 1: Parse accordion cards (Bootstrap .card or .accordion-item)
    const cards = $(
      '.card, .accordion-item, .sppb-addon-accordion-item, [class*="accordion"], .panel'
    );
    logger.info(this.config.id, `Found ${cards.length} accordion cards`);

    cards.each((_, card) => {
      const entity = this.parseAccordionCard($, $(card), warnings);
      if (entity) {
        entities.push(entity);
      }
    });

    // Strategy 2: Parse custom <spanl> tags directly
    if (entities.length === 0) {
      logger.info(this.config.id, 'No accordion cards, trying <spanl> tag extraction...');

      const spanlElements = $('spanl');
      logger.info(this.config.id, `Found ${spanlElements.length} <spanl> elements`);

      let currentEntity: Partial<ParsedEntity> = {};

      spanlElements.each((_, el) => {
        const text = $(el).text().trim();
        const label = text.split(':')[0]?.trim().toLowerCase();
        const value = text.substring(text.indexOf(':') + 1).trim();

        if (label.includes('name') || label.includes('company')) {
          // Save previous entity if exists
          if (currentEntity.name) {
            entities.push(this.createEntity(currentEntity));
          }
          currentEntity = { name: value };
        } else if (label.includes('address')) {
          currentEntity.website = undefined; // Address, not website
        } else if (label.includes('date') || label.includes('approval')) {
          // Store date info
        } else if (label.includes('status')) {
          currentEntity.status = value;
        }
      });

      // Don't forget the last entity
      if (currentEntity.name) {
        entities.push(this.createEntity(currentEntity));
      }
    }

    // Strategy 3: Parse structured content blocks
    if (entities.length === 0) {
      logger.info(this.config.id, 'No <spanl> entities, trying generic extraction...');

      // Look for heading + content pairs
      const headings = $('h3, h4, h5, .sppb-addon-title, .card-title, .panel-title');

      headings.each((_, heading) => {
        const text = $(heading).text().trim();
        // Check if this heading is a section title (Licensed/Assessment) — skip
        if (
          text.toLowerCase().includes('licensed') ||
          text.toLowerCase().includes('assessment') ||
          text.toLowerCase().includes('vasp')
        ) {
          return;
        }

        // Otherwise it might be a company name
        if (text.length > 3 && text.length < 200) {
          entities.push(
            this.createEntity({
              name: text,
              status: this.detectSectionStatus($, $(heading)),
            })
          );
        }
      });
    }

    // Strategy 4: Parse tables if present
    if (entities.length === 0) {
      $('table').each((_, table) => {
        $(table)
          .find('tr')
          .each((_, row) => {
            const cells = $(row).find('td');
            if (cells.length < 1) return;

            const name = $(cells[0]).text().trim();
            if (name && name.length > 3 && !name.toLowerCase().includes('name')) {
              const status = cells.length > 1 ? $(cells[1]).text().trim() : 'Licensed';
              entities.push(this.createEntity({ name, status }));
            }
          });
      });
    }

    // Log section breakdown
    const licensed = entities.filter((e) => e.status === 'Licensed').length;
    const assessment = entities.filter((e) => e.status === 'Assessment').length;
    const other = entities.length - licensed - assessment;
    logger.info(this.config.id, `  Licensed: ${licensed}, Assessment: ${assessment}, Other: ${other}`);

    return entities;
  }

  /** Parse a single Bootstrap accordion card */
  private parseAccordionCard(
    $: cheerio.CheerioAPI,
    card: cheerio.Cheerio<cheerio.Element>,
    _warnings: string[]
  ): ParsedEntity | null {
    // Card header = company name
    const header = card
      .find(
        '.card-header, .accordion-header, .accordion-button, .panel-heading, ' +
        '.sppb-accordion-title, h4, h5, button[data-bs-toggle]'
      )
      .first();

    let name = header.text().trim();
    if (!name) {
      // Try first strong/bold element
      name = card.find('strong, b').first().text().trim();
    }
    if (!name || name.length < 3) return null;

    // Card body = details (address, date, status)
    const body = card.find(
      '.card-body, .accordion-body, .panel-body, .collapse, .sppb-accordion-content'
    );
    const bodyText = body.text();

    // Extract status from body
    let status = 'Licensed';
    if (bodyText.toLowerCase().includes('assessment')) {
      status = 'Assessment';
    } else if (bodyText.toLowerCase().includes('licensed') || bodyText.toLowerCase().includes('approved')) {
      status = 'Licensed';
    }

    // Also check section context
    const sectionStatus = this.detectSectionStatus($, card);
    if (sectionStatus) {
      status = sectionStatus;
    }

    // Extract date of approval if present
    const dateMatch = bodyText.match(
      /(?:date\s*(?:of)?\s*(?:approval|registration|license))\s*:?\s*(\d{1,2}[\s/.-]\w+[\s/.-]\d{2,4})/i
    );

    // Extract address
    const addressMatch = bodyText.match(
      /(?:address|registered\s*office)\s*:?\s*(.+?)(?=(?:date|status|$))/is
    );

    return {
      name: this.cleanName(name),
      licenseNumber: `SC-FSA-VASP-${name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 20)}`,
      countryCode: 'SC',
      country: 'Seychelles',
      licenseType: status === 'Assessment' ? 'VASP (Assessment Stage)' : 'VASP License',
      status,
      regulator: 'FSA Seychelles',
      activities: ['Virtual Asset Service Provider'],
      sourceUrl: SOURCE_URL,
    };
  }

  /** Detect if an element is inside a "Licensed" or "Assessment" section */
  private detectSectionStatus(
    $: cheerio.CheerioAPI,
    element: cheerio.Cheerio<cheerio.Element>
  ): string {
    // Walk up the DOM looking for section headings
    const parents = element.parents();
    let sectionText = '';

    parents.each((_, parent) => {
      const heading = $(parent).find('h2, h3, .section-title').first().text().toLowerCase();
      if (heading) sectionText = heading;
    });

    // Also check preceding siblings
    const prevHeading = element
      .prevAll('h2, h3, h4, .section-title, [class*="heading"]')
      .first()
      .text()
      .toLowerCase();
    if (prevHeading) sectionText = prevHeading;

    if (sectionText.includes('assessment')) return 'Assessment';
    if (sectionText.includes('licensed')) return 'Licensed';
    return 'Licensed';
  }

  private createEntity(data: Partial<ParsedEntity>): ParsedEntity {
    const name = data.name || 'Unknown';
    const status = data.status || 'Licensed';

    return {
      name,
      licenseNumber: `SC-FSA-VASP-${name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 20)}`,
      countryCode: 'SC',
      country: 'Seychelles',
      licenseType: status === 'Assessment' ? 'VASP (Assessment Stage)' : 'VASP License',
      status,
      regulator: 'FSA Seychelles',
      activities: ['Virtual Asset Service Provider'],
      sourceUrl: SOURCE_URL,
    };
  }

  /** Deduplicate entities by company name */
  private deduplicateEntities(entities: ParsedEntity[]): ParsedEntity[] {
    const seen = new Map<string, ParsedEntity>();
    for (const entity of entities) {
      const key = entity.name.toLowerCase().replace(/\s+/g, ' ').trim();
      if (!seen.has(key)) {
        seen.set(key, entity);
      } else {
        // If one is Licensed and one is Assessment, prefer Licensed
        const existing = seen.get(key)!;
        if (existing.status === 'Assessment' && entity.status === 'Licensed') {
          seen.set(key, entity);
        }
      }
    }
    return Array.from(seen.values());
  }

  private cleanName(name: string): string {
    return name
      .replace(/\s+/g, ' ')
      .replace(/^\d+[.)]\s*/, '')
      .trim();
  }
}
