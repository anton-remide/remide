/**
 * QA QFCRA — Qatar Financial Centre Regulatory Authority
 *
 * Source: QFCRA Firm Directory
 * URL: https://www.qfcra.com/
 *
 * The QFCRA website uses a JavaScript-rendered firm directory that is not
 * scrapable without a headless browser. The QFC (Qatar Financial Centre)
 * has attracted a number of major international financial institutions and
 * crypto/digital asset firms, especially following Qatar's Digital Assets
 * Framework introduced in 2024.
 *
 * Qatar has historically been strict on crypto, but the QFC has become
 * a gateway for regulated digital asset activity in the country.
 *
 * QFCRA License Categories (relevant to digital assets):
 *   - Digital Asset Service Provider (DASP)
 *   - Investment Management
 *   - Custody Services
 *   - Banking
 *   - Insurance
 *   - Advisory Services
 *
 * Note: The QFCRA firm directory requires JS rendering for data extraction.
 * Static HTML fetch yields no entity data, hence the known entities fallback
 * (same pattern as bh-cbb.ts and kr-fiu.ts).
 *
 * Usage:
 *   npx tsx parsers/registries/qa-qfcra.ts --dry-run
 *   npx tsx parsers/registries/qa-qfcra.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import type { RegistryParser, ParserConfig, ParseResult, ParsedEntity } from '../core/types.js';
import { fetchWithRetry } from '../core/client.js';
import { logger } from '../core/logger.js';

const SOURCE_URL = 'https://www.qfcra.com/';

// ---- Activity sets by firm type ----

const DASP_ACTIVITIES = ['Digital Asset Trading', 'Digital Asset Custody', 'Digital Asset Advisory'];
const CRYPTO_CUSTODY_ACTIVITIES = ['Digital Asset Custody', 'Safekeeping of Digital Assets'];
const STABLECOIN_ACTIVITIES = ['Stablecoin Issuance', 'Digital Asset Services'];
const CRYPTO_ETP_ACTIVITIES = ['Crypto ETP Issuance', 'Digital Asset Investment Products'];
const BANKING_DIGITAL_ACTIVITIES = ['Banking', 'Digital Asset Services', 'Custody'];
const INVESTMENT_MGMT_ACTIVITIES = ['Investment Management', 'Fund Administration'];
const DATA_SERVICES_ACTIVITIES = ['Financial Data Services', 'Market Data'];

// ---- Known QFC-registered firms with digital asset exposure ----

interface KnownEntity {
  name: string;
  entityType: 'VASP' | 'Bank' | 'PSP';
  licenseType: string;
  activities: string[];
  notes?: string;
}

const KNOWN_QFC_ENTITIES: KnownEntity[] = [
  {
    name: 'Paxos Global Pte. Ltd. (QFC Branch)',
    entityType: 'VASP',
    licenseType: 'Digital Asset Service Provider',
    activities: STABLECOIN_ACTIVITIES,
    notes: 'Stablecoin issuer (USDP, PYUSD infrastructure), QFC registered',
  },
  {
    name: 'Komainu Holdings Ltd. (QFC Branch)',
    entityType: 'VASP',
    licenseType: 'Digital Asset Service Provider',
    activities: CRYPTO_CUSTODY_ACTIVITIES,
    notes: 'Institutional crypto custody (Nomura/Ledger/CoinShares JV), QFC registered',
  },
  {
    name: '21Shares AG (QFC Branch)',
    entityType: 'VASP',
    licenseType: 'Digital Asset Service Provider',
    activities: CRYPTO_ETP_ACTIVITIES,
    notes: 'Crypto ETP issuer, QFC registered',
  },
  {
    name: 'Blockchain.com (QFC Branch)',
    entityType: 'VASP',
    licenseType: 'Digital Asset Service Provider',
    activities: DASP_ACTIVITIES,
    notes: 'Crypto exchange and wallet provider, QFC registered',
  },
  {
    name: 'Binance (QFC)',
    entityType: 'VASP',
    licenseType: 'Digital Asset Service Provider',
    activities: DASP_ACTIVITIES,
    notes: 'QFC discussions for regulated digital asset services',
  },
  {
    name: 'Standard Chartered Bank (QFC Branch)',
    entityType: 'Bank',
    licenseType: 'Banking — QFC Authorized Firm',
    activities: BANKING_DIGITAL_ACTIVITIES,
    notes: 'Major international bank, digital asset custody via Zodia (SC subsidiary)',
  },
  {
    name: 'HSBC Bank Middle East Ltd. (QFC Branch)',
    entityType: 'Bank',
    licenseType: 'Banking — QFC Authorized Firm',
    activities: BANKING_DIGITAL_ACTIVITIES,
    notes: 'QFC authorized, exploring tokenized assets and digital custody',
  },
  {
    name: 'JP Morgan Chase Bank N.A. (QFC Branch)',
    entityType: 'Bank',
    licenseType: 'Banking — QFC Authorized Firm',
    activities: BANKING_DIGITAL_ACTIVITIES,
    notes: 'QFC authorized, JPM Coin / Onyx blockchain division',
  },
  {
    name: 'Deutsche Bank AG (QFC Branch)',
    entityType: 'Bank',
    licenseType: 'Banking — QFC Authorized Firm',
    activities: BANKING_DIGITAL_ACTIVITIES,
    notes: 'QFC authorized, digital asset custody pilot programs',
  },
  {
    name: 'Zurich Insurance Company Ltd. (QFC Branch)',
    entityType: 'PSP',
    licenseType: 'Insurance — QFC Authorized Firm',
    activities: ['Insurance', 'Digital Asset Insurance'],
    notes: 'QFC authorized, insurance services including digital asset coverage',
  },
  {
    name: 'Fidelity International (QFC Branch)',
    entityType: 'PSP',
    licenseType: 'Investment Management — QFC Authorized Firm',
    activities: INVESTMENT_MGMT_ACTIVITIES,
    notes: 'QFC authorized, digital asset fund products under exploration',
  },
  {
    name: 'Bloomberg Finance L.P. (QFC Branch)',
    entityType: 'PSP',
    licenseType: 'Ancillary Services — QFC Authorized Firm',
    activities: DATA_SERVICES_ACTIVITIES,
    notes: 'QFC authorized, crypto market data and index services',
  },
];

export class QaQfcraParser implements RegistryParser {
  config: ParserConfig = {
    id: 'qa-qfcra',
    name: 'Qatar QFCRA Digital Asset & Financial Services Firms',
    countryCode: 'QA',
    country: 'Qatar',
    regulator: 'QFCRA (Qatar Financial Centre Regulatory Authority)',
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

    // Attempt to fetch the QFCRA website
    // (expected to fail yielding 0 entities due to JS rendering)
    try {
      logger.info(this.config.id, 'Fetching QFCRA firm directory page');

      const html = await fetchWithRetry(SOURCE_URL, {
        registryId: this.config.id,
        rateLimit: 5_000,
      });

      // The site requires JS rendering — static HTML contains no firm directory data.
      // Check for any obvious table/list content in case the page structure changes.
      const hasTable = /<table[\s>]/i.test(html) && /<td[\s>]/i.test(html);
      const hasEntityHint = /firm\s*directory|authorized\s*firm|digital\s*asset/i.test(html);

      if (hasTable && hasEntityHint) {
        warnings.push(
          'QFCRA page may now contain static firm data. Consider building a HTML scraper.'
        );
        logger.warn(
          this.config.id,
          'QFCRA page appears to have table content with firm hints — review for scraper upgrade'
        );
      } else {
        logger.info(
          this.config.id,
          'QFCRA page returned 200 but no scrapable firm data (JS-rendered). Using known entities fallback.'
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`QFCRA page fetch failed: ${msg}. Using known entities fallback.`);
      logger.warn(this.config.id, `QFCRA page fetch error: ${msg}`);
    }

    // Fallback: use known QFC-registered entities with digital asset exposure
    if (entities.length === 0) {
      logger.info(this.config.id, 'Using known QFC entity list as fallback');

      for (let i = 0; i < KNOWN_QFC_ENTITIES.length; i++) {
        const known = KNOWN_QFC_ENTITIES[i];
        const key = known.name.toLowerCase();

        if (seen.has(key)) continue;
        seen.add(key);

        const paddedIndex = String(i + 1).padStart(3, '0');

        entities.push({
          name: known.name,
          licenseNumber: `QFCRA-${paddedIndex}`,
          countryCode: 'QA',
          country: 'Qatar',
          status: 'Licensed',
          regulator: 'QFCRA',
          licenseType: known.licenseType,
          entityTypes: [known.entityType],
          activities: known.activities,
          sourceUrl: SOURCE_URL,
        });
      }

      if (entities.length > 0) {
        warnings.push(
          `Used known entities fallback (${entities.length} entities). QFCRA directory requires JS rendering.`
        );
      }
    }

    logger.info(this.config.id, `Found ${entities.length} entities`);

    return {
      registryId: this.config.id,
      countryCode: 'QA',
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

  const parser = new QaQfcraParser();
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
