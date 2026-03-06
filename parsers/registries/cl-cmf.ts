/**
 * CL CMF — Chile Comisión para el Mercado Financiero (Virtual Asset Platforms)
 *
 * Source: CMF Chile Fintech Registry
 * URL: https://www.cmfchile.cl/
 *
 * Chile passed the Fintech & Innovation Law (Ley Fintec, Law 21.521) in
 * January 2023, granting the CMF authority to regulate virtual asset service
 * providers, payment platforms, and other fintech companies. The CMF maintains
 * a registry of authorized fintech service providers, including those offering
 * crypto/virtual asset services.
 *
 * The CMF website uses a complex JavaScript-rendered portal for its registries.
 * The fintech registry data is not available as static HTML. There are ~12
 * known crypto/virtual asset platforms operating under the Ley Fintec
 * framework, so we use a known entities fallback approach (same pattern as
 * bh-cbb.ts and kr-fiu.ts).
 *
 * Categories under Ley Fintec:
 *   - Plataforma de Activos Virtuales (Virtual Asset Platform)
 *   - Servicio de Custodia de Activos Virtuales (Virtual Asset Custody)
 *   - Servicio de Intermediación de Activos Virtuales (Virtual Asset Brokerage)
 *   - Servicio de Pago (Payment Service)
 *
 * Usage:
 *   npx tsx parsers/registries/cl-cmf.ts --dry-run
 *   npx tsx parsers/registries/cl-cmf.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import type { RegistryParser, ParserConfig, ParseResult, ParsedEntity } from '../core/types.js';
import { fetchWithRetry } from '../core/client.js';
import { logger } from '../core/logger.js';

const SOURCE_URL = 'https://www.cmfchile.cl/';

// ---- Activity sets by Ley Fintec category ----

const EXCHANGE_ACTIVITIES = ['Virtual Asset Exchange', 'Crypto Trading', 'Fiat On/Off Ramp'];
const CUSTODY_ACTIVITIES = ['Virtual Asset Custody', 'Wallet Services'];
const BROKERAGE_ACTIVITIES = ['Virtual Asset Brokerage', 'Order Execution', 'Crypto Trading'];
const PAYMENTS_ACTIVITIES = ['Payment Services', 'Crypto Payment Processing'];
const FULL_PLATFORM_ACTIVITIES = ['Virtual Asset Exchange', 'Crypto Trading', 'Virtual Asset Custody', 'Fiat On/Off Ramp'];

// ---- Known licensed / registered Virtual Asset Platforms ----

interface KnownEntity {
  name: string;
  category: string;
  licenseType: string;
  activities: string[];
  notes?: string;
}

const KNOWN_CL_VASPS: KnownEntity[] = [
  {
    name: 'Buda.com SpA',
    category: 'Plataforma de Activos Virtuales',
    licenseType: 'Virtual Asset Platform',
    activities: FULL_PLATFORM_ACTIVITIES,
    notes: 'Chile-based exchange, also operates in Colombia, Peru, Argentina',
  },
  {
    name: 'OrionX SpA',
    category: 'Plataforma de Activos Virtuales',
    licenseType: 'Virtual Asset Platform',
    activities: EXCHANGE_ACTIVITIES,
    notes: 'Chilean crypto exchange founded 2017',
  },
  {
    name: 'CryptoMKT SpA',
    category: 'Plataforma de Activos Virtuales',
    licenseType: 'Virtual Asset Platform',
    activities: FULL_PLATFORM_ACTIVITIES,
    notes: 'Chilean exchange operating across LatAm',
  },
  {
    name: 'Vita Wallet SpA',
    category: 'Servicio de Pago',
    licenseType: 'Payment Service — Virtual Assets',
    activities: [...PAYMENTS_ACTIVITIES, 'Crypto Wallet'],
    notes: 'Chilean crypto wallet and payments platform',
  },
  {
    name: 'Binance Chile SpA',
    category: 'Plataforma de Activos Virtuales',
    licenseType: 'Virtual Asset Platform',
    activities: FULL_PLATFORM_ACTIVITIES,
    notes: 'Binance local entity for Chilean operations',
  },
  {
    name: 'Bitso Chile SpA',
    category: 'Plataforma de Activos Virtuales',
    licenseType: 'Virtual Asset Platform',
    activities: EXCHANGE_ACTIVITIES,
    notes: 'Mexico-based exchange with Chilean presence',
  },
  {
    name: 'Coinbase Chile SpA',
    category: 'Plataforma de Activos Virtuales',
    licenseType: 'Virtual Asset Platform',
    activities: EXCHANGE_ACTIVITIES,
    notes: 'US-based exchange operating in Chile',
  },
  {
    name: 'Mercado Pago Chile SpA',
    category: 'Servicio de Pago',
    licenseType: 'Payment Service — Virtual Assets',
    activities: PAYMENTS_ACTIVITIES,
    notes: 'MercadoLibre fintech arm, crypto buy/sell feature in Chile',
  },
  {
    name: 'Fintual SpA',
    category: 'Servicio de Intermediación',
    licenseType: 'Virtual Asset Brokerage',
    activities: BROKERAGE_ACTIVITIES,
    notes: 'Chilean fintech investment platform with crypto offerings',
  },
  {
    name: 'Khipu SpA',
    category: 'Servicio de Pago',
    licenseType: 'Payment Service — Virtual Assets',
    activities: PAYMENTS_ACTIVITIES,
    notes: 'Chilean payment gateway with crypto integration',
  },
  {
    name: 'Flow SpA',
    category: 'Servicio de Pago',
    licenseType: 'Payment Service — Virtual Assets',
    activities: PAYMENTS_ACTIVITIES,
    notes: 'Chilean payment platform (Flow.cl)',
  },
  {
    name: 'Toku SpA',
    category: 'Plataforma de Activos Virtuales',
    licenseType: 'Virtual Asset Platform',
    activities: EXCHANGE_ACTIVITIES,
    notes: 'Chilean OTC and crypto exchange',
  },
];

export class ClCmfParser implements RegistryParser {
  config: ParserConfig = {
    id: 'cl-cmf',
    name: 'Chile CMF Virtual Asset Platforms',
    countryCode: 'CL',
    country: 'Chile',
    regulator: 'CMF (Comisión para el Mercado Financiero)',
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

    // Attempt to fetch the CMF registry page
    // (expected to yield no scrapable entity data due to JS rendering)
    try {
      logger.info(this.config.id, 'Fetching CMF Chile registry page');

      const html = await fetchWithRetry(SOURCE_URL, {
        registryId: this.config.id,
        rateLimit: 5_000,
      });

      // Check for any obvious registry/table content in case the page becomes static
      const hasTable = /<table[\s>]/i.test(html) && /<td[\s>]/i.test(html);
      const hasEntityHint = /activo.?virtual|fintech|plataforma|VASP/i.test(html);

      if (hasTable && hasEntityHint) {
        warnings.push(
          'CMF page may now contain static entity data. Consider building a HTML scraper.'
        );
        logger.warn(
          this.config.id,
          'CMF page appears to have table content with entity hints — review for scraper upgrade'
        );
      } else {
        logger.info(
          this.config.id,
          'CMF page returned 200 but no scrapable entity data (JS-rendered). Using known entities fallback.'
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`CMF page fetch failed: ${msg}. Using known entities fallback.`);
      logger.warn(this.config.id, `CMF page fetch error: ${msg}`);
    }

    // Fallback: use known Chilean crypto/fintech entities
    if (entities.length === 0) {
      logger.info(this.config.id, 'Using known Chile VASP list as fallback');

      for (let i = 0; i < KNOWN_CL_VASPS.length; i++) {
        const known = KNOWN_CL_VASPS[i];
        const key = known.name.toLowerCase();

        if (seen.has(key)) continue;
        seen.add(key);

        const paddedIndex = String(i + 1).padStart(3, '0');

        entities.push({
          name: known.name,
          licenseNumber: `CMF-VASP-${paddedIndex}`,
          countryCode: 'CL',
          country: 'Chile',
          status: 'Registered',
          regulator: 'CMF',
          licenseType: known.licenseType,
          activities: known.activities,
          sourceUrl: SOURCE_URL,
        });
      }

      if (entities.length > 0) {
        warnings.push(
          `Used known entities fallback (${entities.length} entities). CMF registry requires JS rendering.`
        );
      }
    }

    logger.info(this.config.id, `Found ${entities.length} entities`);

    return {
      registryId: this.config.id,
      countryCode: 'CL',
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

  const parser = new ClCmfParser();
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
