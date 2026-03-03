/**
 * Lithuania Bank of Lithuania — MiCAR Crypto-Asset Service Providers
 *
 * Source: ESMA MiCAR CASP Register (CSV), filtered by LT
 */

import type { RegistryParser, ParserConfig, ParseResult } from '../core/types.js';
import { fetchEsmaCaspEntities } from '../core/esma-casp.js';
import { logger } from '../core/logger.js';

export class LtBolParser implements RegistryParser {
  config: ParserConfig = {
    id: 'lt-bol',
    name: 'Lithuania Bank of Lithuania Crypto-Asset Service Providers',
    countryCode: 'LT',
    country: 'Lithuania',
    regulator: 'Bank of Lithuania (Lietuvos bankas)',
    url: 'https://www.esma.europa.eu/',
    sourceType: 'csv',
    rateLimit: 10_000,
    needsProxy: false,
    needsBrowser: false,
  };

  async parse(): Promise<ParseResult> {
    const startTime = Date.now();
    logger.info(this.config.id, 'Fetching ESMA CASP register for LT...');
    const { entities, warnings } = await fetchEsmaCaspEntities('LT', this.config.id);
    for (const entity of entities) entity.regulator = 'Bank of Lithuania';
    logger.info(this.config.id, `Parsed ${entities.length} entities from ESMA register`);
    return {
      registryId: this.config.id, countryCode: 'LT', entities,
      totalFound: entities.length, durationMs: Date.now() - startTime,
      warnings, errors: [], timestamp: new Date().toISOString(),
    };
  }
}
