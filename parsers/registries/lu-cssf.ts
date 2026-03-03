/**
 * Luxembourg CSSF — MiCAR Crypto-Asset Service Providers
 *
 * Source: ESMA MiCAR CASP Register (CSV), filtered by LU
 */

import type { RegistryParser, ParserConfig, ParseResult } from '../core/types.js';
import { fetchEsmaCaspEntities } from '../core/esma-casp.js';
import { logger } from '../core/logger.js';

export class LuCssfParser implements RegistryParser {
  config: ParserConfig = {
    id: 'lu-cssf',
    name: 'Luxembourg CSSF Crypto-Asset Service Providers',
    countryCode: 'LU',
    country: 'Luxembourg',
    regulator: 'CSSF (Commission de Surveillance du Secteur Financier)',
    url: 'https://www.esma.europa.eu/',
    sourceType: 'csv',
    rateLimit: 10_000,
    needsProxy: false,
    needsBrowser: false,
  };

  async parse(): Promise<ParseResult> {
    const startTime = Date.now();

    logger.info(this.config.id, 'Fetching ESMA CASP register for LU...');
    const { entities, warnings } = await fetchEsmaCaspEntities('LU', this.config.id);

    for (const entity of entities) {
      entity.regulator = 'CSSF';
    }

    logger.info(this.config.id, `Parsed ${entities.length} entities from ESMA register`);

    return {
      registryId: this.config.id,
      countryCode: 'LU',
      entities,
      totalFound: entities.length,
      durationMs: Date.now() - startTime,
      warnings,
      errors: [],
      timestamp: new Date().toISOString(),
    };
  }
}
