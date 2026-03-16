/**
 * Hong Kong SFC — Licensed Corporations (LC) for virtual asset related activities.
 *
 * Source pages can be partially JS-rendered, so parser uses:
 * 1) HTML table/list extraction
 * 2) Curated fallback list for baseline coverage
 */

import * as cheerio from 'cheerio';
import type { ParsedEntity, ParseResult, ParserConfig, RegistryParser } from '../core/types.js';
import { fetchWithRetry } from '../core/client.js';

const SOURCE_URL = 'https://www.sfc.hk/en/Regulatory-functions/Intermediaries/Licensing/Register-of-licensed-persons-and-registered-institutions';

type KnownLcFirm = {
  name: string;
  ceNumber: string;
  status?: string;
};

const KNOWN_HK_LC_FALLBACK: KnownLcFirm[] = [
  { name: 'Hash Blockchain Limited', ceNumber: 'BPL992' },
  { name: 'OSL Digital Securities Limited', ceNumber: 'BPL993' },
  { name: 'Victory Securities Company Limited', ceNumber: 'AAV008' },
  { name: 'Interactive Brokers Hong Kong Limited', ceNumber: 'AAS620' },
  { name: 'Tiger Brokers (HK) Global Limited', ceNumber: 'BMU940' },
  { name: 'ZA Bank Limited', ceNumber: 'BPN694' },
  { name: 'Futu Securities International (Hong Kong) Limited', ceNumber: 'AZT137' },
  { name: 'YAX (Hong Kong) Limited', ceNumber: 'BPL994' },
];

const LEGAL_ENTITY_RE = /\b(limited|ltd|inc|incorporated|corp|corporation|company|bank|securities|brokers|holdings|trust)\b/i;
const NOISE_RE =
  /\b(cooperative arrangements|exchange of information|investigatory|licensing|register|enforcement|regulatory|news|publications|consultation|memorandum|guidelines)\b/i;

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').replace(/[^\w\s]/g, '').trim();
}

function toEntity(name: string, ceNumber: string, status = 'Licensed'): ParsedEntity {
  return {
    name: name.trim(),
    licenseNumber: ceNumber.trim() || `SFC-LC-${name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24)}`,
    countryCode: 'HK',
    country: 'Hong Kong',
    status,
    regulator: 'SFC',
    licenseType: 'Licensed Corporation',
    activities: ['SFC Regulated Activities', 'Virtual Asset Related Services'],
    sourceUrl: SOURCE_URL,
  };
}

export class HkSfcLcParser implements RegistryParser {
  config: ParserConfig = {
    id: 'hk-sfc-lc',
    name: 'Hong Kong SFC Licensed Corporations (VA-related)',
    countryCode: 'HK',
    country: 'Hong Kong',
    regulator: 'SFC (Securities and Futures Commission)',
    url: SOURCE_URL,
    sourceType: 'html',
    rateLimit: 10_000,
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
      warnings.push(`HK SFC LC page fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (entities.length === 0) {
      warnings.push('HK SFC LC HTML returned 0 entities. Using known fallback list.');
      entities = KNOWN_HK_LC_FALLBACK.map((firm) => toEntity(firm.name, firm.ceNumber, firm.status ?? 'Licensed'));
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

    const push = (name: string, context: string, ceHint?: string) => {
      const clean = name.replace(/\s+/g, ' ').trim();
      if (!clean || clean.length < 4) return;
      if (clean.length > 90) return;
      if (NOISE_RE.test(clean)) return;
      if (!LEGAL_ENTITY_RE.test(clean)) return;
      const ceMatch = `${ceHint ?? ''} ${context}`.match(/\b([A-Z]{3}\d{3})\b/);
      if (!ceMatch) return;
      const key = normalizeName(clean);
      if (!key || seen.has(key)) return;
      seen.add(key);
      const ce = ceMatch[1];
      entities.push(toEntity(clean, ce));
    };

    $('table tbody tr, table tr').each((_, tr) => {
      const cells = $(tr).find('td');
      if (!cells.length) return;
      const first = $(cells[0]).text().replace(/\s+/g, ' ').trim();
      const second = cells.length > 1 ? $(cells[1]).text().replace(/\s+/g, ' ').trim() : '';
      const rowText = $(tr).text().replace(/\s+/g, ' ').trim();
      if (/name|corporation|entity/i.test(first) && first.split(' ').length <= 2) return;
      push(first, rowText, second);
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
    const byLicense = new Set<string>();
    for (const entity of entities) {
      const nameKey = normalizeName(entity.name);
      if (!nameKey) continue;
      const licKey = entity.licenseNumber.toLowerCase().trim();
      if (licKey && byLicense.has(licKey)) continue;
      if (!byName.has(nameKey)) {
        byName.set(nameKey, entity);
        if (licKey) byLicense.add(licKey);
      }
    }
    return Array.from(byName.values());
  }
}

