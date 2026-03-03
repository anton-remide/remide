/**
 * Austria FMA — MiCAR Crypto-Asset Service Providers
 *
 * Source: ESMA MiCAR CASP Register (CSV), filtered by AT
 */

import type { RegistryParser, ParserConfig, ParseResult } from '../core/types.js';
import { fetchEsmaCaspEntities } from '../core/esma-casp.js';
import { logger } from '../core/logger.js';

export class AtFmaParser implements RegistryParser {
  config: ParserConfig = {
    id: 'at-fma',
    name: 'Austria FMA Crypto-Asset Service Providers',
    countryCode: 'AT',
    country: 'Austria',
    regulator: 'FMA (Finanzmarktaufsichtsbehörde)',
    url: 'https://www.esma.europa.eu/',
    sourceType: 'csv',
    rateLimit: 10_000,
    needsProxy: false,
    needsBrowser: false,
  };

  async parse(): Promise<ParseResult> {
    const startTime = Date.now();

    logger.info(this.config.id, 'Fetching ESMA CASP register for AT...');
    const { entities, warnings } = await fetchEsmaCaspEntities('AT', this.config.id);

    for (const entity of entities) {
      entity.regulator = 'FMA';
    }

    logger.info(this.config.id, `Parsed ${entities.length} entities from ESMA register`);

    return {
      registryId: this.config.id,
      countryCode: 'AT',
      entities,
      totalFound: entities.length,
      durationMs: Date.now() - startTime,
      warnings,
      errors: [],
      timestamp: new Date().toISOString(),
    };
  }
}
