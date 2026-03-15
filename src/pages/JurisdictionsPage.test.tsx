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

// Mock dataLoader — component uses getJurisdictions AND getCbdcs
const mockGetJurisdictions = vi.fn();
const mockGetCbdcs = vi.fn();
vi.mock('../data/dataLoader', () => ({
  getJurisdictions: (...args: unknown[]) => mockGetJurisdictions(...args),
  getCbdcs: (...args: unknown[]) => mockGetCbdcs(...args),
  expandRegionalCode: (code: string) => [code],
}));

// Mock regionCodes (imported by component)
vi.mock('../data/regionCodes', () => ({
  expandRegionalCode: (code: string) => [code],
}));

describe('JurisdictionsPage', () => {
  beforeEach(() => {
    mockGetCbdcs.mockResolvedValue([]);
  });

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

    // Column headers
    const table = document.querySelector('table')!;
    const headers = Array.from(table.querySelectorAll('th')).map((h) => h.textContent?.trim());
    expect(headers).toContain('Regime');
    expect(headers).toContain('Travel Rule');

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

    const table = document.querySelector('table')!;
    const headers = Array.from(table.querySelectorAll('th')).map((h) => h.textContent?.trim());

    expect(headers).toContain('Country');
    expect(headers).toContain('Regime');
    expect(headers).toContain('Travel Rule');
    expect(headers).toContain('Entities');
    expect(headers).toContain('Regulator');
  });
});
