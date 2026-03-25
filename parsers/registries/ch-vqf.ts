/**
 * Switzerland VQF — SRO members (incl. virtual asset providers)
 */

import * as cheerio from 'cheerio';
import type { ParsedEntity, ParseResult, ParserConfig, RegistryParser } from '../core/types.js';
import { fetchWithRetry } from '../core/client.js';
import { logger } from '../core/logger.js';

const VQF_URLS = [
  'https://www.vqf.ch/en/sro-members/',
  'https://www.vqf.ch/en/members/',
  'https://www.vqf.ch/mitglieder/',
  'https://www.vqf.ch/de/sro-mitglieder/',
];

function normalize(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').replace(/[^\w\s]/g, '').trim();
}

function fallbackLicense(name: string): string {
  return `VQF-${name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 36) || 'UNKNOWN'}`;
}

function parseStatus(text: string): string {
  const t = text.toLowerCase();
  if (t.includes('suspend') || t.includes('sospes')) return 'Suspended';
  if (t.includes('revok') || t.includes('withdrawn') || t.includes('cancel')) return 'Revoked';
  if (t.includes('inactive') || t.includes('inaktiv')) return 'Inactive';
  return 'Active';
}

function extractId(text: string): string | undefined {
  const m = text.match(/(?:id|nr|no|member|mitglied)\s*[:#]?\s*([A-Z0-9\-\/]{3,})/i);
  return m?.[1]?.trim();
}

export function parseVqfHtml(html: string, sourceUrl: string): ParsedEntity[] {
  const $ = cheerio.load(html);
  const entities: ParsedEntity[] = [];
  const seen = new Set<string>();

  const push = (name: string, text: string, detailUrl?: string) => {
    const cleanName = name.replace(/\s+/g, ' ').trim();
    if (!cleanName || cleanName.length < 3) return;
    if (cleanName.toLowerCase().includes('member') && cleanName.toLowerCase().includes('list')) return;
    if (cleanName.toLowerCase().includes('mitglieder') && cleanName.toLowerCase().includes('liste')) return;

    const key = normalize(cleanName);
    if (!key || seen.has(key)) return;
    seen.add(key);

    entities.push({
      name: cleanName,
      licenseNumber: extractId(text) || fallbackLicense(cleanName),
      countryCode: 'CH',
      country: 'Switzerland',
      status: parseStatus(text),
      regulator: 'VQF',
      licenseType: 'SRO Membership',
      activities: ['VASP/Financial Intermediation'],
      sourceUrl: detailUrl || sourceUrl,
    });
  };

  // Try multiple table selectors
  $('table tbody tr, table tr, .table tbody tr, .table tr').each((_, tr) => {
    const cells = $(tr).find('td, th');
    if (!cells.length) return;
    const first = $(cells[0]).text().replace(/\s+/g, ' ').trim();
    if (!first || first.toLowerCase().includes('name') || first.toLowerCase().includes('firma')) return;
    
    const rowParts: string[] = [];
    cells.each((__, td) => {
      const part = $(td).text().replace(/\s+/g, ' ').trim();
      if (part) rowParts.push(part);
    });
    const rowText = rowParts.join(' | ');
    const href = $(tr).find('a[href]').first().attr('href') ?? '';
    const detailUrl = href.startsWith('http')
      ? href
      : href.startsWith('/')
        ? `https://www.vqf.ch${href}`
        : undefined;
    push(first, rowText, detailUrl);
  });

  // Try card/list layouts
  $('.member-item, .member, .result-item, .card, .list-item').each((_, el) => {
    const txt = $(el).text().replace(/\s+/g, ' ').trim();
    if (!txt || txt.length < 8) return;
    if (txt.toLowerCase().includes('cookie') || txt.toLowerCase().includes('privacy')) return;
    if (txt.toLowerCase().includes('datenschutz')) return;
    
    const anchor = $(el).find('a[href]').first();
    const name = anchor.text().replace(/\s+/g, ' ').trim() || 
                 $(el).find('h1, h2, h3, h4, .title, .name').first().text().replace(/\s+/g, ' ').trim() ||
                 txt.split(/\s+-\s+|\s+\|\s+/)[0]?.trim() || '';
    
    const href = anchor.attr('href') ?? '';
    const detailUrl = href.startsWith('http')
      ? href
      : href.startsWith('/')
        ? `https://www.vqf.ch${href}`
        : undefined;
    push(name, txt, detailUrl);
  });

  // Try simple list items
  $('li').each((_, el) => {
    const txt = $(el).text().replace(/\s+/g, ' ').trim();
    if (!txt || txt.length < 8) return;
    if (txt.toLowerCase().includes('cookie') || txt.toLowerCase().includes('privacy')) return;
    if (txt.toLowerCase().includes('datenschutz') || txt.toLowerCase().includes('impressum')) return;
    if ($(el).find('ul, ol').length > 0) return; // Skip parent list items
    
    const anchor = $(el).find('a[href]').first();
    const name = anchor.text().replace(/\s+/g, ' ').trim() || txt.split(/\s+-\s+|\s+\|\s+/)[0]?.trim() || '';
    
    const href = anchor.attr('href') ?? '';
    const detailUrl = href.startsWith('http')
      ? href
      : href.startsWith('/')
        ? `https://www.vqf.ch${href}`
        : undefined;
    push(name, txt, detailUrl);
  });

  return entities;
}

export class ChVqfParser implements RegistryParser {
  config: ParserConfig = {
    id: 'ch-vqf',
    name: 'Switzerland VQF Members (SRO)',
    countryCode: 'CH',
    country: 'Switzerland',
    regulator: 'VQF',
    url: VQF_URLS[0],
    sourceType: 'html',
    rateLimit: 10_000,
    needsProxy: false,
    needsBrowser: true,
  };

  async parse(): Promise<ParseResult> {
    const start = Date.now();
    const warnings: string[] = [];
    const errors: string[] = [];
    const all: ParsedEntity[] = [];

    for (const url of VQF_URLS) {
      try {
        logger.info(this.config.id, `Fetching: ${url}`);
        const html = await fetchWithRetry(url, {
          registryId: this.config.id,
          rateLimit: this.config.rateLimit,
        });
        
        if (!html || html.trim().length < 100) {
          warnings.push(`Empty or minimal response from ${url}`);
          continue;
        }
        
        const parsed = parseVqfHtml(html, url);
        logger.info(this.config.id, `Parsed ${parsed.length} entities from ${url}`);
        all.push(...parsed);
        
        // If we got results from this URL, we can break early
        if (parsed.length > 0) {
          break;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        warnings.push(`Failed to fetch ${url}: ${msg}`);
      }
    }

    const dedup = new Map<string, ParsedEntity>();
    for (const e of all) {
      const key = normalize(e.name);
      if (!dedup.has(key)) dedup.set(key, e);
    }
    const entities = Array.from(dedup.values());
    
    if (!entities.length) {
      errors.push('No VQF entities found from any URL. Website may have changed structure, implemented bot protection, or URLs may be outdated.');
    }

    return {
      registryId: this.config.id,
      countryCode: this.config.countryCode,
      entities,
      totalFound: entities.length,
      durationMs: Date.now() - start,
      warnings,
      errors,
      timestamp: new Date().toISOString(),
    };
  }
}