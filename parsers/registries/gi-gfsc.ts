/**
 * Gibraltar FSC — DLT Providers & Virtual Asset Arrangement Providers
 *
 * Source: Gibraltar Financial Services Commission (rebranded from GFSC to FSC)
 * URL: https://www.fsc.gi/regulated-entities/dlt-providers-38
 * ~11 DLT Providers + ~3 Virtual Asset Arrangement Providers
 * Format: Static HTML with <ul> entity lists
 *
 * ⚠️ Site is behind CloudFlare managed challenge.
 * Plain HTTP fetch may get 403. Falls back gracefully with warning.
 * If consistently blocked, needs Firecrawl or Playwright.
 *
 * Domain note: www.gfsc.gi → 301 → www.fsc.gi (rebranded)
 */

import * as cheerio from 'cheerio';
import Firecrawl from '@mendable/firecrawl-js';
import type { RegistryParser, ParserConfig, ParseResult, ParsedEntity } from '../core/types.js';
import { fetchWithRetry } from '../core/client.js';
import { logger } from '../core/logger.js';

const BASE_URL = 'https://www.fsc.gi';

/** All crypto-related register pages on FSC Gibraltar */
const REGISTER_PAGES = [
  {
    url: `${BASE_URL}/regulated-entities/dlt-providers-38`,
    licenseType: 'DLT Provider',
    activity: 'Distributed Ledger Technology Services',
  },
  {
    url: `${BASE_URL}/regulated-entities/virtual-asset-arrangement-providers-48`,
    licenseType: 'Virtual Asset Arrangement Provider',
    activity: 'Virtual Asset Arrangement Services',
  },
];

export class GiGfscParser implements RegistryParser {
  config: ParserConfig = {
    id: 'gi-gfsc',
    name: 'Gibraltar FSC DLT Providers',
    countryCode: 'GI',
    country: 'Gibraltar',
    regulator: 'FSC (Financial Services Commission)',
    url: REGISTER_PAGES[0].url,
    sourceType: 'html',
    rateLimit: 10_000,
    needsProxy: false,
    needsBrowser: true, // CloudFlare may require JS
  };

  async parse(): Promise<ParseResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const errors: string[] = [];
    const allEntities: ParsedEntity[] = [];

    for (const page of REGISTER_PAGES) {
      logger.info(this.config.id, `Fetching ${page.licenseType} list from ${page.url}`);

      try {
        // Strategy A: Try plain HTTP first (cheapest)
        let html = await this.tryPlainFetch(page.url);

        // Strategy B: If CloudFlare blocks, try Firecrawl (renders JS)
        if (!html || this.isCloudFlareChallenge(html)) {
          logger.warn(this.config.id, `CloudFlare blocked plain fetch for ${page.url}, trying Firecrawl...`);
          html = await this.tryFirecrawlFetch(page.url, warnings);
        }

        if (!html) {
          warnings.push(`Could not fetch ${page.licenseType} — both plain HTTP and Firecrawl failed`);
          continue;
        }

        const entities = this.parseListPage(html, page, warnings);
        logger.info(this.config.id, `  ${page.licenseType}: ${entities.length} entities`);
        allEntities.push(...entities);
      } catch (err) {
        const msg = `Failed to fetch ${page.licenseType}: ${err instanceof Error ? err.message : String(err)}`;
        errors.push(msg);
        logger.error(this.config.id, msg);
      }
    }

    if (allEntities.length === 0) {
      warnings.push('No entities found — both plain HTTP and Firecrawl failed. CloudFlare may require manual browser session.');
    }

    logger.info(this.config.id, `Total: ${allEntities.length} entities`);

