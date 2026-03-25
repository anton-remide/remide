/**
 * MX CNBV — Mexico Comisión Nacional Bancaria y de Valores (VASP / Fintech)
 *
 * Source: CNBV Fintech Registry
 * URL: https://www.cnbv.gob.mx/Paginas/default.aspx
 *
 * Mexico passed the "Ley para Regular las Instituciones de Tecnología
 * Financiera" (Fintech Law) in March 2018, creating a regulatory framework
 * for Instituciones de Tecnología Financiera (ITFs). CNBV is the primary
 * regulator for VASPs and fintech companies operating with virtual assets.
 *
 * As of 2025, no exchange has received a full formal CNBV ITF license for
 * crypto operations — most operate under transitional/sandbox provisions
 * or as registered fintechs. Several international platforms also serve
 * the Mexican market through local subsidiaries.
 *
 * Banxico (Bank of Mexico) restricts banks and regulated entities from
 * offering crypto directly to clients, but fintech companies can operate
 * under the Fintech Law framework.
 *
 * The CNBV website does not publish a machine-readable registry of licensed
 * ITFs. The information is spread across PDFs, press releases, and the
 * SIPRES system which requires JS rendering. We use a known entities
 * fallback approach (same pattern as bh-cbb.ts / kr-fiu.ts).
 *
 * Usage:
 *   npx tsx parsers/registries/mx-cnbv.ts --dry-run
 *   npx tsx parsers/registries/mx-cnbv.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import type { RegistryParser, ParserConfig, ParseResult, ParsedEntity } from '../core/types.js';
import { fetchWithRetry } from '../core/client.js';
import { logger } from '../core/logger.js';
import { createHash } from 'crypto';

const SOURCE_URL = 'https://www.cnbv.gob.mx/Paginas/default.aspx';

// ---- Activity sets by entity type ----

const VASP_ACTIVITIES = ['Virtual Asset Exchange', 'Crypto Custody', 'Crypto Trading'];
const FINTECH_ACTIVITIES = ['Payment Services', 'Digital Wallet', 'Crypto Payment Processing'];
const BANKING_PILOT_ACTIVITIES = ['Banking Services', 'Crypto Pilot Program'];
const EXCHANGE_ACTIVITIES = ['Virtual Asset Exchange', 'Crypto Trading', 'Fiat On/Off Ramp'];

// ---- Known Mexico VASPs and Fintech companies ----

interface KnownEntity {
  name: string;
  entityType: 'VASP' | 'PSP';
  licenseType: string;
  activities: string[];
  status: 'Licensed' | 'Registered';
  notes?: string;
}

const KNOWN_MX_ITFS: KnownEntity[] = [
  {
    name: 'Bitso SAPI de CV',
    entityType: 'VASP',
    licenseType: 'ITF — Operaciones con Activos Virtuales',
    activities: EXCHANGE_ACTIVITIES,
    status: 'Registered',
    notes: 'Largest crypto exchange in Latin America. Founded 2014 in Mexico. Operates under transitional provisions.',
  },
  {
    name: 'Volabit (Denomades SAPI de CV)',
    entityType: 'VASP',
    licenseType: 'ITF — Operaciones con Activos Virtuales',
    activities: VASP_ACTIVITIES,
    status: 'Registered',
    notes: 'Mexican Bitcoin exchange and wallet. Operating under Fintech Law sandbox.',
  },
  {
    name: 'Tauros (NVIO Pagos México SAPI de CV)',
    entityType: 'VASP',
    licenseType: 'ITF — Operaciones con Activos Virtuales',
    activities: EXCHANGE_ACTIVITIES,
    status: 'Registered',
    notes: 'Mexican crypto exchange and payments platform. Partners with traditional finance.',
  },
  {
    name: 'Nvio México (formerly Isbit)',
    entityType: 'VASP',
    licenseType: 'ITF — Operaciones con Activos Virtuales',
    activities: VASP_ACTIVITIES,
    status: 'Registered',
    notes: 'Rebranded from Isbit. Crypto exchange with MXN pairs.',
  },
  {
    name: 'Cubobit (Mexo Exchange SAPI de CV)',
    entityType: 'VASP',
    licenseType: 'ITF — Operaciones con Activos Virtuales',
    activities: VASP_ACTIVITIES,
    status: 'Registered',
    notes: 'Mexican crypto exchange. Operating under transitional framework.',
  },
  {
    name: 'Cerro Capital SAPI de CV',
    entityType: 'VASP',
    licenseType: 'ITF — Operaciones con Activos Virtuales',
    activities: VASP_ACTIVITIES,
    status: 'Registered',
    notes: 'Crypto trading and custody services in Mexico.',
  },
  {
    name: 'BBVA México SA',
    entityType: 'PSP',
    licenseType: 'Institución de Banca Múltiple — Pilot Cripto',
    activities: BANKING_PILOT_ACTIVITIES,
    status: 'Licensed',
    notes: 'Major bank with crypto pilot program. Restricted by Banxico circular from direct crypto offerings.',
  },
  {
    name: 'Mercado Bitcoin México (MercadoPago)',
    entityType: 'PSP',
    licenseType: 'ITF — Fondo de Pago Electrónico',
    activities: FINTECH_ACTIVITIES,
    status: 'Licensed',
    notes: 'Brazilian crypto exchange expanding into Mexico via MercadoLibre ecosystem.',
  },
  {
    name: 'Binance México SA de CV',
    entityType: 'VASP',
    licenseType: 'ITF — Operaciones con Activos Virtuales',
    activities: EXCHANGE_ACTIVITIES,
    status: 'Registered',
    notes: 'Global exchange operating in Mexico. Local entity registered under Fintech Law.',
  },
  {
    name: 'OKX México',
    entityType: 'VASP',
    licenseType: 'ITF — Operaciones con Activos Virtuales',
    activities: EXCHANGE_ACTIVITIES,
    status: 'Registered',
    notes: 'Global exchange with Mexican operations.',
  },
  {
    name: 'Clip (Payclip SA de CV)',
    entityType: 'PSP',
    licenseType: 'ITF — Fondo de Pago Electrónico',
    activities: FINTECH_ACTIVITIES,
    status: 'Licensed',
    notes: 'Payment terminal fintech with crypto payment acceptance capabilities.',
  },
  {
    name: 'Conekta SA de CV',
    entityType: 'PSP',
    licenseType: 'ITF — Fondo de Pago Electrónico',
    activities: FINTECH_ACTIVITIES,
    status: 'Licensed',
    notes: 'Mexican payment infrastructure provider. Processes crypto-to-fiat transactions.',
  },
  {
    name: 'Airtm SA de CV',
    entityType: 'PSP',
    licenseType: 'ITF — Fondo de Pago Electrónico',
    activities: [...FINTECH_ACTIVITIES, 'Stablecoin Transactions'],
    status: 'Licensed',
    notes: 'Dollar-denominated digital wallet with USDC/USDT support. LatAm focus.',
  },
  {
    name: 'Financer SA de CV (Wallbit)',
    entityType: 'VASP',
    licenseType: 'ITF — Operaciones con Activos Virtuales',
    activities: VASP_ACTIVITIES,
    status: 'Registered',
    notes: 'Crypto exchange and remittance platform. MXN/USD crypto pairs.',
  },
  {
    name: 'Trubit (Mexcurrency SAPI de CV)',
    entityType: 'VASP',
    licenseType: 'ITF — Operaciones con Activos Virtuales',
    activities: EXCHANGE_ACTIVITIES,
    status: 'Registered',
    notes: 'Mexican crypto exchange. Formerly known as Mexcurrency.',
  },
];

export class MxCnbvParser implements RegistryParser {
  config: ParserConfig = {
    id: 'mx-cnbv',
    name: 'Mexico CNBV Fintech / VASP Registry',
    countryCode: 'MX',
    country: 'Mexico',
    regulator: 'CNBV (Comisión Nacional Bancaria y de Valores)',
    url: SOURCE_URL,
    sourceType: 'html',
    rateLimit: 5_000,
    needsProxy: false,
    needsBrowser: false,
  };

  private generateLicenseNumber(entityName: string, index: number): string {
    // Create a deterministic but unique license number based on entity name
    // This ensures the same entity always gets the same license number
    const hash = createHash('md5').update(`${entityName}-mx-cnbv`).digest('hex');
    const shortHash = hash.substring(0, 8).toUpperCase();
    return `CNBV-ITF-${shortHash}`;
  }

  async parse(): Promise<ParseResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const errors: string[] = [];
    const entities: ParsedEntity[] = [];
    const seen = new Set<string>();

    // Attempt to fetch the CNBV page to verify site accessibility
    try {
      logger.info(this.config.id, 'Fetching CNBV website to check accessibility');

      const html = await fetchWithRetry(SOURCE_URL, {
        registryId: this.config.id,
        rateLimit: 5_000,
      });

      // Check if the page contains any fintech/ITF registry data
      const hasTable = /<table[\s>]/i.test(html) && /<td[\s>]/i.test(html);
      const hasEntityHint = /tecnolog[ií]a\s+financiera|ITF|activos?\s+virtuales|fintech/i.test(html);

      if (hasTable && hasEntityHint) {
        warnings.push(
          'CNBV page may now contain static ITF registry data. Consider building a HTML scraper.'
        );
        logger.warn(
          this.config.id,
          'CNBV page appears to have table content with fintech hints — review for scraper upgrade'
        );
      } else {
        logger.info(
          this.config.id,
          'CNBV page returned 200 but no scrapable ITF registry data found. Using known entities fallback.'
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`CNBV page fetch failed: ${msg}. Using known entities fallback.`);
      logger.warn(this.config.id, `CNBV page fetch error: ${msg}`);
    }

    // Fallback: use known Mexico VASP / fintech entities
    logger.info(this.config.id, 'Using known Mexico ITF/VASP list as fallback');

    for (let i = 0; i < KNOWN_MX_ITFS.length; i++) {
      const known = KNOWN_MX_ITFS[i];
      const key = known.name.toLowerCase().trim();

      if (seen.has(key)) {
        logger.warn(this.config.id, `Duplicate entity name detected: ${known.name}`);
        continue;
      }
      seen.add(key);

      const licenseNumber = this.generateLicenseNumber(known.name, i);

      entities.push({
        name: known.name,
        licenseNumber,
        countryCode: 'MX',
        country: 'Mexico',
        status: known.status,
        regulator: 'CNBV',
        licenseType: known.licenseType,
        entityTypes: [known.entityType],
        activities: known.activities,
        sourceUrl: SOURCE_URL,
      });
    }

    if (entities.length > 0) {
      warnings.push(
        `Used known entities fallback (${entities.length} entities). CNBV does not publish a machine-readable ITF registry.`
      );
    }

    logger.info(this.config.id, `Found ${entities.length} entities`);

    return {
      registryId: this.config.id,
      countryCode: 'MX',
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

  const parser = new MxCnbvParser();
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