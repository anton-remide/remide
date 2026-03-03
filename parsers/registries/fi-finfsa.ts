/**
 * Finland FIN-FSA — MiCAR Crypto-Asset Service Providers
 *
 * Source: ESMA MiCAR CASP Register (CSV), filtered by FI
 */

import type { RegistryParser, ParserConfig, ParseResult } from '../core/types.js';
import { fetchEsmaCaspEntities } from '../core/esma-casp.js';
import { logger } from '../core/logger.js';

export class FiFinfsaParser implements RegistryParser {
  config: ParserConfig = {
    id: 'fi-finfsa',
    name: 'Finland FIN-FSA Crypto-Asset Service Providers',
    countryCode: 'FI',
    country: 'Finland',
    regulator: 'FIN-FSA (Finanssivalvonta)',
    url: 'https://www.esma.europa.eu/',
    sourceType: 'csv',
    rateLimit: 10_000,
    needsProxy: false,
    needsBrowser: false,
  };

  async parse(): Promise<ParseResult> {
    const startTime = Date.now();
    logger.info(this.config.id, 'Fetching ESMA CASP register for FI...');
    const { entities, warnings } = await fetchEsmaCaspEntities('FI', this.config.id);
    for (const entity of entities) entity.regulator = 'FIN-FSA';
    logger.info(this.config.id, `Parsed ${entities.length} entities from ESMA register`);
    return {
      registryId: this.config.id, countryCode: 'FI', entities,
      totalFound: entities.length, durationMs: Date.now() - startTime,
      warnings, errors: [], timestamp: new Date().toISOString(),
    };
  }
}
