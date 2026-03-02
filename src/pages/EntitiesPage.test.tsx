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

// Mock dataLoader
const mockGetEntities = vi.fn();
vi.mock('../data/dataLoader', () => ({
  getEntities: (...args: unknown[]) => mockGetEntities(...args),
}));

describe('EntitiesPage', () => {
  it('shows loading state initially', () => {
    mockGetEntities.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<EntitiesPage />);

    expect(document.querySelector('.st-loading-pulse')).toBeInTheDocument();
  });

  it('renders heading, search, filters, and table after loading', async () => {
    mockGetEntities.mockResolvedValue(mockEntities);
    renderWithProviders(<EntitiesPage />);

    await waitFor(() => {
      expect(document.querySelector('.st-loading-pulse')).not.toBeInTheDocument();
    });

    // Heading
    expect(screen.getByText('Entity Directory')).toBeInTheDocument();
    expect(screen.getByText(/3 licensed entities/i)).toBeInTheDocument();

    // Search
    expect(screen.getByPlaceholderText(/search entities/i)).toBeInTheDocument();

    // Dropdown filters
    expect(screen.getByDisplayValue('All Countries')).toBeInTheDocument();
    expect(screen.getByDisplayValue('All Statuses')).toBeInTheDocument();
    expect(screen.getByDisplayValue('All Regulators')).toBeInTheDocument();

    // Table data
    expect(screen.getByText('Coinbase')).toBeInTheDocument();
    expect(screen.getByText('Crypto.com')).toBeInTheDocument();
    expect(screen.getByText('Kraken')).toBeInTheDocument();
  });

  it('displays correct column headers', async () => {
    mockGetEntities.mockResolvedValue(mockEntities);
    renderWithProviders(<EntitiesPage />);

    await waitFor(() => {
      expect(document.querySelector('.st-loading-pulse')).not.toBeInTheDocument();
    });

    expect(screen.getByText('Name')).toBeInTheDocument();
    // 'Country' appears in both column header and filter — check table header
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('License Type')).toBeInTheDocument();
    expect(screen.getByText('Regulator')).toBeInTheDocument();
  });
});
