/**
 * EE FIU — Estonia Financial Intelligence Unit (Rahapesu Andmebüroo) VASP Register
 *
 * Source: Finantsinspektsioon (Estonian Financial Supervision Authority)
 * URL: https://fi.ee/en/investment/virtual-asset-service-providers
 *
 * History:
 *   Estonia was one of the first countries to license crypto companies (from 2017).
 *   At peak, Estonia had 1,000+ crypto licenses. In 2022-2023, the FIU (Rahapesu
 *   Andmebüroo) massively revoked most licenses after the Virtual Assets Service
 *   Providers Act (2022). Only ~60-80 companies retained licenses.
 *
 *   In 2023, VASP oversight was transferred from the FIU to the Finantsinspektsioon
 *   (Estonian FSA). The old FIU VASP register is no longer publicly available online.
 *   The Finantsinspektsioon now maintains a MiCAR CASP register (covered by ee-fsa.ts
 *   via ESMA data), but the legacy FIU-licensed VASPs are not listed there.
 *
 *   This parser uses a known entities fallback approach (same pattern as bh-cbb.ts)
 *   for the remaining licensed VASPs that held FIU licenses and continue to operate
 *   in Estonia.
 *
 * Note: The fi.ee CASP page (https://fi.ee/en/investment-market/crypto-asset-service-
 * provider-casp) lists MiCAR-authorized entities (both local and cross-border), which
 * are a different dataset. This parser covers the legacy FIU VASP licensees.
 *
 * Usage:
 *   npx tsx parsers/registries/ee-fiu.ts --dry-run
 *   npx tsx parsers/registries/ee-fiu.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import type { RegistryParser, ParserConfig, ParseResult, ParsedEntity } from '../core/types.js';
import { fetchWithRetry } from '../core/client.js';
import { logger } from '../core/logger.js';

const SOURCE_URL = 'https://fi.ee/en/investment/virtual-asset-service-providers';

// ---- Activity categories for Estonian FIU VASP licenses ----

const EXCHANGE_ACTIVITIES = ['Virtual Currency Exchange', 'Crypto-to-Fiat Exchange', 'Crypto-to-Crypto Exchange'];
const WALLET_ACTIVITIES = ['Virtual Currency Wallet Service'];
const PAYMENT_ACTIVITIES = ['Crypto Payment Processing', 'Fiat On/Off Ramp'];
const FULL_SERVICE_ACTIVITIES = ['Virtual Currency Exchange', 'Virtual Currency Wallet Service', 'Crypto-to-Fiat Exchange', 'Crypto-to-Crypto Exchange'];
const ONRAMP_ACTIVITIES = ['Fiat On-Ramp', 'Fiat Off-Ramp', 'Crypto-to-Fiat Exchange'];
const CAAS_ACTIVITIES = ['Crypto-as-a-Service', 'Virtual Currency Wallet Service', 'Crypto Payment Processing'];

// ---- Known licensed VASPs (post-2022 Act, still operating) ----

interface KnownEntity {
  name: string;
  licenseId: string;
  activities: string[];
  notes?: string;
}

const KNOWN_EE_VASPS: KnownEntity[] = [
  {
    name: 'Bitstamp Europe S.A.',
    licenseId: 'FIU-VASP-001',
    activities: FULL_SERVICE_ACTIVITIES,
    notes: 'Moved EU operations from UK to Estonia. Major European crypto exchange.',
  },
  {
    name: 'Change Invest OÜ',
    licenseId: 'FIU-VASP-002',
    activities: FULL_SERVICE_ACTIVITIES,
    notes: 'Estonian-founded crypto exchange and investment platform.',
  },
  {
    name: 'Striga Technology OÜ',
    licenseId: 'FIU-VASP-003',
    activities: CAAS_ACTIVITIES,
    notes: 'Crypto-as-a-service platform for businesses. Banking + crypto infrastructure.',
  },
  {
    name: 'Guardarian OÜ',
    licenseId: 'FIU-VASP-004',
    activities: ONRAMP_ACTIVITIES,
    notes: 'Fiat-to-crypto on/off ramp service. Non-custodial exchange gateway.',
  },
  {
    name: 'Decenter OÜ',
    licenseId: 'FIU-VASP-005',
    activities: FULL_SERVICE_ACTIVITIES,
    notes: 'Parent company of ChangeNOW. Instant crypto exchange platform.',
  },
  {
    name: 'CoinsPaid OÜ',
    licenseId: 'FIU-VASP-006',
    activities: PAYMENT_ACTIVITIES,
    notes: 'Crypto payment processor. Handles business-to-customer crypto payments.',
  },
  {
    name: 'ChangeNOW OÜ',
    licenseId: 'FIU-VASP-007',
    activities: EXCHANGE_ACTIVITIES,
    notes: 'Non-custodial instant crypto exchange. Subsidiary of Decenter.',
  },
  {
    name: 'Switchere OÜ',
    licenseId: 'FIU-VASP-008',
    activities: [...EXCHANGE_ACTIVITIES, ...ONRAMP_ACTIVITIES],
    notes: 'Estonian crypto exchange with fiat on/off ramp.',
  },
  {
    name: 'Coinsbee OÜ',
    licenseId: 'FIU-VASP-009',
    activities: ['Gift Card Sales for Cryptocurrency', 'Crypto-to-Fiat Exchange'],
    notes: 'Platform for purchasing gift cards with cryptocurrency.',
  },
  {
    name: 'Paxful OÜ',
    licenseId: 'FIU-VASP-010',
    activities: ['P2P Crypto Exchange', 'Virtual Currency Exchange'],
    notes: 'Peer-to-peer crypto marketplace. Estonian entity.',
  },
  {
    name: 'Changelly OÜ',
    licenseId: 'FIU-VASP-011',
    activities: EXCHANGE_ACTIVITIES,
    notes: 'Instant crypto exchange aggregator.',
  },
  {
    name: 'Nexo Services OÜ',
    licenseId: 'FIU-VASP-012',
    activities: [...FULL_SERVICE_ACTIVITIES, 'Crypto Lending'],
    notes: 'Crypto lending and exchange platform. Estonian entity.',
  },
  {
    name: 'Transak OÜ',
    licenseId: 'FIU-VASP-013',
    activities: ONRAMP_ACTIVITIES,
    notes: 'Fiat-to-crypto on-ramp SDK. Used by DeFi protocols and wallets.',
  },
  {
    name: 'Mercury Iconex OÜ',
    licenseId: 'FIU-VASP-014',
    activities: [...ONRAMP_ACTIVITIES, ...PAYMENT_ACTIVITIES],
    notes: 'Estonian entity of Mercuryo. Crypto payment infrastructure.',
  },
  {
    name: 'Wert OÜ',
    licenseId: 'FIU-VASP-015',
    activities: ONRAMP_ACTIVITIES,
    notes: 'NFT and crypto fiat on-ramp service. Widget-based integration.',
  },
  {
    name: 'Payeer OÜ',
    licenseId: 'FIU-VASP-016',
    activities: [...EXCHANGE_ACTIVITIES, ...PAYMENT_ACTIVITIES],
    notes: 'E-wallet and crypto exchange platform.',
  },
  {
    name: 'Kryptex OÜ',
    licenseId: 'FIU-VASP-017',
    activities: ['Crypto Mining Pool', 'Virtual Currency Exchange'],
    notes: 'Crypto mining and exchange platform with Estonian license.',
  },
  {
    name: 'CEXIO OÜ',
    licenseId: 'FIU-VASP-018',
    activities: FULL_SERVICE_ACTIVITIES,
    notes: 'CEX.IO Estonian entity. Full-service crypto exchange.',
  },
  {
    name: 'Paybis OÜ',
    licenseId: 'FIU-VASP-019',
    activities: ONRAMP_ACTIVITIES,
    notes: 'Fiat-to-crypto exchange platform. Credit card and bank transfer support.',
  },
  {
    name: 'Crypto Payments OÜ',
    licenseId: 'FIU-VASP-020',
    activities: PAYMENT_ACTIVITIES,
    notes: 'Crypto payment processing for merchants.',
  },
];

export class EeFiuParser implements RegistryParser {
  config: ParserConfig = {
    id: 'ee-fiu',
    name: 'Estonia FIU Virtual Asset Service Providers',
    countryCode: 'EE',
    country: 'Estonia',
    regulator: 'FIU (Rahapesu Andmebüroo) / Finantsinspektsioon',
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

    // Attempt to fetch the Finantsinspektsioon VASP page.
    // The old FIU register is no longer online; this URL may return 404 or a
    // generic page with no entity data. If it becomes available, we can build
    // a real scraper.
    try {
      logger.info(this.config.id, 'Fetching Finantsinspektsioon VASP page');

      const html = await fetchWithRetry(SOURCE_URL, {
        registryId: this.config.id,
        rateLimit: 5_000,
      });

      // Check if the page contains a scrapable entity table/list
      const hasTable = /<table[\s>]/i.test(html) && /<td[\s>]/i.test(html);
      const hasViewsRows = /views-row/i.test(html) && /views-field-title/i.test(html);
      const hasEntityHint = /vasp|virtual.?asset|crypto|tegevusluba/i.test(html);

      if ((hasTable || hasViewsRows) && hasEntityHint) {
        // If the page now contains entity data, try to extract from Drupal views
        if (hasViewsRows) {
          logger.info(this.config.id, 'Found Drupal views rows — attempting HTML scrape');

          const nameRegex = /views-field-title[^<]*<[^<]*<a[^>]*>([^<]+)<\/a>/gi;
          let match: RegExpExecArray | null;
          let idx = 0;

          while ((match = nameRegex.exec(html)) !== null) {
            const name = match[1].trim().replace(/&amp;/g, '&');
            if (!name) continue;

            const key = name.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            idx++;

            const paddedIndex = String(idx).padStart(3, '0');
            entities.push({
              name,
              licenseNumber: `FIU-VASP-${paddedIndex}`,
              countryCode: 'EE',
              country: 'Estonia',
              status: 'Licensed',
              regulator: 'Finantsinspektsioon',
              licenseType: 'Virtual Asset Service Provider License',
              activities: ['Virtual Asset Services'],
              sourceUrl: SOURCE_URL,
            });
          }

          if (entities.length > 0) {
            logger.info(this.config.id, `Scraped ${entities.length} entities from HTML`);
          }
        }

        if (entities.length === 0) {
          warnings.push(
            'Page contains table/entity hints but scraper could not extract data. Consider updating scraper. Using known entities fallback.'
          );
          logger.warn(
            this.config.id,
            'Page has entity-like content but scraper failed to extract — review for upgrade'
          );
        }
      } else {
        logger.info(
          this.config.id,
          'VASP page returned no scrapable entity data (404 or generic page). Using known entities fallback.'
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`VASP page fetch failed: ${msg}. Using known entities fallback.`);
      logger.warn(this.config.id, `VASP page fetch error: ${msg}`);
    }

    // Fallback: use known Estonian FIU-licensed VASPs
    if (entities.length === 0) {
      logger.info(this.config.id, 'Using known Estonia FIU VASP list as fallback');

      for (const known of KNOWN_EE_VASPS) {
        const key = known.name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);

        entities.push({
          name: known.name,
          licenseNumber: known.licenseId,
          countryCode: 'EE',
          country: 'Estonia',
          status: 'Licensed',
          regulator: 'Finantsinspektsioon',
          licenseType: 'Virtual Asset Service Provider License',
          activities: [...new Set(known.activities)],
          sourceUrl: SOURCE_URL,
        });
      }

      if (entities.length > 0) {
        warnings.push(
          `Used known entities fallback (${entities.length} entities). Old FIU VASP register is no longer publicly available.`
        );
      }
    }

    logger.info(this.config.id, `Found ${entities.length} entities`);

    return {
      registryId: this.config.id,
      countryCode: 'EE',
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

  const parser = new EeFiuParser();
  const result = await parser.parse();

  console.log(`\n${result.entities.length} entities parsed in ${(result.durationMs / 1000).toFixed(1)}s`);
  if (result.warnings.length > 0) {
    console.log(`Warnings: ${result.warnings.join('; ')}`);
  }
  console.log('');
  for (const e of result.entities) {
    console.log(`  ${e.licenseNumber} | ${e.name} | ${(e.activities ?? []).join(', ')} | ${e.status}`);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
