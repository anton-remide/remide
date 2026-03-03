import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import LandingPage from './LandingPage';
import { renderWithProviders } from '../test/helpers';
import { mockJurisdictions } from '../test/mocks';

// Mock animations
vi.mock('../hooks/useAnimations', () => ({
  useReveal: () => ({ current: null }),
  useStagger: () => ({ current: null }),
  useStaggerReveal: () => ({ current: null }),
  useCounter: vi.fn(),
}));

// Mock WorldMap (WebGL-dependent)
vi.mock('../components/map/WorldMap', () => ({
  default: () => <div data-testid="world-map">WorldMap</div>,
}));

// Note: LandingPage uses inline NumberStat (not imported StatCard), no mock needed

// Mock dataLoader
const mockGetJurisdictions = vi.fn();
vi.mock('../data/dataLoader', () => ({
  getJurisdictions: (...args: unknown[]) => mockGetJurisdictions(...args),
}));

describe('LandingPage', () => {
  it('shows loading state initially', () => {
    mockGetJurisdictions.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<LandingPage />);

    expect(document.querySelector('.st-loading-pulse')).toBeInTheDocument();
  });

  it('renders hero, stats, map, and features after loading', async () => {
    mockGetJurisdictions.mockResolvedValue(mockJurisdictions);
    renderWithProviders(<LandingPage />);

    await waitFor(() => {
      expect(document.querySelector('.st-loading-pulse')).not.toBeInTheDocument();
    });

    // Hero
    expect(screen.getByText(/global vasp/i)).toBeInTheDocument();

    // Stats — inline NumberStat renders label text
    expect(screen.getByText('Countries Tracked')).toBeInTheDocument();
    expect(screen.getByText('Licensed Entities')).toBeInTheDocument();
    expect(screen.getByText('Active Jurisdictions')).toBeInTheDocument();
    expect(screen.getByText('Travel Rule Enforced')).toBeInTheDocument();

    // Features section
    expect(screen.getByText('Regulatory Regimes')).toBeInTheDocument();
    expect(screen.getByText('Travel Rule Tracking')).toBeInTheDocument();
    expect(screen.getByText('Entity Directory')).toBeInTheDocument();

  });

  it('derives entity count from jurisdictions (no auth needed)', async () => {
    mockGetJurisdictions.mockResolvedValue(mockJurisdictions);
    renderWithProviders(<LandingPage />);

    await waitFor(() => {
      expect(document.querySelector('.st-loading-pulse')).not.toBeInTheDocument();
    });

    // Stats render label "Licensed Entities" (counter starts at 0 in test since useCounter is mocked)
    expect(screen.getByText('Licensed Entities')).toBeInTheDocument();
  });

  it('has navigation buttons', async () => {
    mockGetJurisdictions.mockResolvedValue(mockJurisdictions);
    renderWithProviders(<LandingPage />);

    await waitFor(() => {
      expect(document.querySelector('.st-loading-pulse')).not.toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /explore map/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /browse entities/i })).toBeInTheDocument();
  });
});
