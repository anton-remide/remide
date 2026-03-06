/**
 * Kazakhstan AIFC/AFSA — Public Register of Regulated Entities
 *
 * Source: Astana Financial Services Authority (AFSA) Public Register
 * URL: https://publicreg.myafsa.com
 * ~200 entities across 3 register types:
 *   - Digital Asset Service Providers (DASPs): ~25
 *   - Authorised Firms: ~150 (paginated, ~7 pages)
 *   - FinTech Lab Participants: ~25
 * Format: HTML tables with columns: Name | Reference | Status | Date | Activities
 *
 * The Astana International Financial Centre (AIFC) is a financial hub in
 * Kazakhstan with its own common law legal framework. AFSA regulates all
 * entities within the AIFC, including crypto/digital asset service providers,
 * authorised financial firms, and FinTech sandbox participants.
 *
 * Pagination: Authorised Firms register spans multiple pages.
 * URL pattern: ?page=2, ?page=3, etc.
 *
 * Deduplication: Entities may appear in both DASP and FinTech registers.
 * Merges licenseType for duplicates (e.g., "DASP + FinTech Lab Participant").
 *
 * Usage:
 *   npx tsx parsers/registries/kz-afsa.ts --dry-run
 *   npx tsx parsers/registries/kz-afsa.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as cheerio from 'cheerio';
import type { RegistryParser, ParserConfig, ParseResult, ParsedEntity } from '../core/types.js';
import { fetchWithRetry } from '../core/client.js';
import { logger } from '../core/logger.js';

const BASE_URL = 'https://publicreg.myafsa.com';

/** Register types to scrape */
interface RegisterType {
  path: string;
  label: string;
  /** Safety cap for pagination (stop after this many pages even if more exist) */
  maxPages: number;
}

const REGISTER_TYPES: RegisterType[] = [
  { path: '/dasp/', label: 'Digital Asset Service Provider', maxPages: 5 },
  { path: '/authorised/', label: 'Authorised Firm', maxPages: 15 },
  { path: '/fintech/', label: 'FinTech Lab Participant', maxPages: 5 },
];

/**
 * Normalize status text to a consistent format.
 * AFSA uses various casings: "Active", "active", "Expired", "Pending Approval", etc.
 */
function normalizeStatus(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  if (trimmed === 'active' || trimmed === 'act') return 'Active';
  if (trimmed === 'expired' || trimmed === 'exp') return 'Expired';
  if (trimmed === 'revoked' || trimmed === 'rev') return 'Revoked';
  if (trimmed === 'suspended' || trimmed === 'sus') return 'Suspended';
  if (trimmed === 'withdrawn' || trimmed === 'cancelled') return 'Withdrawn';
  if (trimmed.includes('pending')) return 'Pending';
  // Return title-cased original if unrecognized
  return raw.trim().charAt(0).toUpperCase() + raw.trim().slice(1).toLowerCase();
}

/**
 * Parse activities string into an array.
 * Activities are typically separated by semicolons, commas, or newlines.
 */
function parseActivities(raw: string): string[] {
  if (!raw || !raw.trim()) return [];
  return raw
    .split(/[;,\n]+/)
    .map((a) => a.trim())
    .filter((a) => a.length > 0);
}

/**
 * Detect the maximum page number from pagination links on the page.
 * Looks for pagination nav elements with page links like ?page=N.
 */
function detectMaxPage($: cheerio.CheerioAPI): number {
  let maxPage = 1;

  // Look for pagination links: <a href="?page=N"> or <a href="...?page=N">
  $('a[href*="page="]').each((_i, el) => {
    const href = $(el).attr('href') || '';
    const match = href.match(/[?&]page=(\d+)/);
    if (match) {
      const pageNum = parseInt(match[1], 10);
      if (pageNum > maxPage) maxPage = pageNum;
    }
  });

  // Also check for pagination text like "Page 1 of 7"
  const paginationText = $('.pagination, .page-navigation, nav').text();
  const ofMatch = paginationText.match(/of\s+(\d+)/i);
  if (ofMatch) {
    const total = parseInt(ofMatch[1], 10);
    if (total > maxPage) maxPage = total;
  }

  return maxPage;
}

