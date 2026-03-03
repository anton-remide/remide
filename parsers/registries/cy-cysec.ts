/**
 * Cyprus CySEC — MiCAR Crypto-Asset Service Providers
 *
 * Source: ESMA MiCAR CASP Register (CSV), filtered by CY
 */

import type { RegistryParser, ParserConfig, ParseResult } from '../core/types.js';
import { fetchEsmaCaspEntities } from '../core/esma-casp.js';
import { logger } from '../core/logger.js';

export class CyCysecParser implements RegistryParser {
  config: ParserConfig = {
    id: 'cy-cysec',
    name: 'Cyprus CySEC Crypto-Asset Service Providers',
    countryCode: 'CY',
    country: 'Cyprus',
    regulator: 'CySEC (Cyprus Securities and Exchange Commission)',
    url: 'https://www.esma.europa.eu/',
    sourceType: 'csv',
    rateLimit: 10_000,
    needsProxy: false,
    needsBrowser: false,
  };

  async parse(): Promise<ParseResult> {
    const startTime = Date.now();
    logger.info(this.config.id, 'Fetching ESMA CASP register for CY...');
    const { entities, warnings } = await fetchEsmaCaspEntities('CY', this.config.id);
    for (const entity of entities) entity.regulator = 'CySEC';
    logger.info(this.config.id, `Parsed ${entities.length} entities from ESMA register`);
    return {
      registryId: this.config.id, countryCode: 'CY', entities,
      totalFound: entities.length, durationMs: Date.now() - startTime,
      warnings, errors: [], timestamp: new Date().toISOString(),
    };
  }
}
