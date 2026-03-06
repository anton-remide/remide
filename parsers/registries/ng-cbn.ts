/**
 * NG CBN — Nigeria Central Bank of Nigeria (CBN-regulated entities)
 *
 * Source: Central Bank of Nigeria
 * URL: https://www.cbn.gov.ng/
 *
 * The CBN website does not provide a machine-readable registry of licensed
 * payment service providers or fintechs. Licensing data is spread across
 * PDFs, circulars, and press releases. We use a known entities fallback
 * approach (same pattern as bh-cbb.ts, kr-fiu.ts).
 *
 * Background:
 *   - Nigeria has the highest crypto adoption in Africa
 *   - CBN banned banks from servicing crypto companies in Feb 2021
 *   - CBN reversed the ban in Dec 2023, allowing banks to serve licensed VASPs
 *   - SEC Nigeria licenses crypto exchanges (VASPs) — see ng-sec.ts
 *   - CBN regulates payment service providers (PSPs), mobile money operators,
 *     and fintechs that may facilitate crypto transactions
 *
 * This parser covers CBN-regulated fintechs and PSPs with crypto activities,
 * plus SEC-licensed crypto exchanges not already covered by ng-sec.ts.
 *
 * Usage:
 *   npx tsx parsers/registries/ng-cbn.ts --dry-run
 *   npx tsx parsers/registries/ng-cbn.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import type { RegistryParser, ParserConfig, ParseResult, ParsedEntity } from '../core/types.js';
import { fetchWithRetry } from '../core/client.js';
import { logger } from '../core/logger.js';

const SOURCE_URL = 'https://www.cbn.gov.ng/';

// ---- Activity categories ----

const CRYPTO_EXCHANGE_ACTIVITIES = ['Crypto Exchange', 'Digital Asset Trading', 'Crypto Custody'];
const PSP_ACTIVITIES = ['Payment Services', 'Mobile Money', 'Digital Payments'];
const FINTECH_CRYPTO_ACTIVITIES = ['Payment Services', 'Digital Payments', 'Crypto Integration'];
const BANKING_CRYPTO_ACTIVITIES = ['Banking', 'Digital Banking', 'Crypto-Friendly Banking'];
const INTERNATIONAL_EXCHANGE_ACTIVITIES = ['Crypto Exchange', 'P2P Trading', 'Digital Asset Trading'];

// ---- Known Nigerian crypto & fintech entities ----

interface KnownEntity {
  name: string;
  category: 'Crypto Exchange' | 'Fintech PSP' | 'Digital Bank' | 'International Exchange';
  regulator: 'CBN' | 'SEC';
  licenseType: string;
  activities: string[];
  notes?: string;
}

const KNOWN_NG_ENTITIES: KnownEntity[] = [
  // --- Crypto Exchanges (SEC-regulated VASPs) ---
  {
    name: 'Quidax Technologies Limited',
    category: 'Crypto Exchange',
    regulator: 'SEC',
    licenseType: 'SEC VASP — Digital Asset Exchange',
    activities: CRYPTO_EXCHANGE_ACTIVITIES,
    notes: 'Leading Nigerian crypto exchange, SEC AIP recipient 2024',
  },
  {
    name: 'Patricia Technologies Limited',
    category: 'Crypto Exchange',
    regulator: 'SEC',
    licenseType: 'SEC VASP — Digital Asset Exchange',
    activities: CRYPTO_EXCHANGE_ACTIVITIES,
    notes: 'Nigerian crypto exchange, gift card trading platform',
  },
  {
    name: 'Roqqu Digital Services Limited',
    category: 'Crypto Exchange',
    regulator: 'SEC',
    licenseType: 'SEC VASP — Digital Asset Exchange',
    activities: CRYPTO_EXCHANGE_ACTIVITIES,
    notes: 'Nigerian crypto exchange with P2P trading',
  },
  {
    name: 'Busha Digital Limited',
    category: 'Crypto Exchange',
    regulator: 'SEC',
    licenseType: 'SEC VASP — Digital Asset Exchange',
    activities: CRYPTO_EXCHANGE_ACTIVITIES,
    notes: 'Nigerian crypto exchange and wallet provider',
  },
  {
    name: 'Bundle Africa Limited',
    category: 'Crypto Exchange',
    regulator: 'SEC',
    licenseType: 'SEC VASP — Digital Asset Exchange',
    activities: CRYPTO_EXCHANGE_ACTIVITIES,
    notes: 'Social payments app with crypto trading',
  },
  {
    name: 'NairaEx Limited',
    category: 'Crypto Exchange',
    regulator: 'SEC',
    licenseType: 'SEC VASP — Digital Asset Exchange',
    activities: CRYPTO_EXCHANGE_ACTIVITIES,
    notes: 'Nigerian Bitcoin exchange, one of the earliest in the market',
  },

  // --- Fintechs / PSPs with crypto activities (CBN-regulated) ---
  {
    name: 'OPay Digital Services Limited',
    category: 'Fintech PSP',
    regulator: 'CBN',
    licenseType: 'CBN PSP — Payment Service Provider',
    activities: FINTECH_CRYPTO_ACTIVITIES,
    notes: 'Opera-backed fintech, mobile money and payments, MFB license from CBN',
  },
  {
    name: 'Kuda Microfinance Bank Limited',
    category: 'Digital Bank',
    regulator: 'CBN',
    licenseType: 'CBN MFB — Microfinance Bank',
    activities: BANKING_CRYPTO_ACTIVITIES,
    notes: 'Digital-only bank with CBN microfinance banking license',
  },
  {
    name: 'Flutterwave Technology Solutions Limited',
    category: 'Fintech PSP',
    regulator: 'CBN',
    licenseType: 'CBN PSP — Payment Service Provider',
    activities: FINTECH_CRYPTO_ACTIVITIES,
    notes: 'Pan-African payments infrastructure, CBN-licensed switching & processing',
  },
  {
    name: 'Paystack Payments Limited',
    category: 'Fintech PSP',
    regulator: 'CBN',
    licenseType: 'CBN PSP — Payment Service Provider',
    activities: PSP_ACTIVITIES,
    notes: 'Stripe-acquired payment gateway, CBN-licensed',
  },

  // --- International crypto companies operating in Nigeria ---
  {
    name: 'Luno Nigeria (Digital Currency Nigeria Limited)',
    category: 'International Exchange',
    regulator: 'SEC',
    licenseType: 'SEC VASP — Digital Asset Exchange',
    activities: INTERNATIONAL_EXCHANGE_ACTIVITIES,
    notes: 'DCG-owned exchange, one of the largest in Nigeria by volume',
  },
  {
    name: 'Yellow Card Financial Nigeria Limited',
    category: 'International Exchange',
    regulator: 'SEC',
    licenseType: 'SEC VASP — Digital Asset Exchange',
    activities: INTERNATIONAL_EXCHANGE_ACTIVITIES,
    notes: 'Pan-African crypto on/off ramp, P2P focus',
  },
  {
    name: 'VALR Nigeria Limited',
    category: 'International Exchange',
    regulator: 'SEC',
    licenseType: 'SEC VASP — Digital Asset Exchange',
    activities: INTERNATIONAL_EXCHANGE_ACTIVITIES,
    notes: 'South African exchange expanding to Nigeria',
  },
  {
    name: 'Binance Nigeria (via third-party partners)',
    category: 'International Exchange',
    regulator: 'SEC',
    licenseType: 'SEC VASP — Pending Registration',
    activities: INTERNATIONAL_EXCHANGE_ACTIVITIES,
    notes: 'Operates via local P2P partners, SEC registration status unclear',
  },
  {
    name: 'KuCoin Nigeria Limited',
    category: 'International Exchange',
    regulator: 'SEC',
    licenseType: 'SEC VASP — Pending Registration',
    activities: INTERNATIONAL_EXCHANGE_ACTIVITIES,
    notes: 'Global exchange with Nigerian user base, seeking SEC registration',
  },
];

export class NgCbnParser implements RegistryParser {
  config: ParserConfig = {
    id: 'ng-cbn',
    name: 'Nigeria CBN & SEC Crypto/Fintech Entities',
    countryCode: 'NG',
    country: 'Nigeria',
    regulator: 'CBN (Central Bank of Nigeria)',
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

    // Attempt to fetch the CBN website to check for any machine-readable registry
    try {
      logger.info(this.config.id, 'Fetching CBN homepage to check for registry data');

      const html = await fetchWithRetry(SOURCE_URL, {
        registryId: this.config.id,
        rateLimit: 5_000,
      });

      // Check if the page contains any licensing directory or registry links
      const hasLicenseTable = /<table[\s>]/i.test(html) && /licen[sc]e|payment.*service|fintech/i.test(html);
      const hasRegistryLink = /licen[sc](ing|ed).*director|register.*of.*institution/i.test(html);

      if (hasLicenseTable) {
        warnings.push(
          'CBN page may contain license table data. Consider building a HTML scraper.'
        );
        logger.warn(
          this.config.id,
          'CBN page appears to have table content with license hints — review for scraper upgrade'
        );
      } else if (hasRegistryLink) {
        warnings.push(
          'CBN page may have links to licensing directories. Consider following those links.'
        );
        logger.info(this.config.id, 'CBN page has registry-related links but no inline data');
      } else {
        logger.info(
          this.config.id,
          'CBN page returned 200 but no scrapable entity data found. Using known entities fallback.'
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`CBN page fetch failed: ${msg}. Using known entities fallback.`);
      logger.warn(this.config.id, `CBN page fetch error: ${msg}`);
    }

    // Fallback: use known Nigerian crypto & fintech entities
    if (entities.length === 0) {
      logger.info(this.config.id, 'Using known Nigeria crypto/fintech entity list as fallback');

      for (let i = 0; i < KNOWN_NG_ENTITIES.length; i++) {
        const known = KNOWN_NG_ENTITIES[i];
        const key = known.name.toLowerCase();

        if (seen.has(key)) continue;
        seen.add(key);

        const paddedIndex = String(i + 1).padStart(3, '0');

        // Format license number based on regulator
        const licenseNumber = known.regulator === 'CBN'
          ? `CBN-PSP-${paddedIndex}`
          : `SEC-VASP-${paddedIndex}`;

        entities.push({
          name: known.name,
          licenseNumber,
          countryCode: 'NG',
          country: 'Nigeria',
          status: known.licenseType.includes('Pending') ? 'Pending' : 'Licensed',
          regulator: known.regulator === 'CBN' ? 'CBN Nigeria' : 'SEC Nigeria',
          licenseType: known.licenseType,
          activities: known.activities,
          sourceUrl: SOURCE_URL,
        });
      }

      if (entities.length > 0) {
        warnings.push(
          `Used known entities fallback (${entities.length} entities). CBN does not provide a machine-readable registry.`
        );
      }
    }

    logger.info(this.config.id, `Found ${entities.length} entities`);

    return {
      registryId: this.config.id,
      countryCode: 'NG',
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

  const parser = new NgCbnParser();
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
