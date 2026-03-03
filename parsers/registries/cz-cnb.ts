/**
 * Czech Republic CNB — MiCAR Crypto-Asset Service Providers
 *
 * Source: ESMA MiCAR CASP Register (CSV), filtered by CZ
 */

import type { RegistryParser, ParserConfig, ParseResult } from '../core/types.js';
import { fetchEsmaCaspEntities } from '../core/esma-casp.js';
import { logger } from '../core/logger.js';

export class CzCnbParser implements RegistryParser {
  config: ParserConfig = {
    id: 'cz-cnb',
    name: 'Czech Republic CNB Crypto-Asset Service Providers',
    countryCode: 'CZ',
    country: 'Czech Republic',
    regulator: 'CNB (Česká národní banka)',
    url: 'https://www.esma.europa.eu/',
    sourceType: 'csv',
    rateLimit: 10_000,
    needsProxy: false,
    needsBrowser: false,
  };

  async parse(): Promise<ParseResult> {
    const startTime = Date.now();
    logger.info(this.config.id, 'Fetching ESMA CASP register for CZ...');
    const { entities, warnings } = await fetchEsmaCaspEntities('CZ', this.config.id);
    for (const entity of entities) entity.regulator = 'CNB';
    logger.info(this.config.id, `Parsed ${entities.length} entities from ESMA register`);
    return {
      registryId: this.config.id, countryCode: 'CZ', entities,
      totalFound: entities.length, durationMs: Date.now() - startTime,
      warnings, errors: [], timestamp: new Date().toISOString(),
    };
  }
}
