/**
 * Germany BaFin — Crypto-Asset Service Providers
 *
 * Source: ESMA MiCAR CASP Register (CSV), filtered by DE
 * Also covers old KWG Kryptoverwahrgeschäft entities that transitioned to MiCA.
 * ~18+ entities
 */

import type { RegistryParser, ParserConfig, ParseResult } from '../core/types.js';
import { fetchEsmaCaspEntities } from '../core/esma-casp.js';
import { logger } from '../core/logger.js';

export class DeBafinParser implements RegistryParser {
  config: ParserConfig = {
    id: 'de-bafin',
    name: 'Germany BaFin Crypto-Asset Service Providers',
    countryCode: 'DE',
    country: 'Germany',
    regulator: 'BaFin (Federal Financial Supervisory Authority)',
    url: 'https://www.esma.europa.eu/',
    sourceType: 'csv',
    rateLimit: 10_000,
    needsProxy: false,
    needsBrowser: false,
  };

  async parse(): Promise<ParseResult> {
    const startTime = Date.now();

    logger.info(this.config.id, 'Fetching ESMA CASP register for DE...');
    const { entities, warnings } = await fetchEsmaCaspEntities('DE', this.config.id);

    // Override regulator name to be consistent
    for (const entity of entities) {
      entity.regulator = 'BaFin';
    }

    logger.info(this.config.id, `Parsed ${entities.length} entities from ESMA register`);

    return {
      registryId: this.config.id,
      countryCode: 'DE',
      entities,
      totalFound: entities.length,
      durationMs: Date.now() - startTime,
      warnings,
      errors: [],
      timestamp: new Date().toISOString(),
    };
  }
}
