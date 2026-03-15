import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import EntitiesPage from './EntitiesPage';
import { renderWithProviders } from '../test/helpers';
import { mockEntities } from '../test/mocks';

// Mock animations
vi.mock('../hooks/useAnimations', () => ({
  useReveal: () => ({ current: null }),
  useStagger: () => ({ current: null }),
  useStaggerReveal: () => ({ current: null }),
  useCounter: vi.fn(),
}));

// Mock paywall (used indirectly by child hooks)
vi.mock('../hooks/usePaywall', () => ({
  usePaywall: () => ({ isPaid: false, loading: false, tier: 'registered', isAnonymous: false, isRegistered: true, hasAccess: true, hasFullAccess: false, refresh: vi.fn() }),
}));

// Mock dataLoader — component uses getEntitiesProgressive, getEntityStats, getJurisdictions, etc.
const mockGetEntityStats = vi.fn();
const mockGetJurisdictions = vi.fn();
const mockGetStablecoins = vi.fn();
const mockGetCbdcs = vi.fn();
const mockGetStablecoinIssuers = vi.fn();

vi.mock('../data/dataLoader', () => ({
  getEntitiesProgressive: (onProgress: (entities: unknown[], loaded: number, total: number) => void) => {
    const data = mockEntitiesForProgressive;
    onProgress(data, data.length, data.length);
    return Promise.resolve(data);
  },
  clearEntityCache: vi.fn(),
  getEntityStats: (...args: unknown[]) => mockGetEntityStats(...args),
  getJurisdictions: (...args: unknown[]) => mockGetJurisdictions(...args),
  getStablecoins: (...args: unknown[]) => mockGetStablecoins(...args),
  getCbdcs: (...args: unknown[]) => mockGetCbdcs(...args),
  getStablecoinIssuers: (...args: unknown[]) => mockGetStablecoinIssuers(...args),
}));

// Reference to mockEntities — set before each test via beforeEach or directly
let mockEntitiesForProgressive = mockEntities;

describe('EntitiesPage', () => {
  beforeEach(() => {
    mockEntitiesForProgressive = mockEntities;
    mockGetEntityStats.mockResolvedValue({ total: 3, crypto: 3, payments: 0, banking: 0 });
    mockGetJurisdictions.mockResolvedValue([]);
    mockGetStablecoins.mockResolvedValue([]);
    mockGetCbdcs.mockResolvedValue([]);
    mockGetStablecoinIssuers.mockResolvedValue([]);
  });

  it('renders without crashing and shows page title', async () => {
    renderWithProviders(<EntitiesPage />);

    await waitFor(() => {
      expect(document.querySelector('.st-loading-pulse')).not.toBeInTheDocument();
    });

    expect(screen.getByText(/browse 10k\+ entities/i)).toBeInTheDocument();
  });

  it('renders table with entity data after loading', async () => {
    renderWithProviders(<EntitiesPage />);

    await waitFor(() => {
      expect(document.querySelector('.st-loading-pulse')).not.toBeInTheDocument();
    });

    // Table data
    expect(screen.getByText('Coinbase')).toBeInTheDocument();
    expect(screen.getByText('Crypto.com')).toBeInTheDocument();
    expect(screen.getByText('Kraken')).toBeInTheDocument();
  });

  it('displays correct column headers', async () => {
    renderWithProviders(<EntitiesPage />);

    await waitFor(() => {
      expect(document.querySelector('.st-loading-pulse')).not.toBeInTheDocument();
    });

    const table = document.querySelector('table');
    expect(table).toBeTruthy();
    const headers = Array.from(table!.querySelectorAll('th')).map((h) => h.textContent?.trim());
    expect(headers).toContain('Name');
    expect(headers).toContain('Country');
    expect(headers).toContain('Status');
    expect(headers).toContain('License Type');
    expect(headers).toContain('Regulator');
  });
});
