/**
 * Cayman Islands CIMA — Virtual Asset Service Providers
 *
 * Source: Cayman Islands Monetary Authority (CIMA) Entity Search
 * URL: https://www.cima.ky/search-entities-cima
 * ~21 VASPs (registrations + licences)
 * Format: HTML table (POST form with CSRF token)
 *
 * Two categories:
 * - "Virtual Asset Service Provider Registration" (since Oct 2020)
 * - "Virtual Asset Service Provider Licence" (since April 2025)
 *
 * The search form uses CSRF tokens but the ajax variant may bypass reCAPTCHA.
 *
 * Usage:
 *   npx tsx parsers/registries/ky-cima.ts --dry-run
 *   npx tsx parsers/registries/ky-cima.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as cheerio from 'cheerio';
import type { RegistryParser, ParserConfig, ParseResult, ParsedEntity } from '../core/types.js';
import { logger } from '../core/logger.js';

const BASE_URL = 'https://www.cima.ky';
const SEARCH_URL = `${BASE_URL}/search-entities-cima`;
const FORM_ACTION = `${BASE_URL}/search-entities-cima/get_search_data`;

/** VASP categories to search for */
const VASP_CATEGORIES = [
  'Virtual Asset Service Provider Registration',
  'Virtual Asset Service Provider Licence',
];

/** Fetch CSRF token from the search page */
async function fetchCsrfToken(): Promise<{ csrfName: string; csrfValue: string; cookies: string }> {
  const response = await fetch(`${SEARCH_URL}?ajax=Y`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
    },
  });

  const cookies = response.headers.get('set-cookie') ?? '';
  const html = await response.text();
  const $ = cheerio.load(html);

  // CSRF token is in a hidden input
  const csrfInput = $('input[name="cima_cfrf_token_name"]');
  const csrfValue = csrfInput.val() as string || '';
  const csrfName = 'cima_cfrf_token_name';

  return { csrfName, csrfValue, cookies };
}

/** Fetch entities for a specific VASP category */
async function fetchCategoryEntities(
  category: string,
  csrfToken: string,
  cookies: string,
  registryId: string,
): Promise<ParsedEntity[]> {
  const entities: ParsedEntity[] = [];

  // Build form data
  const formData = new URLSearchParams();
  formData.set('Searching', '');
  formData.set('AuthorizationType', category);
  formData.set('cima_cfrf_token_name', csrfToken);
  formData.set('hiddenRecaptcha', '');

  logger.info(registryId, `Searching for: ${category}`);

  const response = await fetch(FORM_ACTION, {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookies,
      'Referer': SEARCH_URL,
      'Accept': 'text/html,application/xhtml+xml',
    },
    body: formData.toString(),
  });

  if (!response.ok) {
    logger.warn(registryId, `Form POST returned ${response.status} for ${category}`);
    return entities;
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Parse table rows
  const rows = $('table tr').toArray();
  let headerFound = false;

  for (const row of rows) {
    const cells = $(row).find('td');
    if (cells.length === 0) {
      // Check if header row
      const ths = $(row).find('th');
      if (ths.length >= 3) headerFound = true;
      continue;
    }

    if (!headerFound && cells.length < 3) continue;

    // Columns: Reference Number, Name, Type, Status Effective Date, Status
    const refNumber = $(cells[0]).text().trim();
    const name = $(cells[1]).text().trim();
    const type = $(cells[2]).text().trim();
    const status = cells.length > 4 ? $(cells[4]).text().trim() : 'ACT';

    if (!name || !refNumber || !/^\d+$/.test(refNumber)) continue;

    const isActive = status === 'ACT' || status.toLowerCase().includes('active');

    entities.push({
      name,
      countryCode: 'KY',
      country: 'Cayman Islands',
      licenseNumber: `CIMA-${refNumber}`,
      licenseType: type || category,
      status: isActive ? 'Active' : 'Revoked',
      regulator: 'CIMA (Cayman Islands Monetary Authority)',
      sourceUrl: SEARCH_URL,
    });
  }

  return entities;
}

export class KyCimaParser implements RegistryParser {
  config: ParserConfig = {
    id: 'ky-cima',
    name: 'Cayman Islands CIMA VASP Register',
    countryCode: 'KY',
    country: 'Cayman Islands',
    regulator: 'CIMA (Cayman Islands Monetary Authority)',
    url: SEARCH_URL,
    sourceType: 'html',
    rateLimit: 5_000,
    needsProxy: false,
    needsBrowser: false,
  };

  async parse(): Promise<ParseResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const errors: string[] = [];
    const allEntities: ParsedEntity[] = [];

    // Step 1: Get CSRF token
    logger.info(this.config.id, 'Fetching CSRF token from search page...');
    let csrfToken: string;
    let cookies: string;

    try {
      const csrf = await fetchCsrfToken();
      csrfToken = csrf.csrfValue;
      cookies = csrf.cookies;
      logger.info(this.config.id, `CSRF token obtained (${csrfToken.length} chars)`);
    } catch (err) {
      const msg = `Failed to get CSRF token: ${err instanceof Error ? err.message : String(err)}`;
      logger.error(this.config.id, msg);
      errors.push(msg);
      return {
        registryId: this.config.id,
        countryCode: 'KY',
        entities: [],
        totalFound: 0,
        durationMs: Date.now() - startTime,
        warnings,
        errors,
        timestamp: new Date().toISOString(),
      };
    }

    // Step 2: Search each VASP category
    for (const category of VASP_CATEGORIES) {
      try {
        const entities = await fetchCategoryEntities(category, csrfToken, cookies, this.config.id);
        logger.info(this.config.id, `  ${category}: ${entities.length} entities`);
        allEntities.push(...entities);
      } catch (err) {
        const msg = `Failed to fetch ${category}: ${err instanceof Error ? err.message : String(err)}`;
        warnings.push(msg);
        logger.warn(this.config.id, msg);
      }

      // Rate limit between requests
      await new Promise((r) => setTimeout(r, 2_000));
    }

    // Deduplicate by reference number (entity may appear in both categories)
    const seen = new Map<string, ParsedEntity>();
    for (const e of allEntities) {
      const existing = seen.get(e.licenseNumber);
      if (!existing) {
        seen.set(e.licenseNumber, e);
      } else {
        // Merge: prefer the one with more info
        existing.licenseType = `${existing.licenseType} + ${e.licenseType}`;
      }
    }

    const deduplicated = [...seen.values()];

    return {
      registryId: this.config.id,
      countryCode: 'KY',
      entities: deduplicated,
      totalFound: deduplicated.length,
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

  const parser = new KyCimaParser();
  const result = await parser.parse();

  console.log(`\n✅ ${result.entities.length} entities parsed in ${(result.durationMs / 1000).toFixed(1)}s`);
  if (result.warnings.length > 0) {
    console.log(`⚠️  Warnings: ${result.warnings.join('; ')}`);
  }
  for (const e of result.entities) {
    console.log(`  ${e.name} | ${e.licenseType} | ${e.status}`);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