/**
 * Parse entities from an HTML page containing a table.
 * Extracts rows from the first table found with the expected column structure.
 */
function parseTableEntities(
  html: string,
  registerType: RegisterType,
  registryId: string,
): ParsedEntity[] {
  const $ = cheerio.load(html);
  const entities: ParsedEntity[] = [];

  // Find all tables on the page
  const tables = $('table').toArray();
  if (tables.length === 0) {
    logger.warn(registryId, `No tables found on ${registerType.path}`);
    return entities;
  }

  for (const table of tables) {
    const rows = $(table).find('tr').toArray();
    let headerSkipped = false;

    for (const row of rows) {
      // Skip header rows (rows with <th> cells)
      const thCells = $(row).find('th');
      if (thCells.length > 0) {
        headerSkipped = true;
        continue;
      }

      const cells = $(row).find('td').toArray();
      if (cells.length < 3) continue;

      // If we haven't seen a <th> header yet, skip the first data-looking row
      // that might be a styled header (some tables use <td> for headers)
      if (!headerSkipped) {
        headerSkipped = true;
        // Check if this row looks like a header (all cells are short text, no ref numbers)
        const firstCellText = $(cells[0]).text().trim();
        if (firstCellText.toLowerCase().includes('name') || firstCellText === '#') {
          continue;
        }
      }

      // Extract cell text
      const cellTexts = cells.map((cell) => $(cell).text().trim());

      const name = cellTexts[0] || '';
      const reference = cellTexts[1] || '';
      const statusRaw = cellTexts[2] || '';
      // cellTexts[3] = date (not used for entity mapping)
      const activitiesRaw = cellTexts[4] || '';

      // Validate: must have a name and something that looks like an AFSA reference
      if (!name || name.length < 2) continue;
      // Reference should look like AFSA-X-XX-XXXX-XXXX or at least start with AFSA
      if (!reference || (!reference.startsWith('AFSA') && !reference.match(/^\w{2,}/))) continue;

      entities.push({
        name,
        licenseNumber: reference,
        countryCode: 'KZ',
        country: 'Kazakhstan',
        licenseType: registerType.label,
        status: normalizeStatus(statusRaw),
        regulator: 'AFSA',
        activities: parseActivities(activitiesRaw),
        sourceUrl: `${BASE_URL}${registerType.path}`,
      });
    }
  }

  return entities;
}

/**
 * Fetch all entities from a single register type, handling pagination.
 */
