/**
 * Shared test fixtures and Supabase mock helpers.
 */
import type { Jurisdiction, Entity } from '../types';

// ── Fixtures ──

export const mockJurisdictionRow = {
  code: 'US',
  name: 'United States',
  regime: 'Licensing',
  regulator: 'FinCEN',
  key_law: 'Bank Secrecy Act',
  travel_rule: 'Enforced',
  entity_count: 42,
  sources: JSON.stringify([{ name: 'FinCEN', url: 'https://fincen.gov' }]),
  notes: 'Federal and state-level licensing',
  description: '',
  stablecoin_stage: null,
  is_stablecoin_specific: null,
  yield_allowed: null,
  fiat_backed: null,
  fiat_alert: null,
  crypto_backed: null,
  crypto_alert: null,
  commodity_backed: null,
  commodity_alert: null,
  algorithm_backed: null,
  algorithm_alert: null,
  stablecoin_description: null,
  regulator_description: null,
  currency: null,
};

export const mockJurisdiction: Jurisdiction = {
  code: 'US',
  name: 'United States',
  regime: 'Licensing',
  regulator: 'FinCEN',
  keyLaw: 'Bank Secrecy Act',
  travelRule: 'Enforced',
  entityCount: 42,
  sources: [{ name: 'FinCEN', url: 'https://fincen.gov' }],
  notes: 'Federal and state-level licensing',
  description: '',
  stablecoinStage: null,
  isStablecoinSpecific: null,
  yieldAllowed: null,
  fiatBacked: null,
  fiatAlert: '',
  cryptoBacked: null,
  cryptoAlert: '',
  commodityBacked: null,
  commodityAlert: '',
  algorithmBacked: null,
  algorithmAlert: '',
  stablecoinDescription: '',
  regulatorDescription: '',
  currency: '',
};

export const mockEntityRow = {
  id: 'us-coinbase',
  name: 'Coinbase',
  canonical_name: null,
  country_code: 'US',
  country: 'United States',
  license_number: 'MSB-31000180780458',
  license_type: 'Money Services Business',
  entity_types: ['Exchange', 'Custodian'],
  activities: ['Trading', 'Custody'],
  status: 'Licensed',
  regulator: 'FinCEN',
  website: 'https://coinbase.com',
  description: '',
  registry_url: '',
  linkedin_url: '',
  brand_name: null,
  twitter_url: null,
  raw_data: null,
  sector: null,
  crypto_related: null,
  quality_score: null,
  quality_flags: null,
  dns_status: null,
  crypto_status: null,
  is_garbage: false,
};

export const mockEntity: Entity = {
  id: 'us-coinbase',
  name: 'Coinbase',
  brandName: null,
  countryCode: 'US',
  country: 'United States',
  licenseNumber: 'MSB-31000180780458',
  licenseType: 'Money Services Business',
  entityTypes: ['Exchange', 'Custodian'],
  activities: ['Trading', 'Custody'],
  status: 'Licensed',
  regulator: 'FinCEN',
  website: 'https://coinbase.com',
  description: '',
  registryUrl: '',
  linkedinUrl: '',
  twitterUrl: '',
  sector: 'Crypto',
  cryptoRelated: true,
  qualityScore: null,
  qualityTier: null,
  dnsStatus: 'unknown',
  cryptoStatus: 'unknown',
  isGarbage: false,
};

const stablecoinDefaults = {
  stablecoinStage: null,
  isStablecoinSpecific: null,
  yieldAllowed: null,
  fiatBacked: null,
  fiatAlert: '',
  cryptoBacked: null,
  cryptoAlert: '',
  commodityBacked: null,
  commodityAlert: '',
  algorithmBacked: null,
  algorithmAlert: '',
  stablecoinDescription: '',
  regulatorDescription: '',
  currency: '',
} as const;

export const mockJurisdictions: Jurisdiction[] = [
  mockJurisdiction,
  {
    code: 'SG',
    name: 'Singapore',
    regime: 'Licensing',
    regulator: 'MAS',
    keyLaw: 'Payment Services Act',
    travelRule: 'Enforced',
    entityCount: 15,
    sources: [{ name: 'MAS', url: 'https://mas.gov.sg' }],
    notes: 'Comprehensive licensing regime',
    description: '',
    ...stablecoinDefaults,
  },
  {
    code: 'JP',
    name: 'Japan',
    regime: 'Registration',
    regulator: 'FSA',
    keyLaw: 'Payment Services Act',
    travelRule: 'Enforced',
    entityCount: 31,
    sources: [{ name: 'JFSA', url: 'https://fsa.go.jp' }],
    notes: 'Registration-based system',
    description: '',
    ...stablecoinDefaults,
  },
];

const entityDefaults = {
  brandName: null,
  twitterUrl: '',
  sector: 'Crypto' as const,
  cryptoRelated: true,
  qualityScore: null,
  qualityTier: null,
  dnsStatus: 'unknown' as const,
  cryptoStatus: 'unknown' as const,
  isGarbage: false,
};

export const mockEntities: Entity[] = [
  mockEntity,
  {
    id: 'sg-crypto-com',
    name: 'Crypto.com',
    countryCode: 'SG',
    country: 'Singapore',
    licenseNumber: 'PS20200543',
    licenseType: 'Major Payment Institution',
    entityTypes: ['Exchange'],
    activities: ['Trading'],
    status: 'Licensed',
    regulator: 'MAS',
    website: 'https://crypto.com',
    description: '',
    registryUrl: '',
    linkedinUrl: '',
    ...entityDefaults,
  },
  {
    id: 'us-kraken',
    name: 'Kraken',
    countryCode: 'US',
    country: 'United States',
    licenseNumber: 'MSB-31000225740654',
    licenseType: 'Money Services Business',
    entityTypes: ['Exchange'],
    activities: ['Trading'],
    status: 'Licensed',
    regulator: 'FinCEN',
    website: 'https://kraken.com',
    description: '',
    registryUrl: '',
    linkedinUrl: '',
    ...entityDefaults,
  },
];

// ── Supabase mock builder ──

export interface MockQueryChain {
  select: ReturnType<typeof import('vitest').vi.fn>;
  eq: ReturnType<typeof import('vitest').vi.fn>;
  order: ReturnType<typeof import('vitest').vi.fn>;
  single: ReturnType<typeof import('vitest').vi.fn>;
}

/**
 * Creates a chainable mock that mimics Supabase's query builder.
 * Set `resolvedData` and `resolvedError` before calling the chain.
 */
export function createMockQueryChain(data: unknown = null, error: unknown = null) {
  const result = { data, error };

  const chain: Record<string, unknown> = {};
  const methods = ['select', 'eq', 'order', 'single', 'upsert', 'update', 'insert', 'delete'];

  for (const method of methods) {
    chain[method] = (..._args: unknown[]) => {
      // Return a promise-like + chainable object
      const proxy = new Proxy(
        { ...chain, then: (resolve: (v: unknown) => void) => resolve(result) },
        {
          get(target, prop) {
            if (prop === 'then') return target.then;
            if (typeof chain[prop as string] === 'function') return chain[prop as string];
            return undefined;
          },
        },
      );
      return proxy;
    };
  }

  return chain;
}
