/**
 * Belgium FSMA — MiCAR Crypto-Asset Service Providers
 *
 * Source: ESMA MiCAR CASP Register (CSV), filtered by BE
 */

import type { RegistryParser, ParserConfig, ParseResult } from '../core/types.js';
import { fetchEsmaCaspEntities } from '../core/esma-casp.js';
import { logger } from '../core/logger.js';

export class BeFsmaParser implements RegistryParser {
  config: ParserConfig = {
    id: 'be-fsma',
    name: 'Belgium FSMA Crypto-Asset Service Providers',
    countryCode: 'BE',
    country: 'Belgium',
    regulator: 'FSMA (Financial Services and Markets Authority)',
    url: 'https://www.esma.europa.eu/',
    sourceType: 'csv',
    rateLimit: 10_000,
    needsProxy: false,
    needsBrowser: false,
  };

  async parse(): Promise<ParseResult> {
    const startTime = Date.now();

    logger.info(this.config.id, 'Fetching ESMA CASP register for BE...');
    const { entities, warnings } = await fetchEsmaCaspEntities('BE', this.config.id);

    for (const entity of entities) {
      entity.regulator = 'FSMA';
    }

    logger.info(this.config.id, `Parsed ${entities.length} entities from ESMA register`);

    return {
      registryId: this.config.id,
      countryCode: 'BE',
      entities,
      totalFound: entities.length,
      durationMs: Date.now() - startTime,
      warnings,
      errors: [],
      timestamp: new Date().toISOString(),
    };
  }
}
