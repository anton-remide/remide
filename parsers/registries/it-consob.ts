/**
 * Italy CONSOB — MiCAR Crypto-Asset Service Providers
 *
 * Source: ESMA MiCAR CASP Register (CSV), filtered by IT
 */

import type { RegistryParser, ParserConfig, ParseResult } from '../core/types.js';
import { fetchEsmaCaspEntities } from '../core/esma-casp.js';
import { logger } from '../core/logger.js';

export class ItConsobParser implements RegistryParser {
  config: ParserConfig = {
    id: 'it-consob',
    name: 'Italy CONSOB Crypto-Asset Service Providers',
    countryCode: 'IT',
    country: 'Italy',
    regulator: 'CONSOB (Commissione Nazionale per le Società e la Borsa)',
    url: 'https://www.esma.europa.eu/',
    sourceType: 'csv',
    rateLimit: 10_000,
    needsProxy: false,
    needsBrowser: false,
  };

  async parse(): Promise<ParseResult> {
    const startTime = Date.now();

    logger.info(this.config.id, 'Fetching ESMA CASP register for IT...');
    const { entities, warnings } = await fetchEsmaCaspEntities('IT', this.config.id);

    for (const entity of entities) {
      entity.regulator = 'CONSOB';
    }

    logger.info(this.config.id, `Parsed ${entities.length} entities from ESMA register`);

    return {
      registryId: this.config.id,
      countryCode: 'IT',
      entities,
      totalFound: entities.length,
      durationMs: Date.now() - startTime,
      warnings,
      errors: [],
      timestamp: new Date().toISOString(),
    };
  }
}
