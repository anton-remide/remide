/**
 * France AMF — Digital Asset Service Providers (DASP / PSAN)
 *
 * Source: ESMA MiCAR CASP Register (CSV), filtered by FR
 * Previously "Prestataires de Services sur Actifs Numériques" (PSAN),
 * now MiCA-authorized CASPs.
 * ~18+ entities
 */

import type { RegistryParser, ParserConfig, ParseResult } from '../core/types.js';
import { fetchEsmaCaspEntities } from '../core/esma-casp.js';
import { logger } from '../core/logger.js';

export class FrAmfParser implements RegistryParser {
  config: ParserConfig = {
    id: 'fr-amf',
    name: 'France AMF Digital Asset Service Providers',
    countryCode: 'FR',
    country: 'France',
    regulator: 'AMF (Autorité des Marchés Financiers)',
    url: 'https://www.esma.europa.eu/',
    sourceType: 'csv',
    rateLimit: 10_000,
    needsProxy: false,
    needsBrowser: false,
  };

  async parse(): Promise<ParseResult> {
    const startTime = Date.now();

    logger.info(this.config.id, 'Fetching ESMA CASP register for FR...');
    const { entities, warnings } = await fetchEsmaCaspEntities('FR', this.config.id);

    // Override regulator name
    for (const entity of entities) {
      entity.regulator = 'AMF';
    }

    logger.info(this.config.id, `Parsed ${entities.length} entities from ESMA register`);

    return {
      registryId: this.config.id,
      countryCode: 'FR',
      entities,
      totalFound: entities.length,
      durationMs: Date.now() - startTime,
      warnings,
      errors: [],
      timestamp: new Date().toISOString(),
    };
  }
}
