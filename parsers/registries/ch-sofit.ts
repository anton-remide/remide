/**
 * Switzerland SO-FIT — SRO members
 */

import * as cheerio from 'cheerio';
import type { ParsedEntity, ParseResult, ParserConfig, RegistryParser } from '../core/types.js';
import { fetchWithRetry } from '../core/client.js';
import { logger } from '../core/logger.js';

const SOFIT_URLS = [
  'https://www.so-fit.ch/en/members',
  'https://www.so-fit.ch/mitglieder',
];

function norm(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').replace(/[^\w\s]/g, '').trim();
}

function fallback(name: string): string {
  return `SOFIT-${name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 36) || 'UNKNOWN'}`;
}

function statusFrom(text: string): string {
  const t = text.toLowerCase();
  if (t.includes('suspend') || t.includes('sospes')) return 'Suspended';
  if (t.includes('revok') || t.includes('withdrawn') || t.includes('cancel')) return 'Revoked';
  return 'Member';
}

function extractMemberId(text: string): string | undefined {
  const m = text.match(/(?:id|nr|no|member|iscrizione)\s*[:#]?\s*([A-Z0-9\-\/]{3,})/i);
  return m?.[1]?.trim();
}

export function parseSofitHtml(html: string, sourceUrl: string): ParsedEntity[] {
  const $ = cheerio.load(html);
  const entities: ParsedEntity[] = [];
  const seen = new Set<string>();

  const push = (name: string, text: string, detailUrl?: string) => {
    const clean = name.replace(/\s+/g, ' ').trim();
    if (!clean || clean.length < 3) return;
    if (clean.toLowerCase().includes('member') && clean.toLowerCase().includes('list')) return;

    const key = norm(clean);
    if (!key || seen.has(key)) return;
    seen.add(key);

    entities.push({
      name: clean,
      licenseNumber: extractMemberId(text) || fallback(clean),
      countryCode: 'CH',
      country: 'Switzerland',
      status: statusFrom(text),
      regulator: 'SO-FIT',
      licenseType: 'SRO Membership',
      activities: ['VASP/Financial Intermediation'],
      sourceUrl: detailUrl || sourceUrl,
    });
  };

  $('table tbody tr, table tr').each((_, tr) => {
    const tds = $(tr).find('td');
    if (!tds.length) return;
    const first = $(tds[0]).text().replace(/\s+/g, ' ').trim();
    const rowText = $(tr).text().replace(/\s+/g, ' ').trim();
    const href = $(tr).find('a[href]').first().attr('href') ?? '';
    const detailUrl = href.startsWith('http')
      ? href
      : href.startsWith('/')
        ? `https://www.so-fit.ch${href}`
        : undefined;
    push(first, rowText, detailUrl);
  });

  $('.member-item, .member, .result-item, li').each((_, el) => {
    const txt = $(el).text().replace(/\s+/g, ' ').trim();
    if (!txt || txt.length < 8) return;
    if (txt.toLowerCase().includes('cookie') || txt.toLowerCase().includes('privacy')) return;
    const anchor = $(el).find('a[href]').first();
    const name = anchor.text().replace(/\s+/g, ' ').trim() || txt.split(/\s+-\s+|\s+\|\s+/)[0]?.trim() || '';
    const href = anchor.attr('href') ?? '';
    const detailUrl = href.startsWith('http')
      ? href
      : href.startsWith('/')
        ? `https://www.so-fit.ch${href}`
        : undefined;
    push(name, txt, detailUrl);
  });

  return entities;
}

export class ChSofitParser implements RegistryParser {
  config: ParserConfig = {
    id: 'ch-sofit',
    name: 'Switzerland SO-FIT Members (SRO)',
    countryCode: 'CH',
    country: 'Switzerland',
    regulator: 'SO-FIT',
    url: SOFIT_URLS[0],
    sourceType: 'html',
    rateLimit: 7_000,
    needsProxy: false,
    needsBrowser: true,
  };

  async parse(): Promise<ParseResult> {
    const start = Date.now();
    const warnings: string[] = [];
    const errors: string[] = [];
    const all: ParsedEntity[] = [];

    for (const url of SOFIT_URLS) {
      try {
        logger.info(this.config.id, `Fetching: ${url}`);
        const html = await fetchWithRetry(url, {
          registryId: this.config.id,
          rateLimit: this.config.rateLimit,
        });
        const parsed = parseSofitHtml(html, url);
        logger.info(this.config.id, `Parsed ${parsed.length} entities`);
        all.push(...parsed);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        warnings.push(`Failed to fetch ${url}: ${msg}`);
      }
    }

    const dedup = new Map<string, ParsedEntity>();
    for (const e of all) {
      const key = norm(e.name);
      if (!dedup.has(key)) dedup.set(key, e);
    }
    const entities = Array.from(dedup.values());
    if (!entities.length) {
      warnings.push('No SO-FIT entities found. Page may require browser rendering or selector update.');
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

