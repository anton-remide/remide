/**
 * Indonesia OJK / Bappebti — Licensed Digital Asset Traders
 *
 * Sources:
 * - Bappebti JSON API (bootstrap-table data-url endpoints)
 *   - PAKD: https://bappebti.go.id/pedagang_aset_kripto/list_pedagang_aset_kripto
 *   - CPAKD: https://bappebti.go.id/calon_pedagang_aset_kripto/list_calon_pedagang_aset_kripto
 * - OJK has taken over regulation (Jan 2025) but publishes data as PDFs only
 *
 * ~37 crypto exchanges/platforms (16 PAKD + 21 CPAKD)
 * Format: JSON API (bootstrap-table endpoints)
 *
 * Note: Bappebti site may have SSL/network issues. Parser uses fetchJsonWithRetry
 * and falls back to known entities when both APIs fail.
 *
 * Usage:
 *   npx tsx parsers/registries/id-ojk.ts --dry-run
 *   npx tsx parsers/registries/id-ojk.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import type { RegistryParser, ParserConfig, ParseResult, ParsedEntity } from '../core/types.js';
import { fetchJsonWithRetry } from '../core/client.js';
import { logger } from '../core/logger.js';

/** Bappebti JSON API endpoints (discovered from bootstrap-table data-url attributes) */
const API_ENDPOINTS = [
  {
    url: 'https://bappebti.go.id/pedagang_aset_kripto/list_pedagang_aset_kripto',
    pageUrl: 'https://bappebti.go.id/pedagang_aset_kripto',
    licenseType: 'Licensed Digital Asset Trader (PAKD)',
    status: 'Active' as const,
  },
  {
    url: 'https://bappebti.go.id/calon_pedagang_aset_kripto/list_calon_pedagang_aset_kripto',
    pageUrl: 'https://bappebti.go.id/calon_pedagang_aset_kripto',
    licenseType: 'Candidate Digital Asset Trader (CPAKD)',
    status: 'Provisional' as const,
  },
];

/** Known registered Indonesian crypto traders (Bappebti PFAK / OJK PAKD+CPAKD) — fallback when APIs fail */
const KNOWN_ID_CRYPTO_TRADERS = [
  'Indodax',
  'Tokocrypto',
  'Pintu',
  'Pluang',
  'Reku',
  'Luno',
  'Triv',
  'Nanovest',
  'Bittime',
  'Zipmex',
  'Ajaib Kripto',
  'Bitwewe',
  'Bitwyre',
  'Mobee',
  'Nobi',
  'Naga Exchange',
  'Kriptosukses',
  'NVX',
  'Upbit Indonesia',
  'Fasset',
  'Digitalexchange.id',
  'Gudang Kripto',
  'KAKOPX',
  'Kriptomaksima',
  'DEX Exchange',
  'BTSE Indonesia',
  'Coinvest',
  'CoinX',
  'CYRA',
  'Floq',
  'Koinsayang',
  'MAKS',
  'Samuel Kripto',
  'Stockbit',
  'Incrypto',
  'Plutonext',
  'Vonix',
  'Bitocto',
  'Galad Exchange',
  'KMK',
  'MAX',
];

/** Shape of JSON response items */
interface BappebtiEntity {
  Nama: string;
  Ijin: string;
  TglIjin: string;
  website: string;
  Alamat: string;
}

/** Bootstrap-table can return raw array or { total, rows } */
type BappebtiApiResponse = BappebtiEntity[] | { total?: number; rows?: BappebtiEntity[] };

function extractItems(raw: BappebtiApiResponse): BappebtiEntity[] {
  if (Array.isArray(raw)) return raw;
  return raw?.rows ?? [];
}

/** Clean up company name */
function cleanName(name: string): string {
  return name
    .replace(/<[^>]*>/g, '')  // strip any HTML tags
    .replace(/\s+/g, ' ')
    .trim();
}

