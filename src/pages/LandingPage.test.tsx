import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import LandingPage from './LandingPage';
import { renderWithProviders } from '../test/helpers';
import { mockJurisdictions, mockEntities } from '../test/mocks';

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

// Mock dataLoader
const mockGetJurisdictions = vi.fn();
const mockGetEntities = vi.fn();
const mockGetStablecoins = vi.fn();
const mockGetCbdcs = vi.fn();
vi.mock('../data/dataLoader', () => ({
  getJurisdictions: (...args: unknown[]) => mockGetJurisdictions(...args),
  getEntities: (...args: unknown[]) => mockGetEntities(...args),
  getStablecoins: (...args: unknown[]) => mockGetStablecoins(...args),
  getCbdcs: (...args: unknown[]) => mockGetCbdcs(...args),
}));

describe('LandingPage', () => {
  it('shows loading state initially', () => {
    const pending = new Promise(() => {});
    mockGetJurisdictions.mockReturnValue(pending);
    mockGetEntities.mockReturnValue(pending);
    mockGetStablecoins.mockReturnValue(pending);
    mockGetCbdcs.mockReturnValue(pending);
    renderWithProviders(<LandingPage />);

    expect(document.querySelector('.st-loading-pulse')).toBeInTheDocument();
  });

  it('renders hero, stats, and features after loading', async () => {
    mockGetJurisdictions.mockResolvedValue(mockJurisdictions);
    mockGetEntities.mockResolvedValue(mockEntities);
    mockGetStablecoins.mockResolvedValue([]);
    mockGetCbdcs.mockResolvedValue([]);
    renderWithProviders(<LandingPage />);

    await waitFor(() => {
      expect(document.querySelector('.st-loading-pulse')).not.toBeInTheDocument();
    });

    // Hero
    expect(screen.getByRole('heading', { level: 1, name: /stablecoin intelligence platform/i })).toBeInTheDocument();

    // Stats
    expect(screen.getByText('Countries Tracked')).toBeInTheDocument();
    expect(screen.getByText('Licensed Entities')).toBeInTheDocument();
    expect(screen.getByText('Stablecoins Tracked')).toBeInTheDocument();
    expect(screen.getByText('CBDC Projects')).toBeInTheDocument();

    // Features section
    expect(screen.getByText('Global Registry Data Ecosystem')).toBeInTheDocument();
    expect(screen.getByText('Regulatory Regimes')).toBeInTheDocument();
    expect(screen.getByText('Travel Rule Tracking')).toBeInTheDocument();
    expect(screen.getByText('Entity Directory')).toBeInTheDocument();
    expect(screen.getByText('Stablecoins & CBDCs')).toBeInTheDocument();

    expect(screen.getByText('RemiDe Tracker is a continuous work in progress. Stay updated.')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter email')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /get updates/i })).toBeInTheDocument();
  });

  it('has navigation buttons', async () => {
    mockGetJurisdictions.mockResolvedValue(mockJurisdictions);
    mockGetEntities.mockResolvedValue(mockEntities);
    mockGetStablecoins.mockResolvedValue([]);
    mockGetCbdcs.mockResolvedValue([]);
    renderWithProviders(<LandingPage />);

    await waitFor(() => {
      expect(document.querySelector('.st-loading-pulse')).not.toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /explore map/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /browse entities/i })).toBeInTheDocument();
  });

  it('shows error state when jurisdictions load fails', async () => {
    mockGetJurisdictions.mockRejectedValue(new Error('boom'));
    mockGetEntities.mockResolvedValue([]);
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
    mockGetEntities.mockResolvedValue(mockEntities);
    mockGetStablecoins.mockResolvedValue([]);
    mockGetCbdcs.mockResolvedValue([]);
    renderWithProviders(<LandingPage />);

    await waitFor(() => {
      expect(document.querySelector('.st-loading-pulse')).not.toBeInTheDocument();
    });

    const form = screen.getByTestId('landing-subscribe-form');
    const input = screen.getByPlaceholderText('Enter email');
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
    expect(screen.getByRole('button', { name: /sent/i })).toBeInTheDocument();
    expect(screen.getByText('Thanks! You are on the update list.')).toBeInTheDocument();
  });
});
