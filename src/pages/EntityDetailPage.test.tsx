import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import EntityDetailPage from './EntityDetailPage';
import { renderWithProviders, createMockUser } from '../test/helpers';
import { mockEntity, mockJurisdiction, mockEntities } from '../test/mocks';

// Mock animations
vi.mock('../hooks/useAnimations', () => ({
  useReveal: () => ({ current: null }),
  useStagger: () => ({ current: null }),
  useStaggerReveal: () => ({ current: null }),
  useCounter: vi.fn(),
}));

// Mock dataLoader
const mockGetEntityById = vi.fn();
const mockGetEntitiesByCountry = vi.fn();
const mockGetJurisdictionByCode = vi.fn();

vi.mock('../data/dataLoader', () => ({
  getEntityById: (...args: unknown[]) => mockGetEntityById(...args),
  getEntitiesByCountry: (...args: unknown[]) => mockGetEntitiesByCountry(...args),
  getJurisdictionByCode: (...args: unknown[]) => mockGetJurisdictionByCode(...args),
}));

const entityRoutes = (
  <Routes>
    <Route path="/entities/:id" element={<EntityDetailPage />} />
  </Routes>
);

describe('EntityDetailPage', () => {
  it('shows loading state initially', () => {
    mockGetEntityById.mockReturnValue(new Promise(() => {}));
    renderWithProviders(entityRoutes, {
      route: '/entities/us-coinbase',
      user: createMockUser(),
    });

    expect(document.querySelector('.st-loading-pulse')).toBeInTheDocument();
  });

  it('shows not found when entity is null', async () => {
    mockGetEntityById.mockResolvedValue(null);
    renderWithProviders(entityRoutes, {
      route: '/entities/nonexistent',
      user: createMockUser(),
    });

    await waitFor(() => {
      expect(screen.getByText(/entity not found/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /back to entities/i })).toBeInTheDocument();
  });

  it('renders entity details after loading', async () => {
    mockGetEntityById.mockResolvedValue(mockEntity);
    mockGetEntitiesByCountry.mockResolvedValue(mockEntities);
    mockGetJurisdictionByCode.mockResolvedValue(mockJurisdiction);

    renderWithProviders(entityRoutes, {
      route: '/entities/us-coinbase',
      user: createMockUser(),
    });

    // Entity name appears in both heading and breadcrumb — use heading role
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Coinbase' })).toBeInTheDocument();
    });

    // Status badge (may appear multiple times in related entities — use getAllByText)
    expect(screen.getAllByText('Licensed').length).toBeGreaterThanOrEqual(1);

    // Info card values
    expect(screen.getByText('FinCEN')).toBeInTheDocument();
    expect(screen.getByText('Money Services Business')).toBeInTheDocument();
    expect(screen.getByText('MSB-31000180780458')).toBeInTheDocument();

    // Activities
    expect(screen.getAllByText('Trading').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Custody')).toBeInTheDocument();

    // Entity types
    expect(screen.getByText('Exchange')).toBeInTheDocument();
    expect(screen.getByText('Custodian')).toBeInTheDocument();

    // Breadcrumb
    expect(screen.getByText('Entities')).toBeInTheDocument();
  });
});
