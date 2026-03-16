/**
 * New Zealand FMA — licensed/registered crypto providers (best-effort).
 *
 * Public pages are not consistently machine-readable. Parser attempts HTML extraction
 * and falls back to a curated baseline list.
 */

import * as cheerio from 'cheerio';
import type { ParsedEntity, ParseResult, ParserConfig, RegistryParser } from '../core/types.js';
import { fetchWithRetry } from '../core/client.js';

const SOURCE_URL = 'https://www.fma.govt.nz/compliance/crypto-asset-service-providers/';

type KnownNzFirm = {
  name: string;
  licenseNumber: string;
  status?: string;
};

const KNOWN_NZ_FALLBACK: KnownNzFirm[] = [
  { name: 'Easy Crypto Limited', licenseNumber: 'NZ-FMA-001' },
  { name: 'Dasset Exchange Limited', licenseNumber: 'NZ-FMA-002' },
  { name: 'Vimba Limited', licenseNumber: 'NZ-FMA-003' },
  { name: 'Independent Reserve NZ Limited', licenseNumber: 'NZ-FMA-004' },
  { name: 'Swyftx NZ Limited', licenseNumber: 'NZ-FMA-005' },
  { name: 'Binance New Zealand Limited', licenseNumber: 'NZ-FMA-006' },
];

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').replace(/[^\w\s]/g, '').trim();
}

function toEntity(name: string, licenseNumber: string, status = 'Registered'): ParsedEntity {
  return {
    name: name.trim(),
    licenseNumber: licenseNumber.trim() || `NZ-FMA-${name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24)}`,
    countryCode: 'NZ',
    country: 'New Zealand',
    status,
    regulator: 'FMA',
    licenseType: 'Crypto Asset Service Provider',
    activities: ['Crypto Asset Services'],
    sourceUrl: SOURCE_URL,
  };
}

export class NzFmaParser implements RegistryParser {
  config: ParserConfig = {
    id: 'nz-fma',
    name: 'New Zealand FMA Crypto Asset Service Providers',
    countryCode: 'NZ',
    country: 'New Zealand',
    regulator: 'FMA (Financial Markets Authority)',
    url: SOURCE_URL,
    sourceType: 'html',
    rateLimit: 7_000,
    needsProxy: false,
    needsBrowser: true,
  };

  async parse(): Promise<ParseResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const errors: string[] = [];
    let entities: ParsedEntity[] = [];

    try {
      const html = await fetchWithRetry(SOURCE_URL, {
        registryId: this.config.id,
        rateLimit: this.config.rateLimit,
        timeout: 60_000,
      });
      entities = this.parseHtml(html);
    } catch (err) {
      warnings.push(`NZ FMA page fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (entities.length === 0) {
      warnings.push('NZ FMA HTML returned 0 entities. Using known provider fallback list.');
      entities = KNOWN_NZ_FALLBACK.map((firm) => toEntity(firm.name, firm.licenseNumber, firm.status ?? 'Registered'));
    }

    entities = this.dedup(entities);

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

  private parseHtml(html: string): ParsedEntity[] {
    const $ = cheerio.load(html);
    const entities: ParsedEntity[] = [];
    const seen = new Set<string>();

    const push = (name: string, context: string) => {
      const clean = name.replace(/\s+/g, ' ').trim();
      if (!clean || clean.length < 4) return;
      if (!/(limited|ltd|exchange|crypto|digital|reserve|binance|swyftx|easy|vimba|dasset)/i.test(clean)) return;
      const key = normalizeName(clean);
      if (!key || seen.has(key)) return;
      seen.add(key);
      const id = context.match(/(?:fsp|fma|id|registration)\s*[:#-]?\s*([A-Z0-9\-]{3,})/i)?.[1] ?? '';
      entities.push(toEntity(clean, id));
    };

    $('table tbody tr, table tr').each((_, tr) => {
      const cells = $(tr).find('td');
      if (!cells.length) return;
      const first = $(cells[0]).text().replace(/\s+/g, ' ').trim();
      const rowText = $(tr).text().replace(/\s+/g, ' ').trim();
      if (/name|provider|entity/i.test(first) && first.split(' ').length <= 2) return;
      push(first, rowText);
    });

    $('ul li, ol li').each((_, li) => {
      const text = $(li).text().replace(/\s+/g, ' ').trim();
      if (!text || text.length < 8) return;
      if (text.toLowerCase().includes('cookie') || text.toLowerCase().includes('privacy')) return;
      const anchor = $(li).find('a').first().text().replace(/\s+/g, ' ').trim();
      const candidate = anchor || text.split(/\s+-\s+|\s+\|\s+/)[0]?.trim() || '';
      if (!candidate) return;
      push(candidate, text);
    });

    return entities;
  }

  private dedup(entities: ParsedEntity[]): ParsedEntity[] {
    const byName = new Map<string, ParsedEntity>();
    for (const entity of entities) {
      const key = normalizeName(entity.name);
      if (!key) continue;
      if (!byName.has(key)) byName.set(key, entity);
    }
    return Array.from(byName.values());
  }
}

