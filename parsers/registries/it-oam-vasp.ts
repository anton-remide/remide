/**
 * Italy OAM — Virtual Currency Service Providers (VASP)
 *
 * Source: OAM public register pages (HTML).
 * This parser is intentionally resilient to markup changes:
 * - table rows
 * - generic list cards
 * - JSON-LD ItemList payloads
 */

import * as cheerio from 'cheerio';
import type { ParsedEntity, ParseResult, ParserConfig, RegistryParser } from '../core/types.js';
import { fetchWithRetry } from '../core/client.js';
import { logger } from '../core/logger.js';

const OAM_URLS = [
  'https://www.organismo-am.it/elenchi-registri/elenco-operatori-valute-virtuali',
  'https://www.organismo-am.it/elenchi-registri/elenco-operatori-criptovalute',
  // Fallback URLs in case the primary ones have moved
  'https://www.organismo-am.it/registri-elenchi/operatori-valute-virtuali',
  'https://www.organismo-am.it/elenco-operatori-valute-virtuali',
];

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim();
}

function makeFallbackLicense(name: string): string {
  const compact = name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 36);
  return `OAM-VV-${compact || 'UNKNOWN'}`;
}

function parseStatus(text: string): string {
  const t = text.toLowerCase();
  if (t.includes('revocat') || t.includes('cancellat')) return 'Revoked';
  if (t.includes('sospes')) return 'Suspended';
  if (t.includes('cessat')) return 'Ceased';
  return 'Registered';
}

