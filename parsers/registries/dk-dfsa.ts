/**
 * Denmark Finanstilsynet — MiCAR Crypto-Asset Service Providers
 *
 * Source: ESMA MiCAR CASP Register (CSV), filtered by DK
 */

import type { RegistryParser, ParserConfig, ParseResult } from '../core/types.js';
import { fetchEsmaCaspEntities } from '../core/esma-casp.js';
import { logger } from '../core/logger.js';

export class DkDfsaParser implements RegistryParser {
  config: ParserConfig = {
    id: 'dk-dfsa',
    name: 'Denmark DFSA Crypto-Asset Service Providers',
    countryCode: 'DK',
    country: 'Denmark',
    regulator: 'Finanstilsynet (Danish FSA)',
    url: 'https://www.esma.europa.eu/',
    sourceType: 'csv',
    rateLimit: 10_000,
    needsProxy: false,
    needsBrowser: false,
  };

  async parse(): Promise<ParseResult> {
    const startTime = Date.now();
    logger.info(this.config.id, 'Fetching ESMA CASP register for DK...');
    const { entities, warnings } = await fetchEsmaCaspEntities('DK', this.config.id);
    for (const entity of entities) entity.regulator = 'Finanstilsynet';
    logger.info(this.config.id, `Parsed ${entities.length} entities from ESMA register`);
    return {
      registryId: this.config.id, countryCode: 'DK', entities,
      totalFound: entities.length, durationMs: Date.now() - startTime,
      warnings, errors: [], timestamp: new Date().toISOString(),
    };
  }
}
