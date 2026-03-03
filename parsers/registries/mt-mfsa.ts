/**
 * Malta MFSA — MiCAR Crypto-Asset Service Providers
 *
 * Source: ESMA MiCAR CASP Register (CSV), filtered by MT
 */

import type { RegistryParser, ParserConfig, ParseResult } from '../core/types.js';
import { fetchEsmaCaspEntities } from '../core/esma-casp.js';
import { logger } from '../core/logger.js';

export class MtMfsaParser implements RegistryParser {
  config: ParserConfig = {
    id: 'mt-mfsa',
    name: 'Malta MFSA Crypto-Asset Service Providers',
    countryCode: 'MT',
    country: 'Malta',
    regulator: 'MFSA (Malta Financial Services Authority)',
    url: 'https://www.esma.europa.eu/',
    sourceType: 'csv',
    rateLimit: 10_000,
    needsProxy: false,
    needsBrowser: false,
  };

  async parse(): Promise<ParseResult> {
    const startTime = Date.now();
    logger.info(this.config.id, 'Fetching ESMA CASP register for MT...');
    const { entities, warnings } = await fetchEsmaCaspEntities('MT', this.config.id);
    for (const entity of entities) entity.regulator = 'MFSA';
    logger.info(this.config.id, `Parsed ${entities.length} entities from ESMA register`);
    return {
      registryId: this.config.id, countryCode: 'MT', entities,
      totalFound: entities.length, durationMs: Date.now() - startTime,
      warnings, errors: [], timestamp: new Date().toISOString(),
    };
  }
}
