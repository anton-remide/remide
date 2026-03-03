/**
 * Portugal CMVM — MiCAR Crypto-Asset Service Providers
 *
 * Source: ESMA MiCAR CASP Register (CSV), filtered by PT
 */

import type { RegistryParser, ParserConfig, ParseResult } from '../core/types.js';
import { fetchEsmaCaspEntities } from '../core/esma-casp.js';
import { logger } from '../core/logger.js';

export class PtCmvmParser implements RegistryParser {
  config: ParserConfig = {
    id: 'pt-cmvm',
    name: 'Portugal CMVM Crypto-Asset Service Providers',
    countryCode: 'PT',
    country: 'Portugal',
    regulator: 'CMVM (Comissão do Mercado de Valores Mobiliários)',
    url: 'https://www.esma.europa.eu/',
    sourceType: 'csv',
    rateLimit: 10_000,
    needsProxy: false,
    needsBrowser: false,
  };

  async parse(): Promise<ParseResult> {
    const startTime = Date.now();

    logger.info(this.config.id, 'Fetching ESMA CASP register for PT...');
    const { entities, warnings } = await fetchEsmaCaspEntities('PT', this.config.id);

    for (const entity of entities) {
      entity.regulator = 'CMVM';
    }

    logger.info(this.config.id, `Parsed ${entities.length} entities from ESMA register`);

    return {
      registryId: this.config.id,
      countryCode: 'PT',
      entities,
      totalFound: entities.length,
      durationMs: Date.now() - startTime,
      warnings,
      errors: [],
      timestamp: new Date().toISOString(),
    };
  }
}
