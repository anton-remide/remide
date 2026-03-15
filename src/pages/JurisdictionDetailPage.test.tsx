import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import JurisdictionDetailPage from './JurisdictionDetailPage';
import { renderWithProviders, createMockUser } from '../test/helpers';
import { mockJurisdiction, mockEntities } from '../test/mocks';

// Mock animations
vi.mock('../hooks/useAnimations', () => ({
  useReveal: () => ({ current: null }),
  useStagger: () => ({ current: null }),
  useStaggerReveal: () => ({ current: null }),
  useCounter: vi.fn(),
}));

// Mock WorldMap (uses maplibregl which isn't available in test)
vi.mock('../components/map/WorldMap', () => ({
  default: (props: Record<string, unknown>) => <div data-testid="world-map" data-focus={props.focusCountry as string} />,
}));

// Mock countryFlags
vi.mock('../utils/countryFlags', () => ({
  countryCodeToFlag: (code: string) => `[${code}]`,
}));

// Mock paywall — provide registered-tier access for detail page tests
vi.mock('../hooks/usePaywall', () => ({
  usePaywall: () => ({ isPaid: false, loading: false, tier: 'registered', isAnonymous: false, isRegistered: true, hasAccess: true, hasFullAccess: false, refresh: vi.fn() }),
}));

// Mock FloatingPaywallCTA (uses paywall context)
vi.mock('../components/ui/FloatingPaywallCTA', () => ({
  default: () => null,
}));

// Mock dataLoader — provide all functions the component imports
const mockGetJurisdictionByCode = vi.fn();
const mockGetEntitiesByCountry = vi.fn();

vi.mock('../data/dataLoader', () => ({
  getJurisdictionByCode: (...args: unknown[]) => mockGetJurisdictionByCode(...args),
  getEntitiesByCountry: (...args: unknown[]) => mockGetEntitiesByCountry(...args),
  getEntitiesByRegion: vi.fn().mockResolvedValue([]),
  getJurisdictionsByRegion: vi.fn().mockResolvedValue([]),
  getStablecoinsByCountry: vi.fn().mockResolvedValue([]),
  getCbdcsByCountry: vi.fn().mockResolvedValue([]),
  getStablecoinLawsByCountry: vi.fn().mockResolvedValue([]),
  getStablecoinEventsByCountry: vi.fn().mockResolvedValue([]),
  getLicensesByCountry: vi.fn().mockResolvedValue([]),
  getJurisdictions: vi.fn().mockResolvedValue([]),
  getCbdcs: vi.fn().mockResolvedValue([]),
}));

// Mock regionCodes (imported by component)
vi.mock('../data/regionCodes', () => ({
  expandRegionalCode: (code: string) => [code],
}));

const detailRoutes = (
  <Routes>
    <Route path="/jurisdictions/:code" element={<JurisdictionDetailPage />} />
  </Routes>
);

describe('JurisdictionDetailPage', () => {
  it('shows loading state initially', () => {
    mockGetJurisdictionByCode.mockReturnValue(new Promise(() => {}));
    mockGetEntitiesByCountry.mockReturnValue(new Promise(() => {}));

    renderWithProviders(detailRoutes, {
      route: '/jurisdictions/US',
      user: createMockUser(),
    });

    expect(document.querySelector('.st-loading-pulse')).toBeInTheDocument();
  });

  it('shows not found when jurisdiction is null', async () => {
    mockGetJurisdictionByCode.mockResolvedValue(null);
    mockGetEntitiesByCountry.mockResolvedValue([]);

    renderWithProviders(detailRoutes, {
      route: '/jurisdictions/XX',
      user: createMockUser(),
    });

    await waitFor(() => {
      expect(screen.getByText(/jurisdiction not found/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /back to jurisdictions/i })).toBeInTheDocument();
  });

  it('renders jurisdiction details with entity table', async () => {
    mockGetJurisdictionByCode.mockResolvedValue(mockJurisdiction);
    mockGetEntitiesByCountry.mockResolvedValue(mockEntities);

    renderWithProviders(detailRoutes, {
      route: '/jurisdictions/US',
      user: createMockUser(),
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('United States');
    });

    // Badges — use getAllByText since they may appear in multiple places
    expect(screen.getAllByText('Licensing').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Enforced').length).toBeGreaterThanOrEqual(1);

    // Info card
    expect(screen.getAllByText('FinCEN').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Bank Secrecy Act')).toBeInTheDocument();

    // Sources
    expect(screen.getByText('Sources')).toBeInTheDocument();

    // Entity table
    expect(screen.getByText('Coinbase')).toBeInTheDocument();

    // Search for entities
    expect(screen.getByPlaceholderText(/search entities/i)).toBeInTheDocument();

    // Breadcrumb
    expect(screen.getByText('Jurisdictions')).toBeInTheDocument();
  });
});
