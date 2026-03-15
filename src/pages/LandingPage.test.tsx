import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
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

// Mock hero canvas (JSdom has no real canvas)
vi.mock('../components/ui/HeroWorldMapCanvas', () => ({
  default: () => <div data-testid="hero-map" />,
}));

// Mock paywall — landing page redirects paid users
vi.mock('../hooks/usePaywall', () => ({
  usePaywall: () => ({ isPaid: false, loading: false, tier: 'anonymous', isAnonymous: true, isRegistered: false, hasAccess: false, hasFullAccess: false, refresh: vi.fn() }),
}));

// Mock dataLoader — component uses getEntityCount (not getEntities)
const mockGetJurisdictions = vi.fn();
const mockGetEntityCount = vi.fn();
const mockGetStablecoins = vi.fn();
const mockGetCbdcs = vi.fn();
vi.mock('../data/dataLoader', () => ({
  getJurisdictions: (...args: unknown[]) => mockGetJurisdictions(...args),
  getEntityCount: (...args: unknown[]) => mockGetEntityCount(...args),
  getStablecoins: (...args: unknown[]) => mockGetStablecoins(...args),
  getCbdcs: (...args: unknown[]) => mockGetCbdcs(...args),
}));

describe('LandingPage', () => {
  it('shows loading state initially', () => {
    const pending = new Promise(() => {});
    mockGetJurisdictions.mockReturnValue(pending);
    mockGetEntityCount.mockReturnValue(pending);
    mockGetStablecoins.mockReturnValue(pending);
    mockGetCbdcs.mockReturnValue(pending);
    renderWithProviders(<LandingPage />);

    expect(document.querySelector('.st-loading-pulse')).toBeInTheDocument();
  });

  it('renders hero and stats after loading', async () => {
    mockGetJurisdictions.mockResolvedValue(mockJurisdictions);
    mockGetEntityCount.mockResolvedValue(42);
    mockGetStablecoins.mockResolvedValue([]);
    mockGetCbdcs.mockResolvedValue([]);
    renderWithProviders(<LandingPage />);

    await waitFor(() => {
      expect(document.querySelector('.st-loading-pulse')).not.toBeInTheDocument();
    });

    // Hero heading
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();

    // Stats
    expect(screen.getByText('Jurisdictions Tracked')).toBeInTheDocument();
    expect(screen.getByText('Regulated Entities')).toBeInTheDocument();
    expect(screen.getByText('Stablecoins Monitored')).toBeInTheDocument();
    expect(screen.getByText('CBDC Projects')).toBeInTheDocument();

    // Features section
    expect(screen.getByText('Regulatory Intelligence at Scale')).toBeInTheDocument();
    expect(screen.getByText('Regulatory Regime Classification')).toBeInTheDocument();
    expect(screen.getByText('Travel Rule Compliance Map')).toBeInTheDocument();
    expect(screen.getByText('Entity Registry Intelligence')).toBeInTheDocument();
    expect(screen.getByText('Stablecoin Regulation Tracker')).toBeInTheDocument();

    // Subscribe section
    expect(screen.getByPlaceholderText(/enter your work email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /get updates/i })).toBeInTheDocument();
  });

  it('has navigation buttons', async () => {
    mockGetJurisdictions.mockResolvedValue(mockJurisdictions);
    mockGetEntityCount.mockResolvedValue(42);
    mockGetStablecoins.mockResolvedValue([]);
    mockGetCbdcs.mockResolvedValue([]);
    renderWithProviders(<LandingPage />);

    await waitFor(() => {
      expect(document.querySelector('.st-loading-pulse')).not.toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /explore regulatory map/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /entities/i })).toBeInTheDocument();
  });

  it('shows error state when jurisdictions load fails', async () => {
    mockGetJurisdictions.mockRejectedValue(new Error('boom'));
    mockGetEntityCount.mockResolvedValue(0);
    mockGetStablecoins.mockResolvedValue([]);
    mockGetCbdcs.mockResolvedValue([]);
    renderWithProviders(<LandingPage />);

    await waitFor(() => {
      expect(document.querySelector('.st-loading-pulse')).not.toBeInTheDocument();
    });

    expect(screen.getByText('Failed to load data')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('handles subscribe states: default, focus, error, sent', async () => {
    mockGetJurisdictions.mockResolvedValue(mockJurisdictions);
    mockGetEntityCount.mockResolvedValue(42);
    mockGetStablecoins.mockResolvedValue([]);
    mockGetCbdcs.mockResolvedValue([]);
    renderWithProviders(<LandingPage />);

    await waitFor(() => {
      expect(document.querySelector('.st-loading-pulse')).not.toBeInTheDocument();
    });

    const form = screen.getByTestId('landing-subscribe-form');
    const input = screen.getByPlaceholderText(/enter your work email/i);
    const button = screen.getByRole('button', { name: /get updates/i });

    expect(form).not.toHaveClass('is-focused');
    expect(form).not.toHaveClass('is-error');
    expect(form).not.toHaveClass('is-sent');

    fireEvent.focus(input);
    expect(form).toHaveClass('is-focused');

    fireEvent.blur(input);
    fireEvent.click(button);
    expect(form).toHaveClass('is-error');
    expect(screen.getByText('Please enter a valid email address.')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'hello@remide.xyz' } });
    fireEvent.click(button);
    expect(form).toHaveClass('is-sent');
    expect(screen.getByRole('button', { name: /subscribed/i })).toBeInTheDocument();
    expect(screen.getByText(/you're on the list/i)).toBeInTheDocument();
  });
});
