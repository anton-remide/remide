/**
 * UAE ADGM — Abu Dhabi Global Market (FSRA) Public Register
 *
 * Source: ADGM Financial Services Regulatory Authority
 * API: POST https://www.adgm.com/api/FSRA_AllTab/GetAllTabResponse
 * ~547 regulated firms (financial firms, recognized bodies, remote bodies)
 * Format: JSON POST API (public, no auth)
 *
 * ADGM is Abu Dhabi's international financial centre, regulated by FSRA.
 * This parser covers ALL regulated firms including virtual asset service providers,
 * fund managers, banks, broker-dealers, and insurance firms.
 *
 * The API returns basic info (title + URL). License numbers are extracted from URLs.
 * Firm categories are determined by URL path segments.
 *
 * Usage:
 *   npx tsx parsers/registries/ae-adgm.ts --dry-run
 *   npx tsx parsers/registries/ae-adgm.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import type { RegistryParser, ParserConfig, ParseResult, ParsedEntity } from '../core/types.js';
import { logger } from '../core/logger.js';

const API_URL = 'https://www.adgm.com/api/FSRA_AllTab/GetAllTabResponse';
const SOURCE_URL = 'https://www.adgm.com/public-registers/fsra';

/** ADGM API response structure */
interface AdgmTabResponse {
  totalitems: number;
  firms: {
    totalitems: number;
    items: AdgmFirmItem[];
  };
  individuals: {
    totalitems: number;
    items: AdgmFirmItem[];
  };
  funds: {
    totalitems: number;
    items: AdgmFirmItem[];
  };
}

interface AdgmFirmItem {
  title: string;
  url: string;
}

/** Firm category from URL path */
type FirmCategory = 'financial-firms' | 'recognized-bodies' | 'remote-bodies' | 'unknown';

/** Map URL path to category display name */
const CATEGORY_LABELS: Record<FirmCategory, string> = {
  'financial-firms': 'FSRA Financial Firm',
  'recognized-bodies': 'Recognized Body',
  'remote-bodies': 'Remote Body',
  'unknown': 'FSRA Regulated Firm',
};

/** Extract category from firm URL */
function extractCategory(url: string): FirmCategory {
  if (url.includes('/financial-firms/')) return 'financial-firms';
  if (url.includes('/recognized-bodies/')) return 'recognized-bodies';
  if (url.includes('/remote-bodies/')) return 'remote-bodies';
  return 'unknown';
}

/** Extract license number from URL slug (e.g., "zilla-capital-190041" → "ADGM-190041") */
function extractLicenseNumber(url: string, name: string): string {
  // Try to extract numeric ID from end of URL
  const match = url.match(/[_-](\d{6})(?:\/?$|$)/);
  if (match) return `ADGM-${match[1]}`;

  // Try shorter numeric IDs (4-5 digits)
  const shortMatch = url.match(/[_-](\d{4,5})(?:\/?$|$)/);
  if (shortMatch) return `ADGM-${shortMatch[1]}`;

  // Fallback: generate from name
  const sanitized = name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 30);
  return `ADGM-${sanitized}`;
}

/** Fetch all firms from ADGM API */
async function fetchAdgmFirms(registryId: string): Promise<AdgmFirmItem[]> {
  logger.info(registryId, 'Fetching firms from ADGM FSRA API...');

  // Note: ADGM API rejects numberofitems > ~1000 with 400 Bad Request
  const bodyStr = JSON.stringify({ query: ' ', numberofitems: 1000 });

  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30_000);

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: bodyStr,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`ADGM API returned ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as AdgmTabResponse;

      logger.info(registryId, `API response: ${data.firms.totalitems} firms, ${data.individuals.totalitems} individuals, ${data.funds.totalitems} funds`);

      return data.firms.items;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt < maxRetries) {
        const backoffMs = 2000 * attempt;
        logger.warn(registryId, `Attempt ${attempt}/${maxRetries} failed: ${msg}. Retrying in ${backoffMs}ms`);
        await new Promise(r => setTimeout(r, backoffMs));
      } else {
        throw new Error(`Failed to fetch ADGM API after ${maxRetries} attempts: ${msg}`);
      }
    }
  }

  throw new Error('Unreachable');
}

/** Convert ADGM firm item to ParsedEntity */
function mapFirmToEntity(item: AdgmFirmItem): ParsedEntity {
  const category = extractCategory(item.url);
  const licenseNumber = extractLicenseNumber(item.url, item.title);
  const fullUrl = item.url.startsWith('http') ? item.url : `https://www.adgm.com${item.url}`;

  return {
    name: item.title.trim(),
    licenseNumber,
    countryCode: 'AE',
    country: 'United Arab Emirates',
    status: 'Licensed',
    regulator: 'ADGM FSRA',
    licenseType: CATEGORY_LABELS[category],
    activities: category === 'financial-firms'
      ? ['Financial Services']
      : category === 'recognized-bodies'
        ? ['Recognized Body', 'Market Operator']
        : ['Remote Body', 'Financial Services'],
    sourceUrl: fullUrl,
  };
}

export class AeAdgmParser implements RegistryParser {
  config: ParserConfig = {
    id: 'ae-adgm',
    name: 'UAE ADGM FSRA Public Register',
    countryCode: 'AE',
    country: 'United Arab Emirates',
    regulator: 'ADGM FSRA (Financial Services Regulatory Authority)',
    url: SOURCE_URL,
    sourceType: 'api',
    rateLimit: 5_000,
    needsProxy: false,
    needsBrowser: false,
  };

  async parse(): Promise<ParseResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      const firmItems = await fetchAdgmFirms(this.config.id);

      if (firmItems.length === 0) {
        warnings.push('ADGM API returned 0 firms. API may have changed.');
      }

      // Deduplicate by title (some firms appear in multiple categories)
      const seen = new Map<string, ParsedEntity>();
      for (const item of firmItems) {
        const key = item.title.trim().toLowerCase();
        if (!seen.has(key)) {
          seen.set(key, mapFirmToEntity(item));
        }
      }

      const entities = Array.from(seen.values());

      // Log category distribution
      const catCounts: Record<string, number> = {};
      for (const e of entities) {
        const cat = e.licenseType ?? 'Unknown';
        catCounts[cat] = (catCounts[cat] ?? 0) + 1;
      }
      const catSummary = Object.entries(catCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, n]) => `${cat}: ${n}`)
        .join(', ');
      logger.info(this.config.id, `Categories: ${catSummary}`);
      logger.info(this.config.id, `Total: ${entities.length} unique firms (${firmItems.length} raw)`);

      return {
        registryId: this.config.id,
        countryCode: 'AE',
        entities,
        totalFound: entities.length,
        durationMs: Date.now() - startTime,
        warnings,
        errors,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`ADGM scraping failed: ${msg}`);
      logger.error(this.config.id, msg);

      return {
        registryId: this.config.id,
        countryCode: 'AE',
        entities: [],
        totalFound: 0,
        durationMs: Date.now() - startTime,
        warnings,
        errors,
        timestamp: new Date().toISOString(),
      };
    }
  }
}

/** CLI entry */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--dry-run')) process.env.DRY_RUN = 'true';

  const parser = new AeAdgmParser();
  const result = await parser.parse();

  console.log(`\n✅ ${result.entities.length} entities parsed in ${(result.durationMs / 1000).toFixed(1)}s`);
  for (const e of result.entities.slice(0, 15)) {
    console.log(`  ${e.name} | ${e.licenseType} | ${e.licenseNumber}`);
  }
  if (result.entities.length > 15) {
    console.log(`  ... and ${result.entities.length - 15} more`);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
