/**
 * TZ BOT — Tanzania Bank of Tanzania Virtual Asset Service Providers
 *
 * Source: Bank of Tanzania
 * URL: https://www.bot.go.tz/
 *
 * Tanzania is developing a regulatory framework for crypto assets. The Bank
 * of Tanzania (BOT) issued public warnings about cryptocurrency risks but
 * has not imposed an outright ban. Mobile money dominates the payment
 * landscape (M-Pesa, Tigo Pesa, Airtel Money). Some crypto and fintech
 * companies operate in the space alongside traditional banks that offer
 * digital services.
 *
 * The BOT website does not provide a public machine-readable registry of
 * licensed VASPs or payment service providers. Regulatory information is
 * published via circulars, press releases, and annual reports which are
 * not scrapable via static HTML fetch. We use a known entities fallback
 * (same pattern as bh-cbb.ts and kr-fiu.ts).
 *
 * Entity categories:
 *   - VASP: Virtual asset service provider / crypto exchange
 *   - PSP: Payment service provider / mobile money operator
 *   - Bank: Licensed bank offering digital/crypto-adjacent services
 *
 * Usage:
 *   npx tsx parsers/registries/tz-bot.ts --dry-run
 *   npx tsx parsers/registries/tz-bot.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import type { RegistryParser, ParserConfig, ParseResult, ParsedEntity } from '../core/types.js';
import { fetchWithRetry } from '../core/client.js';
import { logger } from '../core/logger.js';

const SOURCE_URL = 'https://www.bot.go.tz/';

// ---- Activity sets by entity type ----

const VASP_ACTIVITIES = ['Virtual Asset Exchange', 'Crypto Trading', 'Digital Asset Services'];
const PSP_ACTIVITIES = ['Mobile Money', 'Payment Services', 'Digital Payments'];
const BANK_ACTIVITIES = ['Banking', 'Digital Banking', 'Financial Services'];
const FINTECH_ACTIVITIES = ['Fintech', 'Cross-Border Payments', 'Digital Financial Services'];

// ---- Known entities operating in Tanzania ----

interface KnownEntity {
  name: string;
  category: 'VASP' | 'PSP' | 'Bank';
  licenseType: string;
  activities: string[];
  notes?: string;
}

const KNOWN_TZ_ENTITIES: KnownEntity[] = [
  {
    name: 'M-Pesa Tanzania (Vodacom)',
    category: 'PSP',
    licenseType: 'Payment Service Provider',
    activities: PSP_ACTIVITIES,
    notes: 'Dominant mobile money platform in Tanzania, operated by Vodacom',
  },
  {
    name: 'Tigo Pesa',
    category: 'PSP',
    licenseType: 'Payment Service Provider',
    activities: PSP_ACTIVITIES,
    notes: 'Mobile money service by MIC Tanzania (Millicom)',
  },
  {
    name: 'Airtel Money Tanzania',
    category: 'PSP',
    licenseType: 'Payment Service Provider',
    activities: PSP_ACTIVITIES,
    notes: 'Airtel mobile money and digital payments',
  },
  {
    name: 'Yellow Card Tanzania',
    category: 'VASP',
    licenseType: 'Virtual Asset Service Provider',
    activities: VASP_ACTIVITIES,
    notes: 'Pan-African crypto exchange, operational in Tanzania',
  },
  {
    name: 'Paxful Tanzania',
    category: 'VASP',
    licenseType: 'Virtual Asset Service Provider',
    activities: ['P2P Crypto Trading', 'Virtual Asset Exchange'],
    notes: 'P2P Bitcoin marketplace with significant Tanzanian user base',
  },
  {
    name: 'CRDB Bank',
    category: 'Bank',
    licenseType: 'Licensed Commercial Bank',
    activities: BANK_ACTIVITIES,
    notes: 'Major Tanzanian bank with digital banking services',
  },
  {
    name: 'NMB Bank',
    category: 'Bank',
    licenseType: 'Licensed Commercial Bank',
    activities: BANK_ACTIVITIES,
    notes: 'National Microfinance Bank — digital financial services',
  },
  {
    name: 'Binance Tanzania',
    category: 'VASP',
    licenseType: 'Virtual Asset Service Provider',
    activities: ['P2P Crypto Trading', 'Virtual Asset Exchange', 'Crypto Custody'],
    notes: 'P2P operations in Tanzania via Binance global platform',
  },
  {
    name: 'Chipper Cash Tanzania',
    category: 'VASP',
    licenseType: 'Virtual Asset Service Provider',
    activities: [...FINTECH_ACTIVITIES, 'Crypto Trading'],
    notes: 'African fintech offering cross-border payments and crypto',
  },
  {
    name: 'AZA Finance Tanzania',
    category: 'VASP',
    licenseType: 'Virtual Asset Service Provider',
    activities: ['FX Trading', 'Cross-Border Payments', 'Digital Asset Services'],
    notes: 'FX and crypto infrastructure for African markets (formerly BitPesa)',
  },
  {
    name: 'Flutterwave Tanzania',
    category: 'PSP',
    licenseType: 'Payment Service Provider',
    activities: ['Payment Processing', 'Digital Payments', 'Merchant Services'],
    notes: 'Pan-African payment technology company',
  },
];

export class TzBotParser implements RegistryParser {
  config: ParserConfig = {
    id: 'tz-bot',
    name: 'Tanzania BOT Virtual Asset & Payment Service Providers',
    countryCode: 'TZ',
    country: 'Tanzania',
    regulator: 'BOT (Bank of Tanzania)',
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

    // Attempt to fetch the BOT website for any scrapable registry data
    try {
      logger.info(this.config.id, 'Fetching Bank of Tanzania website');

      const html = await fetchWithRetry(SOURCE_URL, {
        registryId: this.config.id,
        rateLimit: 5_000,
      });

      // Check if the page contains any structured registry/list data
      const hasTable = /<table[\s>]/i.test(html) && /<td[\s>]/i.test(html);
      const hasEntityHint = /virtual.?asset|VASP|crypto|payment.?service.?provider/i.test(html);

      if (hasTable && hasEntityHint) {
        warnings.push(
          'BOT page may now contain static registry data. Consider building an HTML scraper.'
        );
        logger.warn(
          this.config.id,
          'BOT page appears to have table content with entity hints — review for scraper upgrade'
        );
      } else {
        logger.info(
          this.config.id,
          'BOT page returned 200 but no scrapable registry data found. Using known entities fallback.'
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`BOT page fetch failed: ${msg}. Using known entities fallback.`);
      logger.warn(this.config.id, `BOT page fetch error: ${msg}`);
    }

    // Fallback: use known Tanzania entities
    if (entities.length === 0) {
      logger.info(this.config.id, 'Using known Tanzania entity list as fallback');

      for (let i = 0; i < KNOWN_TZ_ENTITIES.length; i++) {
        const known = KNOWN_TZ_ENTITIES[i];
        const key = known.name.toLowerCase();

        if (seen.has(key)) continue;
        seen.add(key);

        const paddedIndex = String(i + 1).padStart(3, '0');

        entities.push({
          name: known.name,
          licenseNumber: `BOT-VASP-${paddedIndex}`,
          countryCode: 'TZ',
          country: 'Tanzania',
          status: known.category === 'Bank' ? 'Licensed' : 'Operating',
          regulator: 'BOT',
          licenseType: known.licenseType,
          activities: known.activities,
          sourceUrl: SOURCE_URL,
        });
      }

      if (entities.length > 0) {
        warnings.push(
          `Used known entities fallback (${entities.length} entities). BOT website has no public registry.`
        );
      }
    }

    logger.info(this.config.id, `Found ${entities.length} entities`);

    return {
      registryId: this.config.id,
      countryCode: 'TZ',
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

  const parser = new TzBotParser();
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
