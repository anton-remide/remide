import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockJurisdictionRow, mockEntityRow } from '../test/mocks';

// ── Mock Supabase before importing dataLoader ──

const mockFrom = vi.fn();

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

// Import after mock setup
const {
  getJurisdictions,
  getJurisdictionByCode,
  getEntities,
  getEntityById,
  getEntitiesByCountry,
} = await import('./dataLoader');

// ── Helper: chain builder ──

function chain(data: unknown, error: unknown = null) {
  const result = { data, error };
  const obj: Record<string, (...args: unknown[]) => unknown> = {};
  for (const m of ['select', 'eq', 'order', 'single']) {
    obj[m] = () => ({ ...obj, then: (fn: (v: unknown) => void) => fn(result) });
  }
  return obj;
}

describe('dataLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── getJurisdictions ──

  describe('getJurisdictions', () => {
    it('returns mapped jurisdictions sorted by entity_count', async () => {
      mockFrom.mockReturnValue(chain([mockJurisdictionRow]));

      const result = await getJurisdictions();

      expect(mockFrom).toHaveBeenCalledWith('jurisdictions');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        code: 'US',
        name: 'United States',
        regime: 'Licensing',
        regulator: 'FinCEN',
        keyLaw: 'Bank Secrecy Act',
        travelRule: 'Enforced',
        entityCount: 42,
        sources: [{ name: 'FinCEN', url: 'https://fincen.gov' }],
        notes: 'Federal and state-level licensing',
      });
    });

    it('handles sources as parsed JSON object', async () => {
      const rowWithParsedSources = {
        ...mockJurisdictionRow,
        sources: [{ name: 'FinCEN', url: 'https://fincen.gov' }],
      };
      mockFrom.mockReturnValue(chain([rowWithParsedSources]));

      const result = await getJurisdictions();
      expect(result[0].sources).toEqual([{ name: 'FinCEN', url: 'https://fincen.gov' }]);
    });

    it('throws on supabase error', async () => {
      mockFrom.mockReturnValue(chain(null, { message: 'connection refused' }));

      await expect(getJurisdictions()).rejects.toThrow('Failed to load jurisdictions: connection refused');
    });
  });

  // ── getJurisdictionByCode ──

  describe('getJurisdictionByCode', () => {
    it('returns a single jurisdiction by code', async () => {
      mockFrom.mockReturnValue(chain(mockJurisdictionRow));

      const result = await getJurisdictionByCode('us');
      expect(result).not.toBeNull();
      expect(result!.code).toBe('US');
    });

    it('returns null for not-found (PGRST116)', async () => {
      mockFrom.mockReturnValue(chain(null, { code: 'PGRST116', message: 'not found' }));

      const result = await getJurisdictionByCode('XX');
      expect(result).toBeNull();
    });

    it('throws on other errors', async () => {
      mockFrom.mockReturnValue(chain(null, { code: '42P01', message: 'relation does not exist' }));

      await expect(getJurisdictionByCode('US')).rejects.toThrow('Failed to load jurisdiction');
    });
  });

  // ── getEntities ──

  describe('getEntities', () => {
    it('returns mapped entities', async () => {
      mockFrom.mockReturnValue(chain([mockEntityRow]));

      const result = await getEntities();

      expect(mockFrom).toHaveBeenCalledWith('entities');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
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
      });
    });

    it('defaults null arrays to empty', async () => {
      const rowWithNulls = { ...mockEntityRow, entity_types: null, activities: null };
      mockFrom.mockReturnValue(chain([rowWithNulls]));

      const result = await getEntities();
      expect(result[0].entityTypes).toEqual([]);
      expect(result[0].activities).toEqual([]);
    });

    it('throws on error', async () => {
      mockFrom.mockReturnValue(chain(null, { message: 'timeout' }));

      await expect(getEntities()).rejects.toThrow('Failed to load entities: timeout');
    });
  });

  // ── getEntityById ──

  describe('getEntityById', () => {
    it('returns an entity by ID', async () => {
      mockFrom.mockReturnValue(chain(mockEntityRow));

      const result = await getEntityById('us-coinbase');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('us-coinbase');
    });

    it('returns null for PGRST116', async () => {
      mockFrom.mockReturnValue(chain(null, { code: 'PGRST116', message: 'not found' }));

      const result = await getEntityById('nonexistent');
      expect(result).toBeNull();
    });
  });

  // ── getEntitiesByCountry ──

  describe('getEntitiesByCountry', () => {
    it('returns entities filtered by country code', async () => {
      mockFrom.mockReturnValue(chain([mockEntityRow]));

      const result = await getEntitiesByCountry('us');
      expect(result).toHaveLength(1);
      expect(result[0].countryCode).toBe('US');
    });

    it('returns empty array for country with no entities', async () => {
      mockFrom.mockReturnValue(chain([]));

      const result = await getEntitiesByCountry('XX');
      expect(result).toEqual([]);
    });
  });
});