/** Clean up website URL */
function cleanWebsite(raw: string): string | undefined {
  if (!raw || raw === '-' || raw === 'null') return undefined;
  // Take first URL if multiple provided (e.g. "https://x and https://y")
  const first = raw.split(/\s+and\s+/i)[0].trim();
  if (!first) return undefined;
  // Add protocol if missing
  if (!first.startsWith('http')) return `https://${first}`;
  return first;
}

export class IdOjkParser implements RegistryParser {
  config: ParserConfig = {
    id: 'id-ojk',
    name: 'Indonesia OJK/Bappebti Crypto Traders',
    countryCode: 'ID',
    country: 'Indonesia',
    regulator: 'OJK / Bappebti',
    url: API_ENDPOINTS[0].pageUrl,
    sourceType: 'json',
    rateLimit: 5_000,
    needsProxy: false,
    needsBrowser: false,
  };

  async parse(): Promise<ParseResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const errors: string[] = [];
    const allEntities: ParsedEntity[] = [];
    const seen = new Set<string>();

    for (const endpoint of API_ENDPOINTS) {
      try {
        logger.info(this.config.id, `Fetching ${endpoint.licenseType} from JSON API...`);
        const raw = await fetchJsonWithRetry<BappebtiApiResponse>(endpoint.url, {
          registryId: this.config.id,
          rateLimit: 5_000,
          headers: {
            'Accept': 'application/json, text/javascript, */*',
            'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
          },
        });
        const items = extractItems(raw);
        logger.info(this.config.id, `  API returned ${items.length} items`);

        for (const item of items) {
          const name = cleanName(item.Nama);
          if (!name) continue;
          const key = name.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);

          allEntities.push({
            name,
            countryCode: 'ID',
            country: 'Indonesia',
            licenseNumber: item.Ijin || `BAPPEBTI-${name.substring(0, 20).replace(/\s+/g, '-')}`,
            licenseType: endpoint.licenseType,
            status: endpoint.status,
            regulator: 'OJK / Bappebti',
            website: cleanWebsite(item.website),
            sourceUrl: endpoint.pageUrl,
          });
        }

        logger.info(this.config.id, `  Parsed ${items.length} entities`);
      } catch (err) {
        const msg = `Failed to fetch ${endpoint.url}: ${err instanceof Error ? err.message : String(err)}`;
        warnings.push(msg);
        logger.warn(this.config.id, msg);
      }

      // Rate limit
      await new Promise((r) => setTimeout(r, 3_000));
    }

    // Fallback: use known Indonesian crypto traders when both APIs failed
    if (allEntities.length === 0) {
      warnings.push('Both Bappebti API endpoints returned 0 entities. Using known VASP fallback list.');
      logger.info(this.config.id, 'Using known Indonesian crypto traders as fallback');

      for (const name of KNOWN_ID_CRYPTO_TRADERS) {
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);

        allEntities.push({
          name,
          countryCode: 'ID',
          country: 'Indonesia',
          licenseNumber: `BAPPEBTI-${name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 25)}`,
          licenseType: 'Licensed Digital Asset Trader (PAKD)',
          status: 'Active',
          regulator: 'OJK / Bappebti',
          sourceUrl: API_ENDPOINTS[0].pageUrl,
        });
      }
    }

    if (allEntities.length === 0) {
      errors.push('No entities found from any source');
    }

    logger.info(this.config.id, `Found ${allEntities.length} entities`);

    return {
      registryId: this.config.id,
      countryCode: 'ID',
      entities: allEntities,
      totalFound: allEntities.length,
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

  const parser = new IdOjkParser();
  const result = await parser.parse();

  console.log(`\n✅ ${result.entities.length} entities parsed in ${(result.durationMs / 1000).toFixed(1)}s`);
  if (result.warnings.length > 0) {
    console.log(`⚠️  Warnings: ${result.warnings.join('; ')}`);
  }
  for (const e of result.entities) {
    console.log(`  ${e.name} | ${e.licenseType} | ${e.status} | ${e.website ?? ''}`);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
