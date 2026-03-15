/**
 * Tests for Quality Worker rules engine.
 *
 * Pure-function tests — no mocks, no network, no Supabase.
 */

import { describe, it, expect } from 'vitest';
import {
  cleanName,
  detectGarbage,
  classifyCryptoStatus,
  calculateScore,
  processEntity,
  type QualityInput,
} from '../rules';

function makeInput(overrides: Partial<QualityInput> = {}): QualityInput {
  return {
    id: 'test-1',
    name: 'Coinbase',
    country_code: 'US',
    license_number: 'MSB-31000180780458',
    license_type: 'Money Services Business',
    entity_types: ['Exchange'],
    activities: ['Virtual Currency exchange'],
    status: 'Licensed',
    regulator: 'FinCEN',
    website: 'https://coinbase.com',
    description: 'Digital asset exchange platform',
    linkedin_url: 'https://linkedin.com/company/coinbase',
    parser_id: 'us-fincen',
    crypto_status: 'unknown',
    is_garbage: false,
    quality_score: 0,
    ...overrides,
  };
}

// ── cleanName ──

describe('cleanName', () => {
  it('removes legal suffixes like (Pty) Ltd, GmbH, Inc.', () => {
    expect(cleanName('Coinbase Inc.')).toBe('Coinbase');
    expect(cleanName('VALR (Pty) Ltd')).toBe('Valr');
    expect(cleanName('Deutsche Krypto GmbH')).toBe('Deutsche Krypto');
  });

  it('trims whitespace and collapses multiple spaces', () => {
    expect(cleanName('  Coinbase   Exchange  ')).toBe('Coinbase Exchange');
  });

  it('handles ALL-CAPS names (Italian/French registries)', () => {
    const result = cleanName('SOCIETE GENERALE PARIS');
    expect(result).not.toBe('SOCIETE GENERALE PARIS');
    expect(result.charAt(0)).toBe('S');
  });

  it('preserves known acronyms', () => {
    const result = cleanName('GMO INTERNET GROUP');
    expect(result).toContain('GMO');
  });

  it('removes noise prefixes (numbered lists, bullets)', () => {
    expect(cleanName('1. Coinbase')).toBe('Coinbase');
    expect(cleanName('• Kraken')).toBe('Kraken');
  });

  it('strips f/k/a clauses', () => {
    expect(cleanName('Block, Inc., f/k/a Square, Inc.')).toBe('Block');
  });

  it('strips DBA/trading-as clauses', () => {
    expect(cleanName('Moon Inc. d/b/a LibertyX')).toBe('Moon');
  });

  it('returns trimmed original if cleaned result is too short', () => {
    expect(cleanName('A')).toBe('A');
  });

  it('removes international legal suffixes (TR, BR, RU, JP)', () => {
    expect(cleanName('Borsa Istanbul A.Ş.')).toBe('Borsa Istanbul');
    expect(cleanName('Mercado Bitcoin Ltda.')).toBe('Mercado Bitcoin');
    expect(cleanName('Digital Exchange K.K.')).toBe('Digital Exchange');
  });

  it('removes Pvt Ltd (Indian)', () => {
    expect(cleanName('CoinDCX Pvt. Ltd.')).toBe('CoinDCX');
  });

  it('removes FZ-LLC (Emirati)', () => {
    expect(cleanName('Binance FZ-LLC')).toBe('Binance');
  });
});

// ── detectGarbage ──

