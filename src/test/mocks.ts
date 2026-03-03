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
};

export const mockEntityRow = {
  id: 'us-coinbase',
  name: 'Coinbase',
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
};

export const mockEntity: Entity = {
  id: 'us-coinbase',
  name: 'Coinbase',
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
};

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
  },
];

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
