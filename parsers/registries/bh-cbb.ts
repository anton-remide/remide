/**
 * BH CBB — Bahrain Central Bank of Bahrain Crypto-Asset Service Providers
 *
 * Source: CBB Licensing Directory
 * URL: https://www.cbb.gov.bh/licensing-directory/
 *
 * The CBB licensing directory uses JavaScript-rendered dropdowns that are
 * not scrapable without a headless browser. There are only ~9 licensed
 * crypto-asset service providers in Bahrain, so we use a known entities
 * fallback approach (same pattern as kr-fiu.ts).
 *
 * CBB Crypto-Asset Module Categories:
 *   Category 1: Investment advisory only
 *   Category 2: Trading as agent, portfolio management, custody, advisory
 *   Category 3: Trading as agent + principal, portfolio management, custody, advisory
 *   Category 4: Operating a crypto-asset exchange
 *
 * Bahrain was one of the first GCC/MENA countries to regulate crypto
 * (Rain Management received the first crypto license in ~2019).
 *
 * Note: The CBB website returns HTTP 200 but the directory content requires
 * JS rendering (WordPress + dynamic dropdowns). Static HTML fetch yields no
 * entity data, hence the known entities fallback.
 *
 * Usage:
 *   npx tsx parsers/registries/bh-cbb.ts --dry-run
 *   npx tsx parsers/registries/bh-cbb.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import type { RegistryParser, ParserConfig, ParseResult, ParsedEntity } from '../core/types.js';
import { fetchWithRetry } from '../core/client.js';
import { logger } from '../core/logger.js';

const SOURCE_URL = 'https://www.cbb.gov.bh/licensing-directory/';

// ---- Activity sets by CBB Category ----

const CATEGORY_1_ACTIVITIES = ['Advisory'];
const CATEGORY_2_ACTIVITIES = ['Crypto Asset Trading (Agent)', 'Portfolio Management', 'Crypto Custody', 'Advisory'];
const CATEGORY_3_ACTIVITIES = ['Crypto Asset Trading', 'Crypto Custody', 'Portfolio Management', 'Advisory'];
const CATEGORY_4_ACTIVITIES = ['Crypto-Asset Exchange Operation'];
const PSP_ACTIVITIES = ['Payment Services', 'Crypto Payment Processing'];

// ---- Known licensed Crypto-Asset Service Providers ----

interface KnownEntity {
  name: string;
  category: string;          // 'Category 1' | 'Category 2' | 'Category 3' | 'Category 4' | 'PSP'
  licenseType: string;
  activities: string[];
  notes?: string;
}

const KNOWN_BH_CASPS: KnownEntity[] = [
  {
    name: 'Rain Management W.L.L.',
    category: 'Category 3',
    licenseType: 'Crypto-Asset Services - Category 3',
    activities: CATEGORY_3_ACTIVITIES,
    notes: 'First crypto license in Bahrain (~2019)',
  },
  {
    name: 'Binance Bahrain B.S.C.(c)',
    category: 'Category 4',
    licenseType: 'Crypto-Asset Services - Category 4',
    activities: CATEGORY_4_ACTIVITIES,
    notes: 'Licensed March 2022',
  },
  {
    name: 'CoinMENA B.S.C.(c)',
    category: 'Category 3',
    licenseType: 'Crypto-Asset Services - Category 3',
    activities: CATEGORY_3_ACTIVITIES,
    notes: 'Sharia-compliant crypto exchange',
  },
  {
    name: 'ARP Digital Bahrain W.L.L.',
    category: 'Category 3',
    licenseType: 'Crypto-Asset Services - Category 3',
    activities: CATEGORY_3_ACTIVITIES,
    notes: 'Crypto trading, custody, portfolio management',
  },
  {
    name: 'BitOasis Technologies FZ-LLC',
    category: 'Category 2',
    licenseType: 'Crypto-Asset Services - Category 2',
    activities: CATEGORY_2_ACTIVITIES,
    notes: 'MENA-focused crypto broker',
  },
  {
    name: 'Crypto.com',
    category: 'PSP',
    licenseType: 'Payment Service Provider',
    activities: PSP_ACTIVITIES,
    notes: 'Crypto payments, licensed September 2024',
  },
  {
    name: 'Fasset Financial Services W.L.L.',
    category: 'Category 3',
    licenseType: 'Crypto-Asset Services - Category 3',
    activities: CATEGORY_3_ACTIVITIES,
    notes: '8th crypto license, licensed January 2025',
  },
  {
    name: 'Waterfort Bahrain B.S.C.',
    category: 'Category 3',
    licenseType: 'Crypto-Asset Services - Category 3',
    activities: CATEGORY_3_ACTIVITIES,
    notes: 'Liquidity and execution services',
  },
  {
    name: 'Eazy Financial Services B.S.C.(c)',
    category: 'PSP',
    licenseType: 'Payment Service Provider',
    activities: PSP_ACTIVITIES,
    notes: 'EazyPay — crypto payment processing',
  },
];

export class BhCbbParser implements RegistryParser {
  config: ParserConfig = {
    id: 'bh-cbb',
    name: 'Bahrain CBB Crypto-Asset Service Providers',
    countryCode: 'BH',
    country: 'Bahrain',
    regulator: 'CBB (Central Bank of Bahrain)',
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
    const entities: ParsedEntity[] = [];
    const seen = new Set<string>();

    // Attempt to fetch the CBB licensing directory page
    // (expected to fail yielding 0 entities due to JS rendering)
    try {
      logger.info(this.config.id, 'Fetching CBB licensing directory page');

      const html = await fetchWithRetry(SOURCE_URL, {
        registryId: this.config.id,
        rateLimit: 5_000,
      });

      // The page requires JS rendering — the static HTML contains no entity data.
      // We check for any obvious table/list content just in case the page structure changes.
      const hasTable = /<table[\s>]/i.test(html) && /<td[\s>]/i.test(html);
      const hasEntityHint = /crypto.?asset|CASP|category\s*[1-4]/i.test(html);

      if (hasTable && hasEntityHint) {
        // If someday the page becomes static — log a note so we know to build a real scraper.
        warnings.push(
          'CBB page may now contain static entity data. Consider building a HTML scraper.'
        );
        logger.warn(
          this.config.id,
          'CBB page appears to have table content with entity hints — review for scraper upgrade'
        );
      } else {
        logger.info(
          this.config.id,
          'CBB page returned 200 but no scrapable entity data (JS-rendered). Using known entities fallback.'
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`CBB page fetch failed: ${msg}. Using known entities fallback.`);
      logger.warn(this.config.id, `CBB page fetch error: ${msg}`);
    }

    // Fallback: use known Bahrain crypto-licensed entities
    if (entities.length === 0) {
      logger.info(this.config.id, 'Using known Bahrain CASP list as fallback');

      for (let i = 0; i < KNOWN_BH_CASPS.length; i++) {
        const known = KNOWN_BH_CASPS[i];
        const key = known.name.toLowerCase();

        if (seen.has(key)) continue;
        seen.add(key);

        const paddedIndex = String(i + 1).padStart(3, '0');

        entities.push({
          name: known.name,
          licenseNumber: `CBB-CASP-${paddedIndex}`,
          countryCode: 'BH',
          country: 'Bahrain',
          status: 'Licensed',
          regulator: 'CBB',
          licenseType: known.licenseType,
          activities: known.activities,
          sourceUrl: SOURCE_URL,
        });
      }

      if (entities.length > 0) {
        warnings.push(
          `Used known entities fallback (${entities.length} entities). CBB directory requires JS rendering.`
        );
      }
    }

    logger.info(this.config.id, `Found ${entities.length} entities`);

    return {
      registryId: this.config.id,
      countryCode: 'BH',
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

  const parser = new BhCbbParser();
  const result = await parser.parse();

  console.log(`\n${result.entities.length} entities parsed in ${(result.durationMs / 1000).toFixed(1)}s`);
  if (result.warnings.length > 0) {
    console.log(`Warnings: ${result.warnings.join('; ')}`);
  }
  console.log('');
  for (const e of result.entities) {
    console.log(`  ${e.licenseNumber} | ${e.name} | ${e.licenseType} | ${e.status}`);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
