/**
 * Turkey SPK — Crypto Asset Service Providers (Kripto Varlik Hizmet Saglayicilari)
 *
 * Source: Capital Markets Board of Turkey (Sermaye Piyasasi Kurulu — SPK)
 * URL: https://spk.gov.tr/kurumlar/kripto-varlik-hizmet-saglayicilar/faaliyette-bulunanlar-listesi
 * ~60 entities across three lists (active + liquidation declared + liquidation in progress)
 * Format: HTML tables on government website (server-side rendered, Turkish language)
 *
 * SPK regulates crypto asset service providers (CASPs) under Turkey's Capital Markets Law.
 * Three lists are published:
 *   1. Faaliyette Bulunanlar — Active operators (licensed and operating)
 *   2. Tasfiyesi Ilan Edilenler — Liquidation declared (license revoked, winding down)
 *   3. Tasfiye Halindekiler — Liquidation in progress (currently being liquidated)
 *
 * Parsing strategy: Fetch each of the three list pages, extract company names from
 * HTML tables. The site uses standard <table> elements. Multiple fallback selectors
 * are tried since the exact class names may vary. Turkish characters (I/i dotted/dotless)
 * are handled for deduplication.
 *
 * Usage:
 *   npx tsx parsers/registries/tr-spk.ts --dry-run
 *   npx tsx parsers/registries/tr-spk.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as cheerio from 'cheerio';
import type { RegistryParser, ParserConfig, ParseResult, ParsedEntity } from '../core/types.js';
import { fetchWithRetry } from '../core/client.js';
import { logger } from '../core/logger.js';

/** The three SPK CASP list pages */
const URLS = {
  active: 'https://spk.gov.tr/kurumlar/kripto-varlik-hizmet-saglayicilar/faaliyette-bulunanlar-listesi',
  liquidationDeclared: 'https://spk.gov.tr/kurumlar/kripto-varlik-hizmet-saglayicilar/tasfiyesi-ilan-edilenler-listesi',
  liquidationInProgress: 'https://spk.gov.tr/kurumlar/kripto-varlik-hizmet-saglayicilar/tasfiye-halindekiler-listesi',
} as const;

type ListType = keyof typeof URLS;

/** Status and license type mapping per list */
const LIST_META: Record<ListType, { status: string; licenseType: string }> = {
  active: { status: 'Licensed', licenseType: 'CASP Active' },
  liquidationDeclared: { status: 'In Liquidation', licenseType: 'CASP Liquidation Declared' },
  liquidationInProgress: { status: 'In Liquidation', licenseType: 'CASP Liquidation In Progress' },
};

/** Sanitize a company name into a license-number-safe slug */
function sanitizeName(name: string): string {
  return name
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9\u00C0-\u024F-]/g, '') // keep accented latin chars
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

/**
 * Normalize a Turkish string for case-insensitive deduplication.
 * Turkish has dotted I (I/i) vs dotless I (I/i) — standard toLowerCase() fails.
 */
function turkishNormalize(s: string): string {
  return s
    .replace(/I/g, 'i')    // Turkish capital dotless I -> lowercase dotless i
    .replace(/\u0130/g, 'i') // Turkish capital dotted I -> lowercase i
    .toLowerCase()
    .trim();
}

/**
 * Parse entities from an SPK list page HTML.
 *
 * Strategy (multiple fallbacks):
 *   1. Look for <table> elements and extract rows
 *   2. If no tables, look for ordered/unordered lists
 *   3. If no lists, look for structured divs with company-like text
 *   4. Last resort: regex scan for company suffixes (A.S., Ltd., etc.)
 */