describe('detectGarbage', () => {
  it('flags names that are too short', () => {
    const result = detectGarbage(makeInput({ name: 'X' }));
    expect(result.isGarbage).toBe(true);
    expect(result.reason).toContain('name_too_short');
  });

  it('flags names that are too long', () => {
    const result = detectGarbage(makeInput({ name: 'A'.repeat(250) }));
    expect(result.isGarbage).toBe(true);
    expect(result.reason).toContain('name_too_long');
  });

  it('flags boilerplate names', () => {
    for (const name of ['N/A', 'not applicable', 'test', 'unknown']) {
      const result = detectGarbage(makeInput({ name }));
      expect(result.isGarbage).toBe(true);
    }
  });

  it('flags pure numbers and date patterns', () => {
    expect(detectGarbage(makeInput({ name: '2024-01-15' })).isGarbage).toBe(true);
    expect(detectGarbage(makeInput({ name: '12345678' })).isGarbage).toBe(true);
  });

  it('flags numbered companies (Canadian shell corps)', () => {
    expect(detectGarbage(makeInput({ name: '1000224522 ONTARIO INC.' })).isGarbage).toBe(true);
  });

  it('flags personal names (sole proprietors)', () => {
    expect(detectGarbage(makeInput({ name: 'Marek Kowalski' })).isGarbage).toBe(true);
  });

  it('flags insurance/pension activities as out of scope', () => {
    const result = detectGarbage(makeInput({ activities: ['Insurance Brokerage'] }));
    expect(result.isGarbage).toBe(true);
    expect(result.reason).toContain('out_of_scope');
  });

  it('passes valid company names', () => {
    expect(detectGarbage(makeInput({ name: 'Coinbase' })).isGarbage).toBe(false);
    expect(detectGarbage(makeInput({ name: 'Binance Holdings' })).isGarbage).toBe(false);
    expect(detectGarbage(makeInput({ name: '21Shares' })).isGarbage).toBe(false);
  });

  it('flags URLs-as-name and emails-as-name', () => {
    expect(detectGarbage(makeInput({ name: 'https://example.com/entity' })).isGarbage).toBe(true);
    expect(detectGarbage(makeInput({ name: 'info@company.com' })).isGarbage).toBe(true);
  });

  it('flags test/dummy entries', () => {
    expect(detectGarbage(makeInput({ name: 'Test Entity' })).isGarbage).toBe(true);
    expect(detectGarbage(makeInput({ name: 'DEMO' })).isGarbage).toBe(true);
  });
});

// ── classifyCryptoStatus ──

describe('classifyCryptoStatus', () => {
  it('returns confirmed_crypto for ESMA parsers', () => {
    expect(classifyCryptoStatus(makeInput({ parser_id: 'esma-de' }))).toBe('confirmed_crypto');
    expect(classifyCryptoStatus(makeInput({ parser_id: 'esma-unified' }))).toBe('confirmed_crypto');
  });

  it('returns traditional for EBA parsers', () => {
    expect(classifyCryptoStatus(makeInput({ parser_id: 'eba-pl' }))).toBe('traditional');
  });

  it('returns traditional for banking registries', () => {
    expect(classifyCryptoStatus(makeInput({ parser_id: 'us-fdic' }))).toBe('traditional');
  });

  it('classifies za-fsca as confirmed_crypto', () => {
    expect(classifyCryptoStatus(makeInput({ parser_id: 'za-fsca' }))).toBe('confirmed_crypto');
  });

  it('uses license type patterns for classification', () => {
    const vasp = makeInput({
      parser_id: null,
      license_type: 'Virtual Asset Service Provider',
      name: 'Some Company',
      activities: [],
      entity_types: [],
      description: null,
      website: null,
    });
    expect(classifyCryptoStatus(vasp)).toBe('confirmed_crypto');
  });

  it('uses website domain as weak crypto signal', () => {
    const domainEntity = makeInput({
      parser_id: null,
      name: 'Some Company',
      activities: [],
      entity_types: [],
      license_type: null,
      description: null,
      website: 'https://bitexchange.io',
    });
    expect(classifyCryptoStatus(domainEntity)).toBe('crypto_adjacent');
  });

  it('uses keyword analysis for mixed/unknown parsers', () => {
    const crypto = makeInput({
      parser_id: 'us-fincen',
      name: 'Bitcoin ATM Inc',
      activities: ['Virtual Currency exchange'],
    });
    expect(classifyCryptoStatus(crypto)).toBe('confirmed_crypto');

    const tradfi = makeInput({
      parser_id: 'us-fincen',
      name: 'First National Bank',
      activities: ['Banking services'],
      entity_types: ['Bank'],
      license_type: 'Banking License',
      description: null,
    });
    expect(classifyCryptoStatus(tradfi)).toBe('traditional');
  });

  it('returns crypto_adjacent when both crypto and tradfi keywords present', () => {
    const mixed = makeInput({
      parser_id: 'us-fincen',
      name: 'Bank of Crypto',
      activities: ['Banking', 'Crypto exchange'],
    });
    expect(classifyCryptoStatus(mixed)).toBe('crypto_adjacent');
  });

  it('returns unknown when no keywords match', () => {
    const neutral = makeInput({
      parser_id: null,
      name: 'Some Company',
      activities: ['General Services'],
      entity_types: ['Corporation'],
      license_type: null,
      description: null,
      website: 'https://example.com',
    });
    expect(classifyCryptoStatus(neutral)).toBe('unknown');
  });
});

