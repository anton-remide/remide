/**
 * Italy CONSOB — MiCAR Crypto-Asset Service Providers
 *
 * DEPRECATED: Covered by esma-unified parser. This parser is kept for backwards
 * compatibility but returns empty results to avoid redundant HTTP calls.
 */

import type { RegistryParser, ParserConfig, ParseResult } from '../core/types.js';

export class ItConsobParser implements RegistryParser {
  config: ParserConfig = {
    id: 'it-consob',
    name: 'Italy CONSOB Crypto-Asset Service Providers',
    countryCode: 'IT',
    country: 'Italy',
    regulator: 'CONSOB (Commissione Nazionale per le Società e la Borsa)',
    url: 'https://www.esma.europa.eu/',
    sourceType: 'csv',
    rateLimit: 10_000,
    needsProxy: false,
    needsBrowser: false,
  };

  async parse(): Promise<ParseResult> {
    console.log(`[${this.config.id}] DEPRECATED: Covered by esma-unified parser. Skipping.`);
    return {
      registryId: this.config.id,
      countryCode: this.config.countryCode,
      entities: [],
      totalFound: 0,
      durationMs: 0,
      warnings: ['Deprecated: use esma-unified instead'],
      errors: [],
      timestamp: new Date().toISOString(),
    };
  }
}
