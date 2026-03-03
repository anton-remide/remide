/**
 * Spain CNMV — MiCAR Crypto-Asset Service Providers
 *
 * Source: ESMA MiCAR CASP Register (CSV), filtered by ES
 */

import type { RegistryParser, ParserConfig, ParseResult } from '../core/types.js';
import { fetchEsmaCaspEntities } from '../core/esma-casp.js';
import { logger } from '../core/logger.js';

export class EsCnmvParser implements RegistryParser {
  config: ParserConfig = {
    id: 'es-cnmv',
    name: 'Spain CNMV Crypto-Asset Service Providers',
    countryCode: 'ES',
    country: 'Spain',
    regulator: 'CNMV (Comisión Nacional del Mercado de Valores)',
    url: 'https://www.esma.europa.eu/',
    sourceType: 'csv',
    rateLimit: 10_000,
    needsProxy: false,
    needsBrowser: false,
  };

  async parse(): Promise<ParseResult> {
    const startTime = Date.now();

    logger.info(this.config.id, 'Fetching ESMA CASP register for ES...');
    const { entities, warnings } = await fetchEsmaCaspEntities('ES', this.config.id);

    for (const entity of entities) {
      entity.regulator = 'CNMV';
    }

    logger.info(this.config.id, `Parsed ${entities.length} entities from ESMA register`);

    return {
      registryId: this.config.id,
      countryCode: 'ES',
      entities,
      totalFound: entities.length,
      durationMs: Date.now() - startTime,
      warnings,
      errors: [],
      timestamp: new Date().toISOString(),
    };
  }
}
