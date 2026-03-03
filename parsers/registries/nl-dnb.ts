/**
 * Netherlands DNB/AFM — Crypto-Asset Service Providers
 *
 * Source: ESMA MiCAR CASP Register (CSV), filtered by NL
 * As of 2025, supervision transferred from DNB to AFM under MiCA.
 * ~13+ entities
 */

import type { RegistryParser, ParserConfig, ParseResult } from '../core/types.js';
import { fetchEsmaCaspEntities } from '../core/esma-casp.js';
import { logger } from '../core/logger.js';

export class NlDnbParser implements RegistryParser {
  config: ParserConfig = {
    id: 'nl-dnb',
    name: 'Netherlands AFM/DNB Crypto-Asset Service Providers',
    countryCode: 'NL',
    country: 'Netherlands',
    regulator: 'AFM (Authority for the Financial Markets)',
    url: 'https://www.esma.europa.eu/',
    sourceType: 'csv',
    rateLimit: 10_000,
    needsProxy: false,
    needsBrowser: false,
  };

  async parse(): Promise<ParseResult> {
    const startTime = Date.now();

    logger.info(this.config.id, 'Fetching ESMA CASP register for NL...');
    const { entities, warnings } = await fetchEsmaCaspEntities('NL', this.config.id);

    // Override regulator
    for (const entity of entities) {
      entity.regulator = 'AFM';
    }

    logger.info(this.config.id, `Parsed ${entities.length} entities from ESMA register`);

    return {
      registryId: this.config.id,
      countryCode: 'NL',
      entities,
      totalFound: entities.length,
      durationMs: Date.now() - startTime,
      warnings,
      errors: [],
      timestamp: new Date().toISOString(),
    };
  }
}
