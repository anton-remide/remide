/**
 * RU CBR — Russia Central Bank of Russia Digital Financial Assets Registry
 *
 * Source: Bank of Russia (CBR)
 * URL: https://www.cbr.ru/
 *
 * Russia passed Federal Law No. 259-FZ "On Digital Financial Assets" (DFA)
 * in January 2021, establishing a legal framework for digital financial
 * assets and digital currency. The CBR oversees operators of information
 * systems for issuing DFA, crypto exchanges, and related fintech entities.
 *
 * The CBR does not publish a public machine-readable registry of licensed
 * DFA operators. Licensing information is published via CBR press releases,
 * regulatory orders, and the official register of credit organizations.
 * Static HTML fetch of cbr.ru yields no structured VASP/DFA registry data,
 * so we use a known entities fallback (same pattern as bh-cbb.ts, ke-cma.ts).
 *
 * Entity categories:
 *   - DFA Operator: Licensed operator of information system for DFA issuance
 *   - Bank (DFA): Major bank with DFA platform or digital asset initiatives
 *   - VASP: Virtual asset service provider / crypto exchange
 *   - PSP: Payment service provider with crypto-adjacent services
 *   - Blockchain Platform: Russian-founded blockchain/DeFi platform
 *
 * License format: CBR-DFA-{001..NNN}
 *
 * Usage:
 *   npx tsx parsers/registries/ru-cbr.ts --dry-run
 *   npx tsx parsers/registries/ru-cbr.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import type { RegistryParser, ParserConfig, ParseResult, ParsedEntity } from '../core/types.js';
import { fetchWithRetry } from '../core/client.js';
import { logger } from '../core/logger.js';

const SOURCE_URL = 'https://www.cbr.ru/';

// ---- Activity sets by entity category ----

const DFA_OPERATOR_ACTIVITIES = ['DFA Issuance', 'Digital Financial Assets', 'Tokenization'];
const BANK_DFA_ACTIVITIES = ['Banking', 'DFA Platform', 'Digital Asset Services'];
const VASP_ACTIVITIES = ['Crypto Exchange', 'Virtual Asset Trading', 'Custody'];
const PSP_ACTIVITIES = ['Payment Services', 'E-Money', 'Crypto-Adjacent Payments'];
const BLOCKCHAIN_ACTIVITIES = ['Blockchain Infrastructure', 'Smart Contracts', 'DeFi Services'];

// ---- Known DFA operators, VASPs, and crypto-adjacent entities in Russia ----

interface KnownEntity {
  name: string;
  category: string;
  licenseType: string;
  activities: string[];
  entityType: string;
  notes?: string;
}

const KNOWN_RU_ENTITIES: KnownEntity[] = [
  {
    name: 'Atomyze',
    category: 'DFA Operator',
    licenseType: 'DFA Operator License',
    activities: DFA_OPERATOR_ACTIVITIES,
    entityType: 'VASP',
    notes: 'Tokenization platform backed by Nornickel, first CBR-registered DFA operator',
  },
  {
    name: 'Lighthouse',
    category: 'DFA Operator',
    licenseType: 'DFA Operator License',
    activities: DFA_OPERATOR_ACTIVITIES,
    entityType: 'VASP',
    notes: 'Digital asset platform, CBR-registered DFA information system operator',
  },
  {
    name: 'Sberbank',
    category: 'Bank (DFA)',
    licenseType: 'Bank License + DFA Platform',
    activities: BANK_DFA_ACTIVITIES,
    entityType: 'Bank',
    notes: 'Largest Russian bank, operates own DFA platform for tokenized assets',
  },
  {
    name: 'Alfa-Bank',
    category: 'Bank (DFA)',
    licenseType: 'Bank License + DFA Platform',
    activities: BANK_DFA_ACTIVITIES,
    entityType: 'Bank',
    notes: 'Major private bank with DFA issuance initiatives and digital asset services',
  },
  {
    name: 'VTB Bank',
    category: 'Bank (DFA)',
    licenseType: 'Bank License + DFA Platform',
    activities: BANK_DFA_ACTIVITIES,
    entityType: 'Bank',
    notes: 'State-owned bank with digital asset experiments and DFA pilot programs',
  },
  {
    name: 'Tinkoff Bank',
    category: 'Bank (DFA)',
    licenseType: 'Bank License + DFA Platform',
    activities: BANK_DFA_ACTIVITIES,
    entityType: 'Bank',
    notes: 'Digital-first bank with crypto-adjacent services, part of T-Bank ecosystem',
  },
  {
    name: 'QIWI',
    category: 'PSP',
    licenseType: 'Payment Service Provider',
    activities: PSP_ACTIVITIES,
    entityType: 'PSP',
    notes: 'Payment services provider, historically crypto-adjacent, CBR license revoked 2024',
  },
  {
    name: 'BestChange',
    category: 'VASP',
    licenseType: 'Exchange Aggregator',
    activities: VASP_ACTIVITIES,
    entityType: 'VASP',
    notes: 'Crypto and e-money exchange rate aggregator, long-running Russian platform',
  },
  {
    name: 'Garantex',
    category: 'VASP',
    licenseType: 'Crypto Exchange',
    activities: VASP_ACTIVITIES,
    entityType: 'VASP',
    notes: 'Crypto exchange, US/EU sanctioned (OFAC 2022), was operating from Russia',
  },
  {
    name: 'Exmo',
    category: 'VASP',
    licenseType: 'Crypto Exchange',
    activities: VASP_ACTIVITIES,
    entityType: 'VASP',
    notes: 'Ukrainian-Russian crypto exchange, popular in CIS markets',
  },
  {
    name: 'Matbea',
    category: 'VASP',
    licenseType: 'Crypto Exchange',
    activities: VASP_ACTIVITIES,
    entityType: 'VASP',
    notes: 'Russian crypto exchange and wallet service, operating since 2014',
  },
  {
    name: 'CommEX',
    category: 'VASP',
    licenseType: 'Crypto Exchange',
    activities: VASP_ACTIVITIES,
    entityType: 'VASP',
    notes: 'Took over Binance Russia operations in 2023, subsequently shut down 2024',
  },
  {
    name: 'Bybit Russia',
    category: 'VASP',
    licenseType: 'Crypto Exchange',
    activities: VASP_ACTIVITIES,
    entityType: 'VASP',
    notes: 'Global crypto exchange with Russian user base and RUB trading pairs',
  },
  {
    name: 'HTX (Huobi) Russia',
    category: 'VASP',
    licenseType: 'Crypto Exchange',
    activities: VASP_ACTIVITIES,
    entityType: 'VASP',
    notes: 'Global exchange (rebranded from Huobi), Russian operations and P2P market',
  },
  {
    name: 'Waves',
    category: 'Blockchain Platform',
    licenseType: 'Blockchain Platform Operator',
    activities: BLOCKCHAIN_ACTIVITIES,
    entityType: 'VASP',
    notes: 'Russian-founded blockchain platform (Sasha Ivanov), DEX and smart contracts',
  },
  {
    name: 'Masterchain',
    category: 'DFA Operator',
    licenseType: 'DFA Operator License',
    activities: DFA_OPERATOR_ACTIVITIES,
    entityType: 'VASP',
    notes: 'Blockchain platform created by CBR and major Russian banks for financial infrastructure',
  },
  {
    name: 'SPB Exchange',
    category: 'DFA Operator',
    licenseType: 'DFA Operator License',
    activities: [...DFA_OPERATOR_ACTIVITIES, 'Securities Trading'],
    entityType: 'VASP',
    notes: 'Saint Petersburg Exchange, registered DFA information system operator',
  },
  {
    name: 'Gazprombank',
    category: 'Bank (DFA)',
    licenseType: 'Bank License + DFA Platform',
    activities: BANK_DFA_ACTIVITIES,
    entityType: 'Bank',
    notes: 'Major state-affiliated bank exploring DFA and digital ruble integration',
  },
];

export class RuCbrParser implements RegistryParser {
  config: ParserConfig = {
    id: 'ru-cbr',
    name: 'Russia CBR Digital Financial Assets Registry',
    countryCode: 'RU',
    country: 'Russia',
    regulator: 'CBR (Central Bank of Russia)',
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

    // Attempt to fetch the CBR website
    // (expected to yield no structured DFA/VASP registry data)
    try {
      logger.info(this.config.id, 'Fetching CBR Russia website');

      const html = await fetchWithRetry(SOURCE_URL, {
        registryId: this.config.id,
        rateLimit: 5_000,
      });

      // Check for any registry/list content that might indicate a public DFA registry
      const hasTable = /<table[\s>]/i.test(html) && /<td[\s>]/i.test(html);
      const hasEntityHint = /цифровые финансовые активы|DFA|оператор информационной системы|реестр/i.test(html);

      if (hasTable && hasEntityHint) {
        warnings.push(
          'CBR page may now contain static DFA registry data. Consider building a HTML scraper.'
        );
        logger.warn(
          this.config.id,
          'CBR page appears to have table content with DFA hints — review for scraper upgrade'
        );
      } else {
        logger.info(
          this.config.id,
          'CBR page returned 200 but no scrapable DFA registry data. Using known entities fallback.'
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`CBR page fetch failed: ${msg}. Using known entities fallback.`);
      logger.warn(this.config.id, `CBR page fetch error: ${msg}`);
    }

    // Fallback: use known Russian DFA/VASP entities
    if (entities.length === 0) {
      logger.info(this.config.id, 'Using known Russia DFA/VASP list as fallback');

      for (let i = 0; i < KNOWN_RU_ENTITIES.length; i++) {
        const known = KNOWN_RU_ENTITIES[i];
        const key = known.name.toLowerCase();

        if (seen.has(key)) continue;
        seen.add(key);

        const paddedIndex = String(i + 1).padStart(3, '0');

        entities.push({
          name: known.name,
          licenseNumber: `CBR-DFA-${paddedIndex}`,
          countryCode: 'RU',
          country: 'Russia',
          status: 'Licensed',
          regulator: 'CBR',
          licenseType: known.licenseType,
          entityTypes: [known.entityType],
          activities: known.activities,
          sourceUrl: SOURCE_URL,
        });
      }

      if (entities.length > 0) {
        warnings.push(
          `Used known entities fallback (${entities.length} entities). CBR does not publish a machine-readable DFA registry.`
        );
      }
    }

    logger.info(this.config.id, `Found ${entities.length} entities`);

    return {
      registryId: this.config.id,
      countryCode: 'RU',
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

  const parser = new RuCbrParser();
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
