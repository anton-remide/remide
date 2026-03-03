/**
 * Ireland CBI — MiCAR Crypto-Asset Service Providers
 *
 * Source: ESMA MiCAR CASP Register (CSV), filtered by IE
 */

import type { RegistryParser, ParserConfig, ParseResult } from '../core/types.js';
import { fetchEsmaCaspEntities } from '../core/esma-casp.js';
import { logger } from '../core/logger.js';

export class IeCbiParser implements RegistryParser {
  config: ParserConfig = {
    id: 'ie-cbi',
    name: 'Ireland CBI Crypto-Asset Service Providers',
    countryCode: 'IE',
    country: 'Ireland',
    regulator: 'CBI (Central Bank of Ireland)',
    url: 'https://www.esma.europa.eu/',
    sourceType: 'csv',
    rateLimit: 10_000,
    needsProxy: false,
    needsBrowser: false,
  };

  async parse(): Promise<ParseResult> {
    const startTime = Date.now();

    logger.info(this.config.id, 'Fetching ESMA CASP register for IE...');
    const { entities, warnings } = await fetchEsmaCaspEntities('IE', this.config.id);

    for (const entity of entities) {
      entity.regulator = 'CBI';
    }

    logger.info(this.config.id, `Parsed ${entities.length} entities from ESMA register`);

    return {
      registryId: this.config.id,
      countryCode: 'IE',
      entities,
      totalFound: entities.length,
      durationMs: Date.now() - startTime,
      warnings,
      errors: [],
      timestamp: new Date().toISOString(),
    };
  }
}
