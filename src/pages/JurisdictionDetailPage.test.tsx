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

// Mock dataLoader
const mockGetJurisdictionByCode = vi.fn();
const mockGetEntitiesByCountry = vi.fn();

vi.mock('../data/dataLoader', () => ({
  getJurisdictionByCode: (...args: unknown[]) => mockGetJurisdictionByCode(...args),
  getEntitiesByCountry: (...args: unknown[]) => mockGetEntitiesByCountry(...args),
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

    // "United States" appears in heading, breadcrumb, and entity rows — use heading role
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('United States');
    });

    // Badges
    expect(screen.getByText('Licensing')).toBeInTheDocument();
    expect(screen.getByText('Enforced')).toBeInTheDocument();

    // Info card ("FinCEN" also appears in Sources section)
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
