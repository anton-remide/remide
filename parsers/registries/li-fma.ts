/**
 * Liechtenstein FMA — TVTG (Blockchain Act) Registered Entities
 *
 * Source: FMA Liechtenstein Public Register
 * API: https://ws-api.llv.li/fire-wsapi/api/v1/search
 * ~25 active TT Service Providers (Token & TT Service Providers)
 * Format: JSON REST API (public, no auth)
 *
 * The TVTG (Token and TT Service Provider Act / Blockchain Act) is
 * Liechtenstein's comprehensive blockchain regulation framework.
 * Entities include exchanges, custodians, token issuers, etc.
 *
 * Usage:
 *   npx tsx parsers/registries/li-fma.ts --dry-run
 *   npx tsx parsers/registries/li-fma.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import type { RegistryParser, ParserConfig, ParseResult, ParsedEntity } from '../core/types.js';
import { fetchJsonWithRetry } from '../core/client.js';
import { logger } from '../core/logger.js';

const API_BASE = 'https://ws-api.llv.li/fire-wsapi/api/v1';

/** TVTG law ID in FMA register */
const TVTG_LAW_ID = 16;

/** Category ID → English label mapping for TVTG registration types */
const CATEGORY_LABELS: Record<number, string> = {
  78: 'Token Issuer (Art. 12(2))',
  79: 'Token Generator',
  80: 'TT Key Depositary',
  81: 'TT Token Depositary',
  82: 'TT Protector',
  83: 'Physical Validator',
  84: 'TT Exchange Service Provider',
  85: 'TT Verifying Authority',
  86: 'TT Price Service Provider',
  87: 'TT Identity Service Provider',
  98: 'Token Issuer (Art. 12(1))',
  99: 'TT-Agent',
  126: 'Tokenisation Service Provider',
  127: 'TT Depositary',
  128: 'Token Lending Undertaking',
  129: 'TT Trading Platform Operator',
  130: 'TT Crypto-Asset Manager',
  131: 'TT Transfer Service Provider',
};

/** FMA API entity structure */
interface FmaEntity {
  id: number;
  crmId: number;
  externalId: string;
  type: string;
  description: string; // This is the entity name
  address: string;
  lei?: string;
  tradenumber?: string;
  phone?: string;
  email?: string;
  website?: string;
  firstName?: string | null;
  lastName?: string | null;
  title?: string | null;
  grants: FmaGrant[];
  categoryAddress?: unknown[];
}

interface FmaGrant {
  category: { fmaCategoryId: number; descriptionEnglish?: string; descriptionGerman?: string };
  law: { descriptionEnglish?: string; descriptionGerman?: string };
  grantType: { descriptionEnglish?: string };
  status: number;
  registered?: string;
  expired?: string | null;
  revoked?: string | null;
  returned?: string | null;
  registrationDetailsEn?: string | null;
  registrationRemarksEn?: string | null;
}

interface FmaSearchResponse {
  data: FmaEntity[];
  page: number;
  maxPage: number;
  maxResults: number;
}

/** Fetch all TVTG entities from FMA API (paginated, 15 per page) */
async function fetchAllTvtgEntities(registryId: string): Promise<{ entities: FmaEntity[]; totalCount: number }> {
  const allEntities: FmaEntity[] = [];
  let page = 0;
  let maxPage = 0;

  do {
    const url = `${API_BASE}/search?query=&registerNumber=&category=&searchType=active&law=${TVTG_LAW_ID}&sortColumn=name&ascending=true&page=${page}`;
    logger.info(registryId, `Fetching page ${page}...`);

    const response = await fetchJsonWithRetry<FmaSearchResponse>(url, { registryId, rateLimit: 2_000 });
    allEntities.push(...response.data);
    maxPage = response.maxPage;

    logger.info(registryId, `Page ${page}: ${response.data.length} entities (total: ${response.maxResults})`);
    page++;
  } while (page <= maxPage);

  return { entities: allEntities, totalCount: allEntities.length };
}

/** Convert FMA entity to ParsedEntity */
function mapEntity(raw: FmaEntity): ParsedEntity {
  // Get TVTG grants
  const tvtgGrants = raw.grants.filter(
    (g) => g.category && CATEGORY_LABELS[g.category.fmaCategoryId],
  );

  const licenseTypes = tvtgGrants.map(
    (g) => CATEGORY_LABELS[g.category.fmaCategoryId] ?? g.category.descriptionEnglish ?? 'Unknown',
  );

  // Build license number from trade number or FMA ID
  const licenseNumber = raw.tradenumber ?? `FMA-${raw.id}`;

  return {
    name: raw.description,
    countryCode: 'LI',
    country: 'Liechtenstein',
    licenseNumber,
    licenseType: licenseTypes.length > 1
      ? `TVTG: ${licenseTypes.join(', ')}`
      : `TVTG: ${licenseTypes[0] ?? 'Registered'}`,
    status: 'Active',
    website: raw.website || undefined,
    regulator: 'FMA (Financial Market Authority)',
    sourceUrl: `https://register.fma-li.li/search?searchText=${encodeURIComponent(raw.description)}&law=${TVTG_LAW_ID}&searchType=active`,
  };
}

export class LiFmaParser implements RegistryParser {
  config: ParserConfig = {
    id: 'li-fma',
    name: 'Liechtenstein FMA TVTG Register',
    countryCode: 'LI',
    country: 'Liechtenstein',
    regulator: 'FMA (Financial Market Authority)',
    url: 'https://register.fma-li.li/search',
    sourceType: 'api',
    rateLimit: 2_000,
    needsProxy: false,
    needsBrowser: false,
  };

  async parse(): Promise<ParseResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const errors: string[] = [];

    logger.info(this.config.id, 'Fetching TVTG entities from FMA API...');

    const { entities: rawEntities, totalCount } = await fetchAllTvtgEntities(this.config.id);

    logger.info(this.config.id, `Fetched ${totalCount} active TVTG entities`);

    const entities: ParsedEntity[] = rawEntities.map(mapEntity);

    // Log category distribution
    const catCounts: Record<string, number> = {};
    for (const raw of rawEntities) {
      for (const g of raw.grants) {
        const label = CATEGORY_LABELS[g.category.fmaCategoryId] ?? 'Unknown';
        catCounts[label] = (catCounts[label] ?? 0) + 1;
      }
    }
    const catSummary = Object.entries(catCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, n]) => `${cat}: ${n}`)
      .join(', ');
    logger.info(this.config.id, `Grant types: ${catSummary}`);

    return {
      registryId: this.config.id,
      countryCode: 'LI',
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

  const parser = new LiFmaParser();
  const result = await parser.parse();

  console.log(`\n✅ ${result.entities.length} entities parsed in ${(result.durationMs / 1000).toFixed(1)}s`);
  for (const e of result.entities.slice(0, 10)) {
    console.log(`  ${e.name} | ${e.licenseType} | ${e.status}`);
  }
  if (result.entities.length > 10) {
    console.log(`  ... and ${result.entities.length - 10} more`);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
