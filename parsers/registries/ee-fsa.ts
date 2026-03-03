/**
 * Estonia Finantsinspektsioon — MiCAR Crypto-Asset Service Providers
 *
 * Source: ESMA MiCAR CASP Register (CSV), filtered by EE
 */

import type { RegistryParser, ParserConfig, ParseResult } from '../core/types.js';
import { fetchEsmaCaspEntities } from '../core/esma-casp.js';
import { logger } from '../core/logger.js';

export class EeFsaParser implements RegistryParser {
  config: ParserConfig = {
    id: 'ee-fsa',
    name: 'Estonia FSA Crypto-Asset Service Providers',
    countryCode: 'EE',
    country: 'Estonia',
    regulator: 'Finantsinspektsioon (Estonian FSA)',
    url: 'https://www.esma.europa.eu/',
    sourceType: 'csv',
    rateLimit: 10_000,
    needsProxy: false,
    needsBrowser: false,
  };

  async parse(): Promise<ParseResult> {
    const startTime = Date.now();
    logger.info(this.config.id, 'Fetching ESMA CASP register for EE...');
    const { entities, warnings } = await fetchEsmaCaspEntities('EE', this.config.id);
    for (const entity of entities) entity.regulator = 'Finantsinspektsioon';
    logger.info(this.config.id, `Parsed ${entities.length} entities from ESMA register`);
    return {
      registryId: this.config.id, countryCode: 'EE', entities,
      totalFound: entities.length, durationMs: Date.now() - startTime,
      warnings, errors: [], timestamp: new Date().toISOString(),
    };
  }
}
