/**
 * Norway Finanstilsynet — MiCAR Crypto-Asset Service Providers
 *
 * Source: ESMA MiCAR CASP Register (CSV), filtered by NO
 * Note: Norway is EEA, not EU, but participates in MiCA framework
 */

import type { RegistryParser, ParserConfig, ParseResult } from '../core/types.js';
import { fetchEsmaCaspEntities } from '../core/esma-casp.js';
import { logger } from '../core/logger.js';

export class NoFsaParser implements RegistryParser {
  config: ParserConfig = {
    id: 'no-fsa',
    name: 'Norway FSA Crypto-Asset Service Providers',
    countryCode: 'NO',
    country: 'Norway',
    regulator: 'Finanstilsynet (Norwegian FSA)',
    url: 'https://www.esma.europa.eu/',
    sourceType: 'csv',
    rateLimit: 10_000,
    needsProxy: false,
    needsBrowser: false,
  };

  async parse(): Promise<ParseResult> {
    const startTime = Date.now();
    logger.info(this.config.id, 'Fetching ESMA CASP register for NO...');
    const { entities, warnings } = await fetchEsmaCaspEntities('NO', this.config.id);
    for (const entity of entities) entity.regulator = 'Finanstilsynet';
    logger.info(this.config.id, `Parsed ${entities.length} entities from ESMA register`);
    return {
      registryId: this.config.id, countryCode: 'NO', entities,
      totalFound: entities.length, durationMs: Date.now() - startTime,
      warnings, errors: [], timestamp: new Date().toISOString(),
    };
  }
}