async function fetchRegisterEntities(
  registerType: RegisterType,
  registryId: string,
): Promise<{ entities: ParsedEntity[]; pagesScraped: number }> {
  const allEntities: ParsedEntity[] = [];
  let currentPage = 1;
  let maxPage = 1;

  // Fetch page 1
  const page1Url = `${BASE_URL}${registerType.path}`;
  logger.info(registryId, `Fetching ${registerType.label}: ${page1Url}`);

  const page1Html = await fetchWithRetry(page1Url, { registryId, rateLimit: 5_000 });
  const page1Entities = parseTableEntities(page1Html, registerType, registryId);
  allEntities.push(...page1Entities);

  // Detect pagination from page 1
  const $page1 = cheerio.load(page1Html);
  maxPage = detectMaxPage($page1);

  // Cap at maxPages safety limit
  if (maxPage > registerType.maxPages) {
    logger.warn(registryId, `${registerType.label}: detected ${maxPage} pages, capping at ${registerType.maxPages}`);
    maxPage = registerType.maxPages;
  }

  logger.info(registryId, `${registerType.label} page 1: ${page1Entities.length} entities (${maxPage} pages detected)`);

  // Fetch remaining pages
  for (currentPage = 2; currentPage <= maxPage; currentPage++) {
    const pageUrl = `${BASE_URL}${registerType.path}?page=${currentPage}`;
    logger.info(registryId, `Fetching ${registerType.label} page ${currentPage}/${maxPage}...`);

    try {
      const pageHtml = await fetchWithRetry(pageUrl, { registryId, rateLimit: 5_000 });
      const pageEntities = parseTableEntities(pageHtml, registerType, registryId);

      if (pageEntities.length === 0) {
        logger.info(registryId, `${registerType.label} page ${currentPage}: 0 entities, stopping pagination`);
        break;
      }

      allEntities.push(...pageEntities);
      logger.info(registryId, `${registerType.label} page ${currentPage}: ${pageEntities.length} entities`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(registryId, `Failed to fetch ${registerType.label} page ${currentPage}: ${msg}`);
      break;
    }
  }

  return { entities: allEntities, pagesScraped: Math.min(currentPage, maxPage) };
}

export class KzAfsaParser implements RegistryParser {
  config: ParserConfig = {
    id: 'kz-afsa',
    name: 'Kazakhstan AIFC/AFSA Public Register',
    countryCode: 'KZ',
    country: 'Kazakhstan',
    regulator: 'AFSA (Astana Financial Services Authority)',
    url: BASE_URL,
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

    // Scrape each register type
    for (const registerType of REGISTER_TYPES) {
      try {
        const { entities, pagesScraped } = await fetchRegisterEntities(registerType, this.config.id);
        logger.info(this.config.id, `${registerType.label}: ${entities.length} entities from ${pagesScraped} page(s)`);
        allEntities.push(...entities);
      } catch (err) {
        const msg = `Failed to fetch ${registerType.label}: ${err instanceof Error ? err.message : String(err)}`;
        errors.push(msg);
        logger.error(this.config.id, msg);
      }
    }

    // Deduplicate by reference number (same firm may appear in DASP + FinTech)
    const seen = new Map<string, ParsedEntity>();
    for (const entity of allEntities) {
      const key = entity.licenseNumber;
      const existing = seen.get(key);
      if (!existing) {
        seen.set(key, entity);
      } else {
        // Merge license types for entities appearing in multiple registers
        if (existing.licenseType && entity.licenseType && !existing.licenseType.includes(entity.licenseType)) {
          existing.licenseType = `${existing.licenseType} + ${entity.licenseType}`;
        }
        // Merge activities
        if (entity.activities && entity.activities.length > 0) {
          const existingActivities = new Set(existing.activities ?? []);
          for (const act of entity.activities) {
            existingActivities.add(act);
          }
          existing.activities = [...existingActivities];
        }
        // Prefer Active status over others
        if (entity.status === 'Active' && existing.status !== 'Active') {
          existing.status = 'Active';
        }
      }
    }

    const deduplicated = [...seen.values()];
    const dupeCount = allEntities.length - deduplicated.length;
    if (dupeCount > 0) {
      const msg = `Deduplicated ${dupeCount} entities across register types`;
      warnings.push(msg);
      logger.info(this.config.id, msg);
    }

    // Log summary by register type
    const typeCounts: Record<string, number> = {};
    for (const e of deduplicated) {
      const type = e.licenseType ?? 'Unknown';
      typeCounts[type] = (typeCounts[type] ?? 0) + 1;
    }
    const summary = Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => `${type}: ${count}`)
      .join(', ');
    logger.info(this.config.id, `By type: ${summary}`);

    // Log status distribution
    const statusCounts: Record<string, number> = {};
    for (const e of deduplicated) {
      const status = e.status ?? 'Unknown';
      statusCounts[status] = (statusCounts[status] ?? 0) + 1;
    }
    const statusSummary = Object.entries(statusCounts)
      .map(([status, count]) => `${status}: ${count}`)
      .join(', ');
    logger.info(this.config.id, `By status: ${statusSummary}`);

    return {
      registryId: this.config.id,
      countryCode: 'KZ',
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

  const parser = new KzAfsaParser();
  const result = await parser.parse();

  console.log(`\n✅ ${result.entities.length} entities parsed in ${(result.durationMs / 1000).toFixed(1)}s`);
  if (result.warnings.length > 0) {
    console.log(`⚠️  Warnings: ${result.warnings.join('; ')}`);
  }
  if (result.errors.length > 0) {
    console.log(`❌ Errors: ${result.errors.join('; ')}`);
  }
  console.log('');
  for (const e of result.entities.slice(0, 15)) {
    console.log(`  [${e.status}] ${e.name} | ${e.licenseType} | ${e.licenseNumber}`);
  }
  if (result.entities.length > 15) {
    console.log(`  ... and ${result.entities.length - 15} more`);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
