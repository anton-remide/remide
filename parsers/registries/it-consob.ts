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
    url: 'https://www.consob.it/',
    sourceType: 'csv',
    rateLimit: 10_000,
    needsProxy: false,
    needsBrowser: false,
  };

  async parse(): Promise<ParseResult> {
    const startTime = Date.now();
    
    console.log(`[${this.config.id}] DEPRECATED: This parser has been superseded by esma-unified parser.`);
    console.log(`[${this.config.id}] Italy CONSOB MiCAR data is now available through the unified ESMA registry.`);
    console.log(`[${this.config.id}] Returning empty results to maintain backwards compatibility.`);
    
    const durationMs = Date.now() - startTime;
    
    return {
      registryId: this.config.id,
      countryCode: this.config.countryCode,
      entities: [],
      totalFound: 0,
      durationMs,
      warnings: [
        'DEPRECATED: This parser has been superseded by esma-unified parser',
        'Italy CONSOB MiCAR data is now available through the unified ESMA registry',
        'This parser returns empty results to maintain backwards compatibility'
      ],
      errors: [],
      timestamp: new Date().toISOString(),
    };
  }
}