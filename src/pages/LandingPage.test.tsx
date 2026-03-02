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

// Mock ContactForm
vi.mock('../components/ui/ContactForm', () => ({
  default: () => <div data-testid="contact-form">ContactForm</div>,
}));

// Mock StatCard
vi.mock('../components/ui/StatCard', () => ({
  default: ({ label, value }: { label: string; value: number }) => (
    <div data-testid="stat-card">{label}: {value}</div>
  ),
}));

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

  it('renders hero, stats, map, features, and contact after loading', async () => {
    mockGetJurisdictions.mockResolvedValue(mockJurisdictions);
    renderWithProviders(<LandingPage />);

    await waitFor(() => {
      expect(document.querySelector('.st-loading-pulse')).not.toBeInTheDocument();
    });

    // Hero
    expect(screen.getByText(/global vasp/i)).toBeInTheDocument();

    // Stats — derived from mockJurisdictions
    const statCards = screen.getAllByTestId('stat-card');
    expect(statCards).toHaveLength(4);

    // Map
    expect(screen.getByTestId('world-map')).toBeInTheDocument();

    // Features section
    expect(screen.getByText('Regulatory Regimes')).toBeInTheDocument();
    expect(screen.getByText('Travel Rule Tracking')).toBeInTheDocument();
    expect(screen.getByText('Entity Directory')).toBeInTheDocument();

    // Contact
    expect(screen.getByTestId('contact-form')).toBeInTheDocument();
  });

  it('derives entity count from jurisdictions (no auth needed)', async () => {
    mockGetJurisdictions.mockResolvedValue(mockJurisdictions);
    renderWithProviders(<LandingPage />);

    await waitFor(() => {
      expect(document.querySelector('.st-loading-pulse')).not.toBeInTheDocument();
    });

    // Total entities = 42 (US) + 15 (SG) + 31 (JP) = 88
    expect(screen.getByText(/Licensed Entities: 88/)).toBeInTheDocument();
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
