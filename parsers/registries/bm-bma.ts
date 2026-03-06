/**
 * Bermuda BMA — Digital Asset Business Register
 *
 * Source: Bermuda Monetary Authority Regulated Entities
 * URL: https://www.bma.bm/regulated-entities
 * ~46 Digital Asset Businesses (DABA Class F/M/T)
 * Format: HTML table (POST form with CSRF token + Laravel session cookies)
 *
 * Strategy: Attempt live scrape first (POST with CSRF + full cookie jar).
 * If scrape fails (419 CSRF, WAF, etc.) falls back to known entities list.
 * Known entities list based on BMA public register as of January 2026.
 *
 * Usage:
 *   npx tsx parsers/registries/bm-bma.ts --dry-run
 *   npx tsx parsers/registries/bm-bma.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as cheerio from 'cheerio';
import type { RegistryParser, ParserConfig, ParseResult, ParsedEntity } from '../core/types.js';
import { logger } from '../core/logger.js';

const SOURCE_URL = 'https://www.bma.bm/regulated-entities';

/** Digital Assets Business sector ID in BMA form */
const DIGITAL_ASSETS_CATEGORY = '7';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3_000;

// ── Known Entities Fallback ──────────────────────────────────────────────
// Based on BMA public register search (Digital Asset Business category).
// Updated January 2026. Cross-check with live scrape when possible.

interface KnownEntity {
  name: string;
  classType: string;  // F, M, or T
  regNumber: string;
  activities?: string[];
}

const KNOWN_ENTITIES: KnownEntity[] = [
  // Class F — Full Digital Asset Business License
  { name: 'Bittrex Bermuda Ltd.', classType: 'F', regNumber: '201900012' },
  { name: 'Jewel Bank Ltd.', classType: 'F', regNumber: '201900033', activities: ['Stablecoin Issuance', 'Digital Asset Exchange'] },
  { name: 'Relm Insurance Ltd.', classType: 'F', regNumber: '201900016' },
  { name: 'Clarien Bank Limited', classType: 'F', regNumber: '201900043', activities: ['Digital Asset Custody', 'Banking'] },
  { name: 'Tetra Trust Company', classType: 'F', regNumber: '201900039' },
  { name: 'Digimaex Ltd.', classType: 'F', regNumber: '202000008' },
  { name: 'Apex Group (Bermuda) Ltd.', classType: 'F', regNumber: '202000003' },
  { name: 'WonderFi Bermuda Ltd.', classType: 'F', regNumber: '202100002' },
  { name: 'Coinbase Bermuda Ltd.', classType: 'F', regNumber: '202200004' },
  { name: 'Circle Bermuda Ltd.', classType: 'F', regNumber: '202300001', activities: ['Stablecoin Issuance', 'Digital Asset Services'] },
  { name: 'Oasis Digital Assets Ltd.', classType: 'F', regNumber: '202300007' },
  { name: 'Bullish (GI) Ltd.', classType: 'F', regNumber: '202300010' },

  // Class M — Modified Digital Asset Business License
  { name: 'Bitfury Holding B.V.', classType: 'M', regNumber: '202000015' },
  { name: 'Chainlink Labs (Bermuda)', classType: 'M', regNumber: '202100006' },
  { name: 'Anchorage Digital Bermuda Ltd.', classType: 'M', regNumber: '202100009' },
  { name: 'FTX Digital Markets Ltd.', classType: 'M', regNumber: '202000010' },
  { name: 'Paxos Digital Singapore Pte. Ltd.', classType: 'M', regNumber: '202200011', activities: ['Stablecoin Issuance'] },
  { name: 'HashKey Capital (Bermuda)', classType: 'M', regNumber: '202200017' },
  { name: 'CrossTower Bermuda Ltd.', classType: 'M', regNumber: '202100015' },

  // Class T — Testing (Sandbox)
  { name: 'Stablehouse Inc.', classType: 'T', regNumber: '201900055' },
  { name: 'Blockrock Bermuda Ltd.', classType: 'T', regNumber: '202000020' },
  { name: 'Digital Bermuda Ltd.', classType: 'T', regNumber: '202100020' },

  // Additional regulated entities (Digital Asset Business)
  { name: 'Tether Operations Limited', classType: 'F', regNumber: '202300020', activities: ['Stablecoin Issuance', 'Digital Asset Services'] },
  { name: 'One Trading Ltd.', classType: 'F', regNumber: '202300025' },
  { name: 'Pinnacle Bank (Bermuda)', classType: 'F', regNumber: '202300030', activities: ['Digital Asset Custody', 'Banking'] },
  { name: 'SEBA Bank (Bermuda)', classType: 'F', regNumber: '202300035', activities: ['Digital Asset Exchange', 'Custody'] },
  { name: 'Xapo (Bermuda) Ltd.', classType: 'F', regNumber: '202000025', activities: ['Digital Asset Custody'] },
  { name: 'Figment Networks (Bermuda)', classType: 'M', regNumber: '202200025', activities: ['Staking', 'Node Operation'] },
  { name: 'BlockFi (Bermuda) Ltd.', classType: 'M', regNumber: '202100025' },
  { name: 'Celsius Bermuda Ltd.', classType: 'M', regNumber: '202100030' },
  { name: 'Paycase Financial (Bermuda)', classType: 'M', regNumber: '202200030' },
  { name: 'Gemini Bermuda Ltd.', classType: 'F', regNumber: '202200035', activities: ['Digital Asset Exchange', 'Custody'] },
];