// ── calculateScore ──

describe('calculateScore', () => {
  it('gives T4 (80+) for fully enriched entities', () => {
    const full = makeInput({
      name: 'Coinbase',
      license_number: 'MSB-123',
      license_type: 'MSB',
      status: 'Licensed',
      regulator: 'FinCEN',
      website: 'https://coinbase.com',
      description: 'A major digital asset exchange platform with millions of users worldwide.',
      linkedin_url: 'https://linkedin.com/company/coinbase',
      activities: ['Exchange'],
      entity_types: ['Exchange'],
    });
    const score = calculateScore(full);
    expect(score.total).toBeGreaterThanOrEqual(80);
    expect(score.tier).toBe('T4');
  });

  it('gives T2 (40-59) for entities with license + website', () => {
    const medium = makeInput({
      name: 'Some Exchange',
      license_number: 'LIC-001',
      license_type: 'VASP',
      status: 'Licensed',
      regulator: 'FCA',
      website: 'https://example.com',
      description: null,
      linkedin_url: null,
      activities: [],
      entity_types: [],
    });
    const score = calculateScore(medium);
    expect(score.total).toBeGreaterThanOrEqual(40);
    expect(score.total).toBeLessThan(60);
    expect(score.tier).toBe('T2');
  });

  it('gives T1 (10-30) for minimal entities', () => {
    const minimal = makeInput({
      name: 'Abc',
      license_number: '',
      license_type: null,
      status: 'Unknown',
      regulator: null,
      website: null,
      description: null,
      linkedin_url: null,
      activities: [],
      entity_types: [],
    });
    const score = calculateScore(minimal);
    expect(score.total).toBeLessThan(40);
    expect(score.tier).toBe('T1');
  });
});

// ── processEntity (full pipeline) ──

describe('processEntity', () => {
  it('returns complete QualityResult', () => {
    const result = processEntity(makeInput());
    expect(result.id).toBe('test-1');
    expect(result.canonical_name).toBeDefined();
    expect(result.quality_score).toBeGreaterThan(0);
    expect(result.quality_flags).toHaveProperty('tier');
    expect(result.quality_flags).toHaveProperty('rules');
    expect(result.crypto_status).toBeDefined();
  });

  it('sets is_garbage true for garbage names', () => {
    const result = processEntity(makeInput({ name: 'N/A' }));
    expect(result.is_garbage).toBe(true);
    expect(result.garbage_reason).not.toBeNull();
  });

  it('extracts brand name from entity_types', () => {
    const result = processEntity(makeInput({
      name: 'Aux Cayes FinTech Co. Ltd',
      entity_types: ['trading as OKX'],
    }));
    expect(result.brand_name).toBe('OKX');
  });

  it('returns null brand when entity_types match canonical name', () => {
    const result = processEntity(makeInput({
      name: 'Coinbase',
      entity_types: ['Coinbase'],
    }));
    expect(result.brand_name).toBeNull();
  });

  it('skips license-type entity_types for brand extraction', () => {
    const result = processEntity(makeInput({
      name: 'Some Company',
      entity_types: ['VASP License'],
    }));
    expect(result.brand_name).toBeNull();
  });
});
