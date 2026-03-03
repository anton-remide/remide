/**
 * Poland KNF — MiCAR Crypto-Asset Service Providers
 *
 * Source: ESMA MiCAR CASP Register (CSV), filtered by PL
 */

import type { RegistryParser, ParserConfig, ParseResult } from '../core/types.js';
import { fetchEsmaCaspEntities } from '../core/esma-casp.js';
import { logger } from '../core/logger.js';

export class PlKnfParser implements RegistryParser {
  config: ParserConfig = {
    id: 'pl-knf',
    name: 'Poland KNF Crypto-Asset Service Providers',
    countryCode: 'PL',
    country: 'Poland',
    regulator: 'KNF (Komisja Nadzoru Finansowego)',
    url: 'https://www.esma.europa.eu/',
    sourceType: 'csv',
    rateLimit: 10_000,
    needsProxy: false,
    needsBrowser: false,
  };

  async parse(): Promise<ParseResult> {
    const startTime = Date.now();
    logger.info(this.config.id, 'Fetching ESMA CASP register for PL...');
    const { entities, warnings } = await fetchEsmaCaspEntities('PL', this.config.id);
    for (const entity of entities) entity.regulator = 'KNF';
    logger.info(this.config.id, `Parsed ${entities.length} entities from ESMA register`);
    return {
      registryId: this.config.id, countryCode: 'PL', entities,
      totalFound: entities.length, durationMs: Date.now() - startTime,
      warnings, errors: [], timestamp: new Date().toISOString(),
    };
  }
}