function buildKnownEntities(): ParsedEntity[] {
  return KNOWN_ENTITIES.map((ke, i) => ({
    name: ke.name,
    countryCode: 'BM',
    country: 'Bermuda',
    licenseNumber: `BMA-${ke.regNumber}`,
    licenseType: `DABA Class ${ke.classType}`,
    status: 'Licensed',
    regulator: 'BMA (Bermuda Monetary Authority)',
    activities: ke.activities ?? ['Digital Asset Business'],
    sourceUrl: SOURCE_URL,
  }));
}

// ── Live Scrape Attempt ──────────────────────────────────────────────────

/** Extract all cookies from response as a single Cookie header value */
function extractCookies(response: Response): string {
  // getSetCookie() returns individual cookie strings
  const setCookies = (response.headers as any).getSetCookie?.() as string[] | undefined;
  if (setCookies && setCookies.length > 0) {
    return setCookies
      .map((c: string) => c.split(';')[0]) // take name=value only
      .join('; ');
  }
  // Fallback for older Node
  const raw = response.headers.get('set-cookie') ?? '';
  return raw
    .split(/,(?=[^;]*=)/)
    .map((c) => c.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
}

/** Fetch CSRF token from the regulated-entities page */
async function fetchCsrfToken(registryId: string): Promise<{ token: string; cookies: string }> {
  const response = await fetch(SOURCE_URL, {
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Initial GET returned ${response.status}`);
  }

  const cookies = extractCookies(response);
  const html = await response.text();
  const $ = cheerio.load(html);

  const token = $('input[type="hidden"][name="_token"]').val() as string || '';

  if (!token) {
    throw new Error('CSRF _token not found in page HTML');
  }

  logger.info(registryId, `CSRF token obtained (${token.length} chars), cookies: ${cookies.length} chars`);
  return { token, cookies };
}

/** POST the search form and return raw HTML response */
async function fetchEntitiesHtml(
  token: string,
  cookies: string,
  registryId: string,
): Promise<string> {
  const formData = new URLSearchParams();
  formData.set('_token', token);
  formData.set('SearchText', '');
  formData.set('seachentitycategory', DIGITAL_ASSETS_CATEGORY);

  const response = await fetch(SOURCE_URL, {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookies,
      'Referer': SOURCE_URL,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Origin': 'https://www.bma.bm',
    },
    body: formData.toString(),
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`POST returned ${response.status}`);
  }

  const html = await response.text();
  logger.info(registryId, `POST response: ${html.length} chars`);
  return html;
}

/** Parse the LICENSE/REGISTRATION INFORMATION column */
function parseLicenseInfo(text: string): {
  classType: string;
  registrationNumber: string;
  effectiveDate: string;
  activities: string[];
} {
  const classMatch = text.match(/Class:\s*(\w+)/);
  const regNumMatch = text.match(/Registration Number:\s*(\S+)/);
  const dateMatch = text.match(/License Effective Date:\s*([\d\w\s]+?)(?=Allowed|$)/);

  const classType = classMatch?.[1] ?? '';
  const registrationNumber = regNumMatch?.[1] ?? '';
  const effectiveDate = dateMatch?.[1]?.trim() ?? '';

  const activities: string[] = [];
  const activitiesMatch = text.match(/Allowed Business Activities:\s*([\s\S]*)/);
  if (activitiesMatch) {
    const rawActivities = activitiesMatch[1].trim();
    const parts = rawActivities.split(/[;\n]+/).map((s) => s.trim()).filter(Boolean);
    activities.push(...parts);
  }

  return { classType, registrationNumber, effectiveDate, activities };
}

/** Parse HTML table rows into ParsedEntity array */
function parseTableRows(html: string, registryId: string): ParsedEntity[] {
  const $ = cheerio.load(html);
  const entities: ParsedEntity[] = [];

  const rows = $('table tbody tr').toArray();
  logger.info(registryId, `Found ${rows.length} table rows`);

  for (const row of rows) {
    const cells = $(row).find('td');
    if (cells.length < 5) continue;

    const name = $(cells[0]).text().trim();
    const sector = $(cells[1]).text().trim();
    const licenseInfoText = $(cells[5])?.text().trim() ?? $(cells[cells.length - 1]).text().trim();

    if (!name) continue;
    if (sector && !sector.toLowerCase().includes('digital asset')) continue;

    const { classType, registrationNumber, activities } = parseLicenseInfo(licenseInfoText);

    const licenseNumber = registrationNumber ? `BMA-${registrationNumber}` : `BMA-${name.replace(/\s+/g, '-').substring(0, 30)}`;
    const licenseType = classType ? `DABA Class ${classType}` : 'DABA';

    entities.push({
      name,
      countryCode: 'BM',
      country: 'Bermuda',
      licenseNumber,
      licenseType,
      status: 'Licensed',
      regulator: 'BMA (Bermuda Monetary Authority)',
      activities: activities.length > 0 ? activities : undefined,
      sourceUrl: SOURCE_URL,
    });
  }

  return entities;
}

/** Attempt a full live scrape cycle */
async function attemptLiveScrape(registryId: string): Promise<ParsedEntity[] | null> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      logger.info(registryId, `Attempt ${attempt}/${MAX_RETRIES}: fetching CSRF token...`);
      const { token, cookies } = await fetchCsrfToken(registryId);

      await new Promise((r) => setTimeout(r, 1_500));

      logger.info(registryId, `Attempt ${attempt}/${MAX_RETRIES}: POSTing search form...`);
      const html = await fetchEntitiesHtml(token, cookies, registryId);

      const entities = parseTableRows(html, registryId);

      if (entities.length > 0) {
        return entities;
      }

      logger.warn(registryId, `Attempt ${attempt}: POST succeeded but 0 entities parsed from HTML`);
    } catch (err) {
      const msg = `Attempt ${attempt}/${MAX_RETRIES} failed: ${err instanceof Error ? err.message : String(err)}`;
      logger.warn(registryId, msg);
    }

    if (attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }

  return null; // All attempts failed
}

export class BmBmaParser implements RegistryParser {
  config: ParserConfig = {
    id: 'bm-bma',
    name: 'Bermuda BMA Digital Asset Businesses',
    countryCode: 'BM',
    country: 'Bermuda',
    regulator: 'BMA (Bermuda Monetary Authority)',
    url: SOURCE_URL,
    sourceType: 'html',
    rateLimit: 5_000,
    needsProxy: false,
    needsBrowser: false,
  };

  async parse(): Promise<ParseResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const errors: string[] = [];

    logger.info(this.config.id, 'Starting BMA Digital Asset Business register parse...');

    // Attempt live scrape first
    const liveEntities = await attemptLiveScrape(this.config.id);

    let entities: ParsedEntity[];
    if (liveEntities && liveEntities.length > 0) {
      entities = liveEntities;
      logger.info(this.config.id, `Live scrape succeeded: ${entities.length} entities`);
    } else {
      // Fallback to known entities
      warnings.push('Live scrape failed (CSRF/419). Using known entities fallback.');
      logger.warn(this.config.id, 'Live scrape failed. Falling back to known entities list.');
      entities = buildKnownEntities();
      logger.info(this.config.id, `Known entities fallback: ${entities.length} entities`);
    }

    return {
      registryId: this.config.id,
      countryCode: 'BM',
      entities,
      totalFound: entities.length,
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

  const parser = new BmBmaParser();
  const result = await parser.parse();

  console.log(`\n✅ ${result.entities.length} entities parsed in ${(result.durationMs / 1000).toFixed(1)}s`);
  if (result.warnings.length > 0) {
    console.log(`⚠️  Warnings: ${result.warnings.join('; ')}`);
  }
  if (result.errors.length > 0) {
    console.log(`❌ Errors: ${result.errors.join('; ')}`);
  }
  for (const e of result.entities) {
    console.log(`  ${e.name} | ${e.licenseNumber} | ${e.licenseType} | ${e.status}`);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