function parseListPage(
  html: string,
  listType: ListType,
  registryId: string,
): ParsedEntity[] {
  const $ = cheerio.load(html);
  const entities: ParsedEntity[] = [];
  const meta = LIST_META[listType];
  const sourceUrl = URLS[listType];

  // ----- Strategy 1: HTML tables -----
  const tables = $('table');
  if (tables.length > 0) {
    logger.info(registryId, `[${listType}] Found ${tables.length} table(s), parsing rows...`);

    tables.each((_, table) => {
      const rows = $(table).find('tr');
      rows.each((_rowIdx, row) => {
        const cells = $(row).find('td, th');
        if (cells.length === 0) return;

        // Skip header rows — detect by checking if first cell is a number or header keyword
        const firstCellText = $(cells[0]).text().trim();
        if (/^(sira|no|#|s\.?n|numara)/i.test(firstCellText)) return;
        if (firstCellText.toLowerCase() === 'platform adi' || firstCellText.toLowerCase() === 'unvan') return;

        // Try to find the company name — usually in the 1st or 2nd column
        let companyName = '';
        let website = '';
        let licenseNumber = '';

        cells.each((cellIdx, cell) => {
          const text = $(cell).text().trim();
          if (!text) return;

          // Check for a link (could be website)
          const link = $(cell).find('a').attr('href');
          if (link && /^https?:\/\//.test(link)) {
            website = link;
          }

          // Heuristic: company name cell is the one with the longest text
          // that looks like a name (not a date, not a pure number)
          if (cellIdx === 0 && /^\d+$/.test(text)) {
            // First column is a row number, skip it
            return;
          }

          if (!companyName && text.length > 2 && !/^\d{2}[./-]\d{2}[./-]\d{4}$/.test(text)) {
            // Not a date, not a number — likely a company name
            companyName = text;
          }

          // Some tables have a license/registration number column
          if (!licenseNumber && /^\d{4,}$/.test(text) && cellIdx > 0) {
            licenseNumber = text;
          }
        });

        if (companyName) {
          // Clean up the name: remove leading numbers, bullets, whitespace artifacts
          companyName = companyName
            .replace(/^\d+[.):\-\s]+/, '')
            .replace(/\s+/g, ' ')
            .trim();

          if (companyName.length < 2) return;

          entities.push({
            name: companyName,
            licenseNumber: licenseNumber || `TR-SPK-${sanitizeName(companyName)}`,
            countryCode: 'TR',
            country: 'Turkey',
            licenseType: meta.licenseType,
            activities: ['Crypto Asset Exchange'],
            status: meta.status,
            regulator: 'SPK (Capital Markets Board)',
            website: website || undefined,
            sourceUrl,
          });
        }
      });
    });
  }

  // ----- Strategy 2: Ordered / Unordered lists -----
  if (entities.length === 0) {
    logger.info(registryId, `[${listType}] No table entities found, trying list elements...`);

    const listItems = $('ol li, ul li, .content li, .detail-content li, article li');
    listItems.each((_, li) => {
      const text = $(li).text().trim();
      if (!text || text.length < 3) return;

      // Skip items that are just dates or numbers
      if (/^\d{2}[./-]\d{2}[./-]\d{4}$/.test(text)) return;
      if (/^\d+$/.test(text)) return;

      const name = text
        .replace(/^\d+[.):\-\s]+/, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (name.length < 2) return;

      const link = $(li).find('a').attr('href');
      const website = link && /^https?:\/\//.test(link) ? link : undefined;

      entities.push({
        name,
        licenseNumber: `TR-SPK-${sanitizeName(name)}`,
        countryCode: 'TR',
        country: 'Turkey',
        licenseType: meta.licenseType,
        activities: ['Crypto Asset Exchange'],
        status: meta.status,
        regulator: 'SPK (Capital Markets Board)',
        website,
        sourceUrl,
      });
    });
  }

  // ----- Strategy 3: Content divs / paragraphs -----
  if (entities.length === 0) {
    logger.info(registryId, `[${listType}] No list entities found, trying content blocks...`);

    // Look for main content container
    const contentSelectors = [
      '.content-detail',
      '.detail-content',
      '.page-content',
      '.content',
      'article',
      'main',
      '.main-content',
      '#content',
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let contentArea: cheerio.Cheerio<any> | null = null;
    for (const sel of contentSelectors) {
      const found = $(sel).first();
      if (found.length > 0 && found.text().trim().length > 50) {
        contentArea = found;
        break;
      }
    }

    if (contentArea) {
      // Get all text nodes inside paragraphs or divs
      const blocks = contentArea.find('p, div, span').toArray();
      for (const block of blocks) {
        const text = $(block).text().trim();
        if (!text || text.length < 5) continue;

        // Check for company name patterns: ends with A.S., Ltd., etc.
        // or contains "Kripto" / "Platform" / "Borsa"
        if (
          /\b(A\.?\s*S\.?|Ltd\.?|Anonim\s+Sirketi|Kripto|Platform|Borsa)\b/i.test(text) &&
          text.length < 200
        ) {
          const name = text
            .replace(/^\d+[.):\-\s]+/, '')
            .replace(/\s+/g, ' ')
            .trim();

          if (name.length >= 3) {
            entities.push({
              name,
              licenseNumber: `TR-SPK-${sanitizeName(name)}`,
              countryCode: 'TR',
              country: 'Turkey',
              licenseType: meta.licenseType,
              activities: ['Crypto Asset Exchange'],
              status: meta.status,
              regulator: 'SPK (Capital Markets Board)',
              sourceUrl,
            });
          }
        }
      }
    }
  }

  // ----- Strategy 4: Full-text regex for Turkish company suffixes -----
  if (entities.length === 0) {
    logger.info(registryId, `[${listType}] No structured entities found, trying regex extraction...`);

    const fullText = $('body').text();
    // Match lines that look like company names (Turkish company suffixes)
    const companyPattern = /([A-ZÇĞIİÖŞÜa-zçğıiöşü0-9][\w\s.,'&\-çğıiöşüÇĞİÖŞÜ]{3,80})\s*(Anonim\s+(?:Şirketi|Sirketi)|A\.?\s*Ş\.?|A\.?\s*S\.?)/gi;

    let match: RegExpExecArray | null;
    while ((match = companyPattern.exec(fullText)) !== null) {
      const name = (match[1] + ' ' + match[2]).replace(/\s+/g, ' ').trim();
      if (name.length >= 5) {
        entities.push({
          name,
          licenseNumber: `TR-SPK-${sanitizeName(name)}`,
          countryCode: 'TR',
          country: 'Turkey',
          licenseType: meta.licenseType,
          activities: ['Crypto Asset Exchange'],
          status: meta.status,
          regulator: 'SPK (Capital Markets Board)',
          sourceUrl,
        });
      }
    }
  }

  logger.info(registryId, `[${listType}] Extracted ${entities.length} entities`);
  return entities;
}

export class TrSpkParser implements RegistryParser {
  config: ParserConfig = {
    id: 'tr-spk',
    name: 'Turkey SPK Crypto Asset Service Providers',
    countryCode: 'TR',
    country: 'Turkey',
    regulator: 'SPK (Capital Markets Board)',
    url: 'https://spk.gov.tr/kurumlar/kripto-varlik-hizmet-saglayicilar/faaliyette-bulunanlar-listesi',
    sourceType: 'html',
    rateLimit: 8_000,
    needsProxy: false,
    needsBrowser: false,
  };

  async parse(): Promise<ParseResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const errors: string[] = [];
    const allEntities: ParsedEntity[] = [];

    // Fetch and parse all three lists
    for (const [listType, url] of Object.entries(URLS) as [ListType, string][]) {
      try {
        logger.info(this.config.id, `Fetching ${listType} list: ${url}`);
        const html = await fetchWithRetry(url, {
          registryId: this.config.id,
          rateLimit: this.config.rateLimit,
          headers: {
            'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
          },
        });

        logger.info(this.config.id, `Fetched ${listType} page (${html.length} bytes)`);

        const entities = parseListPage(html, listType, this.config.id);
        allEntities.push(...entities);
      } catch (err) {
        const msg = `Failed to fetch ${listType} list: ${err instanceof Error ? err.message : String(err)}`;
        logger.error(this.config.id, msg);

        if (listType === 'active') {
          // Active list is mandatory
          errors.push(msg);
        } else {
          // Liquidation lists are optional — warn but don't fail
          warnings.push(msg);
        }
      }
    }

    // Deduplicate by normalized name (Turkish-aware)
    const seen = new Map<string, ParsedEntity>();
    for (const entity of allEntities) {
      const key = turkishNormalize(entity.name);
      if (!seen.has(key)) {
        seen.set(key, entity);
      } else {
        // If duplicate, keep the one with a more severe status (liquidation > active)
        const existing = seen.get(key)!;
        if (existing.status === 'Licensed' && entity.status === 'In Liquidation') {
          // Entity was active but now in liquidation — keep the liquidation record
          seen.set(key, entity);
          warnings.push(`Duplicate entity "${entity.name}" found in multiple lists — keeping liquidation status`);
        }
      }
    }

    const dedupEntities = Array.from(seen.values());

    if (dedupEntities.length < allEntities.length) {
      logger.info(
        this.config.id,
        `Dedup: ${allEntities.length} raw -> ${dedupEntities.length} unique entities`,
      );
    }

    // Log summary by status
    const statusCounts: Record<string, number> = {};
    for (const e of dedupEntities) {
      statusCounts[e.status ?? 'Unknown'] = (statusCounts[e.status ?? 'Unknown'] ?? 0) + 1;
    }
    const statusSummary = Object.entries(statusCounts)
      .map(([s, n]) => `${s}: ${n}`)
      .join(', ');
    logger.info(this.config.id, `Status breakdown: ${statusSummary}`);

    return {
      registryId: this.config.id,
      countryCode: 'TR',
      entities: dedupEntities,
      totalFound: dedupEntities.length,
      durationMs: Date.now() - startTime,
      warnings,
      errors,
      timestamp: new Date().toISOString(),
    };
  }
}

/** CLI entry */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--dry-run')) process.env.DRY_RUN = 'true';

  const parser = new TrSpkParser();
  const result = await parser.parse();

  console.log(`\n✅ ${result.entities.length} entities parsed in ${(result.durationMs / 1000).toFixed(1)}s`);
  for (const e of result.entities.slice(0, 10)) {
    console.log(`  ${e.name} | ${e.licenseType} | ${e.status}`);
  }
  if (result.entities.length > 10) {
    console.log(`  ... and ${result.entities.length - 10} more`);
  }

  if (result.warnings.length > 0) {
    console.log(`\n⚠️  Warnings: ${result.warnings.length}`);
    for (const w of result.warnings) {
      console.log(`  - ${w}`);
    }
  }
  if (result.errors.length > 0) {
    console.log(`\n❌ Errors: ${result.errors.length}`);
    for (const e of result.errors) {
      console.log(`  - ${e}`);
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