    return {
      registryId: this.config.id,
      countryCode: 'GI',
      entities: allEntities,
      totalFound: allEntities.length,
      durationMs: Date.now() - startTime,
      warnings,
      errors,
      timestamp: new Date().toISOString(),
    };
  }

  /** Try plain HTTP fetch — returns null if request fails */
  private async tryPlainFetch(url: string): Promise<string | null> {
    try {
      const html = await fetchWithRetry(url, {
        registryId: this.config.id,
        rateLimit: this.config.rateLimit,
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-GB,en;q=0.9',
          Referer: `${BASE_URL}/regulated-entities`,
        },
      });
      return html;
    } catch {
      return null;
    }
  }

  /** Try Firecrawl (renders JS, bypasses CloudFlare) — returns null if unavailable or fails */
  private async tryFirecrawlFetch(url: string, warnings: string[]): Promise<string | null> {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      warnings.push('FIRECRAWL_API_KEY not set — cannot bypass CloudFlare');
      logger.warn(this.config.id, 'Firecrawl unavailable: no API key');
      return null;
    }

    try {
      const firecrawl = new Firecrawl({ apiKey });
      logger.info(this.config.id, `Firecrawl scraping: ${url}`);

      // Firecrawl v2: .scrape() returns Document directly, throws on failure
      const doc = await firecrawl.scrape(url, {
        formats: ['html'],
        timeout: 45_000,
      });

      const html = doc.html || '';
      if (html.length < 200) {
        logger.warn(this.config.id, `Firecrawl returned too short response (${html.length} chars)`);
        return null;
      }

      logger.info(this.config.id, `Firecrawl success: ${html.length} chars`);
      return html;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(this.config.id, `Firecrawl error: ${msg}`);
      warnings.push(`Firecrawl scrape failed: ${msg}`);
      return null;
    }
  }

  /** Check if the response is a CloudFlare challenge page */
  private isCloudFlareChallenge(html: string): boolean {
    return (
      html.includes('_cf_chl_opt') ||
      html.includes('Just a moment') ||
      html.includes('cf-browser-verification') ||
      html.includes('cloudflare') && html.includes('challenge')
    );
  }

  /** Parse the entity list page */
  private parseListPage(
    html: string,
    page: { licenseType: string; activity: string; url: string },
    warnings: string[]
  ): ParsedEntity[] {
    const $ = cheerio.load(html);
    const entities: ParsedEntity[] = [];

    // Strategy 1: Entity links with class "intext" inside regulated-entities list
    $('a.intext[href*="/regulated-entity/"]').each((_, el) => {
      const name = $(el).text().trim();
      const href = $(el).attr('href') || '';

      if (name && name.length > 2) {
        // Extract entity ID from URL slug: /regulated-entity/bullish-gi-ltd-27248 → 27248
        const idMatch = href.match(/-(\d+)$/);
        const entityId = idMatch ? idMatch[1] : '';

        entities.push({
          name,
          licenseNumber: entityId ? `GI-FSC-${entityId}` : `GI-FSC-${name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 25)}`,
          countryCode: 'GI',
          country: 'Gibraltar',
          licenseType: page.licenseType,
          status: 'Licensed',
          regulator: 'FSC Gibraltar',
          activities: [page.activity],
          sourceUrl: href.startsWith('/') ? `${BASE_URL}${href}` : page.url,
        });
      }
    });

    // Strategy 2: Any links inside ul.regulated-entities
    if (entities.length === 0) {
      $('ul.regulated-entities a').each((_, el) => {
        const name = $(el).text().trim();
        const href = $(el).attr('href') || '';

        if (name && name.length > 3 && href.includes('/regulated-entity/')) {
          const idMatch = href.match(/-(\d+)$/);
          const entityId = idMatch ? idMatch[1] : '';

          entities.push({
            name,
            licenseNumber: entityId ? `GI-FSC-${entityId}` : `GI-FSC-${name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 25)}`,
            countryCode: 'GI',
            country: 'Gibraltar',
            licenseType: page.licenseType,
            status: 'Licensed',
            regulator: 'FSC Gibraltar',
            activities: [page.activity],
            sourceUrl: page.url,
          });
        }
      });
    }

    // Strategy 3: Generic list parsing
    if (entities.length === 0) {
      $('li a').each((_, el) => {
        const name = $(el).text().trim();
        const href = $(el).attr('href') || '';

        if (
          name &&
          name.length > 3 &&
          name.length < 200 &&
          (href.includes('regulated-entity') || href.includes('register')) &&
          !name.toLowerCase().includes('home') &&
          !name.toLowerCase().includes('about') &&
          !name.toLowerCase().includes('contact')
        ) {
          entities.push({
            name,
            licenseNumber: `GI-FSC-${name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 25)}`,
            countryCode: 'GI',
            country: 'Gibraltar',
            licenseType: page.licenseType,
            status: 'Licensed',
            regulator: 'FSC Gibraltar',
            activities: [page.activity],
            sourceUrl: page.url,
          });
        }
      });
    }

    return entities;
  }
}
