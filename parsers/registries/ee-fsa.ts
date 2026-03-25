/**
 * Estonia Finantsinspektsioon — MiCAR Crypto-Asset Service Providers
 *
 * DEPRECATED: Covered by esma-unified parser. This parser is kept for backwards
 * compatibility but returns empty results to avoid redundant HTTP calls.
 */

import type { RegistryParser, ParserConfig, ParseResult } from '../core/types.js';

export class EeFsaParser implements RegistryParser {
  config: ParserConfig = {
    id: 'ee-fsa',
    name: 'Estonia FSA Crypto-Asset Service Providers',
    countryCode: 'EE',
    country: 'Estonia',
    regulator: 'Finantsinspektsioon (Estonian FSA)',
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