import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import JurisdictionsPage from './JurisdictionsPage';
import { renderWithProviders } from '../test/helpers';
import { mockJurisdictions } from '../test/mocks';

// Mock animations
vi.mock('../hooks/useAnimations', () => ({
  useReveal: () => ({ current: null }),
  useStagger: () => ({ current: null }),
  useStaggerReveal: () => ({ current: null }),
  useCounter: vi.fn(),
}));

// Mock WorldMap
vi.mock('../components/map/WorldMap', () => ({
  default: () => <div data-testid="world-map">WorldMap</div>,
}));

// Mock dataLoader
const mockGetJurisdictions = vi.fn();
vi.mock('../data/dataLoader', () => ({
  getJurisdictions: (...args: unknown[]) => mockGetJurisdictions(...args),
}));

describe('JurisdictionsPage', () => {
  it('shows loading state initially', () => {
    mockGetJurisdictions.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<JurisdictionsPage />);

    expect(document.querySelector('.st-loading-pulse')).toBeInTheDocument();
  });

  it('renders map, filters, and table after loading', async () => {
    mockGetJurisdictions.mockResolvedValue(mockJurisdictions);
    renderWithProviders(<JurisdictionsPage />);

    await waitFor(() => {
      expect(document.querySelector('.st-loading-pulse')).not.toBeInTheDocument();
    });

    // Map
    expect(screen.getByTestId('world-map')).toBeInTheDocument();

    // Search
    expect(screen.getByPlaceholderText(/search countries/i)).toBeInTheDocument();

    // Regime filter chips (text also appears in table badge cells)
    expect(screen.getAllByText('Licensing').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Registration').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Sandbox').length).toBeGreaterThanOrEqual(1);

    // Travel Rule filter chips (text also appears in table badge cells)
    expect(screen.getAllByText('Enforced').length).toBeGreaterThanOrEqual(1);

    // Table renders jurisdictions
    expect(screen.getByText('United States')).toBeInTheDocument();
    expect(screen.getByText('Singapore')).toBeInTheDocument();
    expect(screen.getByText('Japan')).toBeInTheDocument();
  });

  it('displays correct column headers', async () => {
    mockGetJurisdictions.mockResolvedValue(mockJurisdictions);
    renderWithProviders(<JurisdictionsPage />);

    await waitFor(() => {
      expect(document.querySelector('.st-loading-pulse')).not.toBeInTheDocument();
    });

    // Column headers inside <th> elements
    const table = document.querySelector('table')!;
    const headers = Array.from(table.querySelectorAll('th')).map((h) => h.textContent?.trim());

    expect(headers).toContain('Country');
    expect(headers).toContain('Regime');
    expect(headers).toContain('Travel Rule');
    expect(headers).toContain('Entities');
    expect(headers).toContain('Regulator');
  });
});