function extractLicense(text: string): string | undefined {
  const patterns = [
    /(?:n(?:umero)?\.?|no\.?|iscrizione|id)\s*[:#]?\s*([a-z0-9\-\/]{3,})/i,
    /\b([A-Z]{1,4}-\d{2,}[A-Z0-9\-]*)\b/,
    /\b(\d{3,}[A-Z0-9\-\/]{0,})\b/,
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return undefined;
}

function isValidHtml(html: string): boolean {
  if (!html || html.trim().length < 100) return false;
  
  const $ = cheerio.load(html);
  const hasContent = $('body').text().trim().length > 50;
  const hasStructure = $('table, .views-row, .result-item, .card, .list-item, li, script[type="application/ld+json"]').length > 0;
  
  return hasContent || hasStructure;
}

/**
 * Exported for unit tests to validate extraction logic deterministically.
 */
export function parseOamHtml(html: string, sourceUrl: string): ParsedEntity[] {
  const $ = cheerio.load(html);
  const out: ParsedEntity[] = [];
  const seen = new Set<string>();

  const pushEntity = (candidate: {
    name?: string;
    license?: string;
    statusText?: string;
    sourceUrl?: string;
    detailUrl?: string;
  }) => {
    const rawName = (candidate.name ?? '').trim();
    if (!rawName || rawName.length < 3) return;
    if (rawName.toLowerCase().includes('ragione sociale') || rawName.toLowerCase().includes('denominazione')) return;

    const key = normalizeName(rawName);
    if (!key || seen.has(key)) return;
    seen.add(key);

    const licenseNumber = candidate.license?.trim() || makeFallbackLicense(rawName);
    const status = parseStatus(candidate.statusText ?? '');
    const finalSourceUrl = candidate.detailUrl || candidate.sourceUrl || sourceUrl;

    out.push({
      name: rawName,
      licenseNumber,
      countryCode: 'IT',
      country: 'Italy',
      status,
      regulator: 'OAM',
      licenseType: 'Virtual Currency Service Provider Registration',
      activities: ['Virtual Asset Services'],
      sourceUrl: finalSourceUrl,
    });
  };

  // Strategy 1: HTML tables
  $('table tbody tr, table tr').each((_, tr) => {
    const cells = $(tr).find('td');
    if (cells.length === 0) return;

    const rowText = $(tr).text().replace(/\s+/g, ' ').trim();
    const first = $(cells[0]).text().replace(/\s+/g, ' ').trim();
    const second = cells.length > 1 ? $(cells[1]).text().replace(/\s+/g, ' ').trim() : '';
    const statusText = cells.length > 2 ? $(cells[2]).text().replace(/\s+/g, ' ').trim() : rowText;
    const href = $(tr).find('a[href]').first().attr('href') ?? '';
    const detailUrl = href.startsWith('http')
      ? href
      : href.startsWith('/')
        ? `https://www.organismo-am.it${href}`
        : '';

    const maybeName = first.length >= 4 ? first : second;
    const license = extractLicense(rowText);
    pushEntity({ name: maybeName, license, statusText, sourceUrl, detailUrl });
  });

  // Strategy 2: list/card blocks
  $('.views-row, .result-item, .card, .list-item, li').each((_, node) => {
    const text = $(node).text().replace(/\s+/g, ' ').trim();
    if (!text || text.length < 8) return;
    if (
      text.toLowerCase().includes('cookie') ||
      text.toLowerCase().includes('privacy') ||
      text.toLowerCase().includes('newsletter')
    ) return;

    const a = $(node).find('a[href]').first();
    const anchorText = a.text().replace(/\s+/g, ' ').trim();
    const name = anchorText.length >= 4 ? anchorText : text.split(/\s+-\s+|\s+\|\s+/)[0]?.trim();
    const href = a.attr('href') ?? '';
    const detailUrl = href.startsWith('http')
      ? href
      : href.startsWith('/')
        ? `https://www.organismo-am.it${href}`
        : '';
    pushEntity({
      name,
      license: extractLicense(text),
      statusText: text,
      sourceUrl,
      detailUrl,
    });
  });

  // Strategy 3: JSON-LD ItemList / Organization
  $('script[type="application/ld+json"]').each((_, script) => {
    const raw = $(script).html() ?? '';
    if (!raw.trim()) return;

    try {
      const payload = JSON.parse(raw);
      const nodes = Array.isArray(payload) ? payload : [payload];

      for (const node of nodes) {
        const list = node?.itemListElement;
        if (!Array.isArray(list)) continue;
        for (const item of list) {
          const inner = item?.item ?? item;
          const name = inner?.name ?? item?.name;
          const detailUrl = inner?.url ?? item?.url ?? '';
          const descriptor = JSON.stringify(item);
          pushEntity({
            name,
            license: extractLicense(descriptor),
            statusText: descriptor,
            sourceUrl,
            detailUrl,
          });
        }
      }
    } catch {
      // Best-effort parsing only.
    }
  });

  return out;
}

export class ItOamVaspParser implements RegistryParser {
  config: ParserConfig = {
    id: 'it-oam-vasp',
    name: 'Italy OAM Virtual Currency Service Providers',
    countryCode: 'IT',
    country: 'Italy',
    regulator: 'OAM (Organismo Agenti e Mediatori)',
    url: OAM_URLS[0],
    sourceType: 'html',
    rateLimit: 7_000,
    needsProxy: false,
    needsBrowser: true,
  };

  async parse(): Promise<ParseResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const errors: string[] = [];
    const entities: ParsedEntity[] = [];

    let successfulFetch = false;

    for (const url of OAM_URLS) {
      try {
        logger.info(this.config.id, `Fetching: ${url}`);
        const html = await fetchWithRetry(url, {
          registryId: this.config.id,
          rateLimit: this.config.rateLimit,
        });

        logger.info(this.config.id, `Received ${html.length} characters from ${url}`);

        if (!isValidHtml(html)) {
          warnings.push(`Empty or invalid HTML from ${url} (${html.length} chars)`);
          continue;
        }

        successfulFetch = true;
        const parsed = parseOamHtml(html, url);
        logger.info(this.config.id, `Parsed ${parsed.length} entities from ${url}`);
        entities.push(...parsed);

        // If we got good results from this URL, we can skip the others
        if (parsed.length > 0) {
          logger.info(this.config.id, `Found entities on ${url}, skipping remaining URLs`);
          break;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Failed to fetch ${url}: ${msg}`);
        logger.error(this.config.id, `Error fetching ${url}: ${msg}`);
      }
    }

    // Final dedup across all fetched pages
    const byName = new Map<string, ParsedEntity>();
    for (const e of entities) {
      const key = normalizeName(e.name);
      if (!byName.has(key)) byName.set(key, e);
    }
    const unique = Array.from(byName.values());

    if (!successfulFetch) {
      errors.push('All OAM URLs failed to return valid HTML. Site may require JavaScript rendering or have changed structure.');
    } else if (unique.length === 0) {
      warnings.push('No OAM entities found in valid HTML responses. Site structure may have changed.');
    }

    return {
      registryId: this.config.id,
      countryCode: this.config.countryCode,
      entities: unique,
      totalFound: unique.length,
      durationMs: Date.now() - startTime,
      warnings,
      errors,
      timestamp: new Date().toISOString(),
    };
  }
}