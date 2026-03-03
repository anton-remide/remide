/**
 * Sweden Finansinspektionen — MiCAR Crypto-Asset Service Providers
 *
 * Source: ESMA MiCAR CASP Register (CSV), filtered by SE
 */

import type { RegistryParser, ParserConfig, ParseResult } from '../core/types.js';
import { fetchEsmaCaspEntities } from '../core/esma-casp.js';
import { logger } from '../core/logger.js';

export class SeFiParser implements RegistryParser {
  config: ParserConfig = {
    id: 'se-fi',
    name: 'Sweden Finansinspektionen Crypto-Asset Service Providers',
    countryCode: 'SE',
    country: 'Sweden',
    regulator: 'Finansinspektionen (Swedish FSA)',
    url: 'https://www.esma.europa.eu/',
    sourceType: 'csv',
    rateLimit: 10_000,
    needsProxy: false,
    needsBrowser: false,
  };

  async parse(): Promise<ParseResult> {
    const startTime = Date.now();
    logger.info(this.config.id, 'Fetching ESMA CASP register for SE...');
    const { entities, warnings } = await fetchEsmaCaspEntities('SE', this.config.id);
    for (const entity of entities) entity.regulator = 'Finansinspektionen';
    logger.info(this.config.id, `Parsed ${entities.length} entities from ESMA register`);
    return {
      registryId: this.config.id, countryCode: 'SE', entities,
      totalFound: entities.length, durationMs: Date.now() - startTime,
      warnings, errors: [], timestamp: new Date().toISOString(),
    };
  }
}
