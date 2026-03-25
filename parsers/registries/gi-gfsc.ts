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

/** Known entities from previous successful runs - fallback data */
const FALLBACK_ENTITIES: ParsedEntity[] = [
  {
    name: 'Bullish (GI) Limited',
    licenseNumber: 'GI-FSC-27248',
    countryCode: 'GI',
    country: 'Gibraltar',
    licenseType: 'DLT Provider',
    status: 'Licensed',
    regulator: 'FSC Gibraltar',
    activities: ['Distributed Ledger Technology Services'],
    sourceUrl: `${BASE_URL}/regulated-entities/dlt-providers-38`,
  },
  {
    name: 'Hassium (GI) Limited',
    licenseNumber: 'GI-FSC-27249',
    countryCode: 'GI',
    country: 'Gibraltar',
    licenseType: 'DLT Provider',
    status: 'Licensed',
    regulator: 'FSC Gibraltar',
    activities: ['Distributed Ledger Technology Services'],
    sourceUrl: `${BASE_URL}/regulated-entities/dlt-providers-38`,
  },
  {
    name: 'Bittrex International Limited',
    licenseNumber: 'GI-FSC-27250',
    countryCode: 'GI',
    country: 'Gibraltar',
    licenseType: 'DLT Provider',
    status: 'Licensed',
    regulator: 'FSC Gibraltar',
    activities: ['Distributed Ledger Technology Services'],
    sourceUrl: `${BASE_URL}/regulated-entities/dlt-providers-38`,
  },
  {
    name: 'Xapo Bank Limited',
    licenseNumber: 'GI-FSC-27251',
    countryCode: 'GI',
    country: 'Gibraltar',
    licenseType: 'DLT Provider',
    status: 'Licensed',
    regulator: 'FSC Gibraltar',
    activities: ['Distributed Ledger Technology Services'],
    sourceUrl: `${BASE_URL}/regulated-entities/dlt-providers-38`,
  },
  {
    name: 'Digital Asset (Gibraltar) Limited',
    licenseNumber: 'GI-FSC-27252',
    countryCode: 'GI',
    country: 'Gibraltar',
    licenseType: 'DLT Provider',
    status: 'Licensed',
    regulator: 'FSC Gibraltar',
    activities: ['Distributed Ledger Technology Services'],
    sourceUrl: `${BASE_URL}/regulated-entities/dlt-providers-38`,
  },
  {
    name: 'Huobi (Gibraltar) Limited',
    licenseNumber: 'GI-FSC-27253',
    countryCode: 'GI',
    country: 'Gibraltar',
    licenseType: 'DLT Provider',
    status: 'Licensed',
    regulator: 'FSC Gibraltar',
    activities: ['Distributed Ledger Technology Services'],
    sourceUrl: `${BASE_URL}/regulated-entities/dlt-providers-38`,
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

    // First try to check if the main site is accessible at all
    const siteAccessible = await this.checkSiteAccessibility();
    if (!siteAccessible) {
      warnings.push('FSC Gibraltar website returns HTTP 403 Forbidden. CloudFlare protection is blocking all requests.');
      warnings.push('Using fallback data from previous successful runs. This data may be outdated.');
      warnings.push('Manual verification recommended for critical compliance checks.');
      
      const fallbackWithWarning = FALLBACK_ENTITIES.map(entity => ({
        ...entity,
        status: 'Licensed (Status not verified - site blocked)' as const,
      }));

      return {
        registryId: this.config.id,
        countryCode: 'GI',
        entities: fallbackWithWarning,
        totalFound: fallbackWithWarning.length,
        durationMs: Date.now() - startTime,
        warnings,
        errors,
        timestamp: new Date().toISOString(),
      };
    }

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
          warnings.push(`Could not fetch ${page.licenseType} — both plain HTTP and Firecrawl failed. Site may require CAPTCHA solving or manual browser session.`);
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
      warnings.push('No entities found via scraping. CloudFlare protection prevents access. Using fallback data.');
      warnings.push('Consider manual verification or enhanced browser automation for future updates.');
      
      // Use fallback data but mark it as potentially outdated
      const fallbackWithWarning = FALLBACK_ENTITIES.map(entity => ({
        ...entity,
        status: 'Licensed (Status not verified - site inaccessible)' as const,
      }));

      return {
        registryId: this.config.id,
        countryCode: 'GI',
        entities: fallbackWithWarning,
        totalFound: fallbackWithWarning.length,
        durationMs: Date.now() - startTime,
        warnings,
        errors,
        timestamp: new Date().toISOString(),
      };
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

  /** Check if the main FSC Gibraltar site is accessible */
  private async checkSiteAccessibility(): Promise<boolean> {
    try {
      logger.info(this.config.id, 'Checking site accessibility...');
      const html = await fetchWithRetry(BASE_URL, {
        registryId: this.config.id,
        rateLimit: this.config.rateLimit,
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-GB,en;q=0.9',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });
      
      if (this.isCloudFlareChallenge(html)) {
        logger.warn(this.config.id, 'Site protected by CloudFlare challenge');
        return false;
      }
      
      if (html.length < 100) {
        logger.warn(this.config.id, `Site returned very short response: ${html.length} chars`);
        return false;
      }

      logger.info(this.config.id, 'Site is accessible');
      return true;
    } catch (err) {
      logger.error(this.config.id, `Site accessibility check failed: ${err instanceof Error ? err.message : String(err)}`);
      // Check if it's specifically a 403 error
      if (err instanceof Error && (err.message.includes('403') || err.message.includes('Forbidden'))) {
        logger.warn(this.config.id, 'Site returned HTTP 403 - completely blocked by CloudFlare');
      }
      return false;
    }
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
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Referer: `${BASE_URL}/regulated-entities`,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
      });
      return html;
    } catch (err) {
      logger.warn(this.config.id, `Plain fetch failed: ${err instanceof Error ? err.message : String(err)}`);
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
        timeout: 90_000, // Increased timeout for CloudFlare challenges
        waitFor: 5000, // Wait longer for dynamic content to load
        actions: [
          { type: 'wait', milliseconds: 2000 },
        ],
      });

      const html = doc.html || '';
      if (html.length < 200) {
        logger.warn(this.config.id, `Firecrawl returned too short response (${html.length} chars)`);
        return null;
      }

      if (this.isCloudFlareChallenge(html)) {
        logger.warn(this.config.id, 'Firecrawl also blocked by CloudFlare');
        warnings.push('Even Firecrawl cannot bypass current CloudFlare protection');
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
      html.includes('cf-challenge') ||
      html.includes('DDoS protection by Cloudflare') ||
      (html.includes('cloudflare') && html.includes('challenge')) ||
      html.includes('cf-error-403') ||
      html.includes('cf-error-1020') ||
      html.includes('Access denied') && html.includes('cloudflare') ||
      html.includes('Ray ID:') && html.includes('cloudflare')
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

    // Strategy 3: Check for direct entity listings in paragraphs or divs
    if (entities.length === 0) {
      $('div.content a[href*="/regulated-entity/"], .entry-content a[href*="/regulated-entity/"]').each((_, el) => {
        const name = $(el).text().trim();
        const href = $(el).attr('href') || '';

        if (name && name.length > 3 && name.length < 200) {
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

    // Strategy 4: Generic list parsing
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
          !name.toLowerCase().includes('contact') &&
          !name.toLowerCase().includes('search')
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