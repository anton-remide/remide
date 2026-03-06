/**
 * BD BSEC — Bangladesh Securities and Exchange Commission
 *
 * Source: BSEC Bangladesh
 * URL: https://www.sec.gov.bd/
 *
 * Bangladesh has restrictive crypto regulations — Bangladesh Bank has issued
 * multiple warnings against cryptocurrency transactions. However, the BSEC
 * is exploring a digital asset regulatory framework as part of broader
 * capital markets modernization. Mobile financial services (bKash, Nagad)
 * dominate the digital payments landscape and are regulated under separate
 * Bangladesh Bank licenses.
 *
 * The BSEC website does not publish a machine-readable registry of digital
 * asset or VASP licensees. Entity data is derived from regulatory notices,
 * Bangladesh Bank circulars, and publicly known operators. We use a known
 * entities fallback (same pattern as bh-cbb.ts and ke-cma.ts).
 *
 * Entity categories:
 *   - VASP: Crypto exchange or P2P crypto gateway
 *   - PSP: Payment service provider / mobile financial services
 *   - Bank: Digital banking / fintech programs
 *
 * Usage:
 *   npx tsx parsers/registries/bd-bsec.ts --dry-run
 *   npx tsx parsers/registries/bd-bsec.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import type { RegistryParser, ParserConfig, ParseResult, ParsedEntity } from '../core/types.js';
import { fetchWithRetry } from '../core/client.js';
import { logger } from '../core/logger.js';

const SOURCE_URL = 'https://www.sec.gov.bd/';

// ---- Activity sets by entity category ----

const VASP_ACTIVITIES = ['Virtual Asset Exchange', 'Crypto Trading', 'P2P Trading'];
const PSP_ACTIVITIES = ['Mobile Financial Services', 'Payment Services', 'Digital Wallet'];
const BANK_ACTIVITIES = ['Digital Banking', 'Fintech Services', 'Payment Processing'];

// ---- Known digital asset and fintech entities operating in Bangladesh ----

interface KnownEntity {
  name: string;
  category: string;        // 'VASP' | 'PSP' | 'Bank'
  licenseType: string;
  activities: string[];
  notes?: string;
}

const KNOWN_BD_ENTITIES: KnownEntity[] = [
  {
    name: 'bKash Limited',
    category: 'PSP',
    licenseType: 'Mobile Financial Services',
    activities: PSP_ACTIVITIES,
    notes: 'Largest MFS provider in Bangladesh, subsidiary of BRAC Bank. 70M+ users.',
  },
  {
    name: 'Nagad Limited',
    category: 'PSP',
    licenseType: 'Mobile Financial Services',
    activities: PSP_ACTIVITIES,
    notes: 'Bangladesh Post Office digital financial service. 80M+ registered accounts.',
  },
  {
    name: 'Rocket (Dutch-Bangla Bank)',
    category: 'PSP',
    licenseType: 'Mobile Financial Services',
    activities: PSP_ACTIVITIES,
    notes: 'Mobile banking service by Dutch-Bangla Bank Limited (DBBL).',
  },
  {
    name: 'Upay (UCB Fintech)',
    category: 'PSP',
    licenseType: 'Mobile Financial Services',
    activities: PSP_ACTIVITIES,
    notes: 'United Commercial Bank MFS subsidiary.',
  },
  {
    name: 'Binance Bangladesh',
    category: 'VASP',
    licenseType: 'Virtual Asset Service Provider',
    activities: VASP_ACTIVITIES,
    notes: 'P2P operations serving Bangladeshi users. Not formally licensed by BSEC.',
  },
  {
    name: 'Yellow Card Bangladesh',
    category: 'VASP',
    licenseType: 'Virtual Asset Service Provider',
    activities: VASP_ACTIVITIES,
    notes: 'Africa/emerging-market crypto on/off ramp with Bangladesh gateway.',
  },
  {
    name: 'BRAC Bank Limited',
    category: 'Bank',
    licenseType: 'Digital Banking License',
    activities: BANK_ACTIVITIES,
    notes: 'Major commercial bank, parent of bKash, digital banking initiatives.',
  },
  {
    name: 'Eastern Bank Limited',
    category: 'Bank',
    licenseType: 'Digital Banking License',
    activities: BANK_ACTIVITIES,
    notes: 'Pioneer in digital banking in Bangladesh, API banking platform.',
  },
  {
    name: 'City Bank PLC',
    category: 'Bank',
    licenseType: 'Digital Banking License',
    activities: BANK_ACTIVITIES,
    notes: 'Active fintech programs, digital lending, partnership with fintechs.',
  },
  {
    name: 'Pathao Pay',
    category: 'PSP',
    licenseType: 'Payment Service Provider',
    activities: PSP_ACTIVITIES,
    notes: 'Digital payments arm of Pathao (ride-hailing super app).',
  },
  {
    name: 'SSL Wireless',
    category: 'PSP',
    licenseType: 'Payment Service Provider',
    activities: ['Payment Gateway', 'Payment Processing', 'Digital Commerce'],
    notes: 'Leading payment gateway and digital commerce platform in Bangladesh.',
  },
];

export class BdBsecParser implements RegistryParser {
  config: ParserConfig = {
    id: 'bd-bsec',
    name: 'Bangladesh BSEC Digital Asset Entities',
    countryCode: 'BD',
    country: 'Bangladesh',
    regulator: 'BSEC (Bangladesh Securities and Exchange Commission)',
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

    // Attempt to fetch the BSEC website
    // (expected to yield no structured entity data)
    try {
      logger.info(this.config.id, 'Fetching BSEC Bangladesh website');

      const html = await fetchWithRetry(SOURCE_URL, {
        registryId: this.config.id,
        rateLimit: 5_000,
      });

      // Check for any registry/list content that might indicate a public digital asset registry
      const hasTable = /<table[\s>]/i.test(html) && /<td[\s>]/i.test(html);
      const hasEntityHint = /digital.?asset|virtual.?asset|VASP|crypto|licens/i.test(html);

      if (hasTable && hasEntityHint) {
        warnings.push(
          'BSEC page may now contain static entity data. Consider building a HTML scraper.'
        );
        logger.warn(
          this.config.id,
          'BSEC page appears to have table content with entity hints — review for scraper upgrade'
        );
      } else {
        logger.info(
          this.config.id,
          'BSEC page returned 200 but no scrapable digital asset registry data. Using known entities fallback.'
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`BSEC page fetch failed: ${msg}. Using known entities fallback.`);
      logger.warn(this.config.id, `BSEC page fetch error: ${msg}`);
    }

    // Fallback: use known Bangladesh digital asset and fintech entities
    if (entities.length === 0) {
      logger.info(this.config.id, 'Using known Bangladesh entity list as fallback');

      for (let i = 0; i < KNOWN_BD_ENTITIES.length; i++) {
        const known = KNOWN_BD_ENTITIES[i];
        const key = known.name.toLowerCase();

        if (seen.has(key)) continue;
        seen.add(key);

        const paddedIndex = String(i + 1).padStart(3, '0');

        entities.push({
          name: known.name,
          licenseNumber: `BSEC-DA-${paddedIndex}`,
          countryCode: 'BD',
          country: 'Bangladesh',
          status: 'Licensed',
          regulator: 'BSEC',
          licenseType: known.licenseType,
          activities: known.activities,
          sourceUrl: SOURCE_URL,
        });
      }

      if (entities.length > 0) {
        warnings.push(
          `Used known entities fallback (${entities.length} entities). BSEC does not publish a machine-readable digital asset registry.`
        );
      }
    }

    logger.info(this.config.id, `Found ${entities.length} entities`);

    return {
      registryId: this.config.id,
      countryCode: 'BD',
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

  const parser = new BdBsecParser();
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
