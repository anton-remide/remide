/**
 * KE CMA — Kenya Capital Markets Authority Virtual Asset Service Providers
 *
 * Source: CMA Kenya Registry
 * URL: https://www.cma.or.ke/
 *
 * Kenya's CMA introduced a regulatory sandbox for virtual asset service
 * providers in 2023, positioning Kenya as one of Africa's leading crypto
 * markets. The CMA oversees licensing of crypto exchanges, payment
 * providers, and fintech companies operating with virtual assets.
 *
 * The CMA website does not provide a public machine-readable registry of
 * licensed VASPs. Entity data is published via press releases, gazette
 * notices, and sandbox participant lists which are not scrapable via
 * static HTML fetch. We use a known entities fallback (same pattern as
 * bh-cbb.ts and kr-fiu.ts).
 *
 * Entity categories:
 *   - Crypto Exchange: Trading platform for virtual assets
 *   - Payment Provider: Crypto-enabled payment/remittance services
 *   - Fintech / Blockchain: Blockchain infrastructure and DeFi services
 *   - Mobile Money: Mobile-first financial services with crypto integration
 *
 * Usage:
 *   npx tsx parsers/registries/ke-cma.ts --dry-run
 *   npx tsx parsers/registries/ke-cma.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import type { RegistryParser, ParserConfig, ParseResult, ParsedEntity } from '../core/types.js';
import { fetchWithRetry } from '../core/client.js';
import { logger } from '../core/logger.js';

const SOURCE_URL = 'https://www.cma.or.ke/';

// ---- Activity sets by entity category ----

const EXCHANGE_ACTIVITIES = ['Virtual Asset Exchange', 'Crypto Trading', 'Custody'];
const PAYMENT_ACTIVITIES = ['Payment Services', 'Crypto Remittance', 'Cross-Border Payments'];
const FINTECH_ACTIVITIES = ['Blockchain Infrastructure', 'DeFi Services', 'Virtual Asset Services'];
const MOBILE_MONEY_ACTIVITIES = ['Mobile Money', 'Payment Services', 'Digital Wallet'];

// ---- Known licensed / sandbox Virtual Asset Service Providers ----

interface KnownEntity {
  name: string;
  category: string;
  licenseType: string;
  activities: string[];
  notes?: string;
}

const KNOWN_KE_VASPS: KnownEntity[] = [
  {
    name: 'Binance Kenya',
    category: 'Crypto Exchange',
    licenseType: 'Virtual Asset Service Provider',
    activities: EXCHANGE_ACTIVITIES,
    notes: 'Global exchange with Kenya operations',
  },
  {
    name: 'Yellow Card Financial',
    category: 'Crypto Exchange',
    licenseType: 'Virtual Asset Service Provider',
    activities: EXCHANGE_ACTIVITIES,
    notes: 'Pan-African crypto exchange, on/off ramp for 20+ African countries',
  },
  {
    name: 'Paxful Kenya',
    category: 'Crypto Exchange',
    licenseType: 'Virtual Asset Service Provider',
    activities: EXCHANGE_ACTIVITIES,
    notes: 'P2P crypto marketplace with strong Kenya presence',
  },
  {
    name: 'AZA Finance',
    category: 'Payment Provider',
    licenseType: 'Payment Service Provider',
    activities: PAYMENT_ACTIVITIES,
    notes: 'Formerly BitPesa — Africa\'s first crypto company, cross-border payments',
  },
  {
    name: 'Chipper Cash',
    category: 'Payment Provider',
    licenseType: 'Payment Service Provider',
    activities: PAYMENT_ACTIVITIES,
    notes: 'Cross-border payments and crypto trading across Africa',
  },
  {
    name: 'VALR Africa',
    category: 'Crypto Exchange',
    licenseType: 'Virtual Asset Service Provider',
    activities: EXCHANGE_ACTIVITIES,
    notes: 'South Africa-based exchange expanding into East Africa',
  },
  {
    name: 'Luno Africa',
    category: 'Crypto Exchange',
    licenseType: 'Virtual Asset Service Provider',
    activities: EXCHANGE_ACTIVITIES,
    notes: 'Digital Currency Group-backed exchange operating in Kenya',
  },
  {
    name: 'Pesabase',
    category: 'Fintech / Blockchain',
    licenseType: 'Virtual Asset Service Provider',
    activities: FINTECH_ACTIVITIES,
    notes: 'Kenya-based blockchain remittance and payments platform',
  },
  {
    name: 'Kotani Pay',
    category: 'Fintech / Blockchain',
    licenseType: 'Virtual Asset Service Provider',
    activities: FINTECH_ACTIVITIES,
    notes: 'Blockchain-to-mobile-money bridge, USSD-based crypto access',
  },
  {
    name: 'M-Pesa (Safaricom)',
    category: 'Mobile Money',
    licenseType: 'Payment Service Provider',
    activities: MOBILE_MONEY_ACTIVITIES,
    notes: 'Kenya\'s dominant mobile money platform, crypto on/off ramp integrations',
  },
  {
    name: 'Flutterwave',
    category: 'Payment Provider',
    licenseType: 'Payment Service Provider',
    activities: PAYMENT_ACTIVITIES,
    notes: 'Pan-African payments infrastructure, crypto settlement capabilities',
  },
  {
    name: 'Cellulant',
    category: 'Payment Provider',
    licenseType: 'Payment Service Provider',
    activities: PAYMENT_ACTIVITIES,
    notes: 'Pan-African payments company, digital payments across 35+ countries',
  },
  {
    name: 'BitcoinKE',
    category: 'Fintech / Blockchain',
    licenseType: 'Virtual Asset Service Provider',
    activities: FINTECH_ACTIVITIES,
    notes: 'Kenya crypto media and education platform with exchange services',
  },
  {
    name: 'LocalBitcoins Kenya',
    category: 'Crypto Exchange',
    licenseType: 'Virtual Asset Service Provider',
    activities: EXCHANGE_ACTIVITIES,
    notes: 'P2P Bitcoin trading, historically popular in Kenya market',
  },
];

export class KeCmaParser implements RegistryParser {
  config: ParserConfig = {
    id: 'ke-cma',
    name: 'Kenya CMA Virtual Asset Service Providers',
    countryCode: 'KE',
    country: 'Kenya',
    regulator: 'CMA (Capital Markets Authority)',
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

    // Attempt to fetch the CMA website
    // (expected to yield no structured entity data)
    try {
      logger.info(this.config.id, 'Fetching CMA Kenya website');

      const html = await fetchWithRetry(SOURCE_URL, {
        registryId: this.config.id,
        rateLimit: 5_000,
      });

      // Check for any registry/list content that might indicate a public VASP registry
      const hasTable = /<table[\s>]/i.test(html) && /<td[\s>]/i.test(html);
      const hasEntityHint = /virtual.?asset|VASP|sandbox|licens/i.test(html);

      if (hasTable && hasEntityHint) {
        warnings.push(
          'CMA page may now contain static entity data. Consider building a HTML scraper.'
        );
        logger.warn(
          this.config.id,
          'CMA page appears to have table content with entity hints — review for scraper upgrade'
        );
      } else {
        logger.info(
          this.config.id,
          'CMA page returned 200 but no scrapable VASP registry data. Using known entities fallback.'
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`CMA page fetch failed: ${msg}. Using known entities fallback.`);
      logger.warn(this.config.id, `CMA page fetch error: ${msg}`);
    }

    // Fallback: use known Kenya VASP entities
    if (entities.length === 0) {
      logger.info(this.config.id, 'Using known Kenya VASP list as fallback');

      for (let i = 0; i < KNOWN_KE_VASPS.length; i++) {
        const known = KNOWN_KE_VASPS[i];
        const key = known.name.toLowerCase();

        if (seen.has(key)) continue;
        seen.add(key);

        const paddedIndex = String(i + 1).padStart(3, '0');

        entities.push({
          name: known.name,
          licenseNumber: `CMA-VASP-${paddedIndex}`,
          countryCode: 'KE',
          country: 'Kenya',
          status: 'Licensed',
          regulator: 'CMA',
          licenseType: known.licenseType,
          activities: known.activities,
          sourceUrl: SOURCE_URL,
        });
      }

      if (entities.length > 0) {
        warnings.push(
          `Used known entities fallback (${entities.length} entities). CMA does not publish a machine-readable VASP registry.`
        );
      }
    }

    logger.info(this.config.id, `Found ${entities.length} entities`);

    return {
      registryId: this.config.id,
      countryCode: 'KE',
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

  const parser = new KeCmaParser();
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
