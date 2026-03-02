import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import AuthCallbackPage from './AuthCallbackPage';
import { renderWithProviders } from '../test/helpers';

// Mock supabase
const mockGetSession = vi.fn();
const mockUpdate = vi.fn();

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
    },
    from: () => ({
      update: (...args: unknown[]) => ({
        eq: () => mockUpdate(...args),
      }),
    }),
  },
}));

const callbackRoutes = (
  <Routes>
    <Route path="/auth/callback" element={<AuthCallbackPage />} />
    <Route path="/" element={<div>Home page</div>} />
    <Route path="/login" element={<div>Login page</div>} />
  </Routes>
);

describe('AuthCallbackPage', () => {
  it('shows loading state while processing', () => {
    mockGetSession.mockReturnValue(new Promise(() => {})); // never resolves

    renderWithProviders(callbackRoutes, { route: '/auth/callback' });

    expect(document.querySelector('.st-loading-pulse')).toBeInTheDocument();
    expect(screen.getByText(/confirming your account/i)).toBeInTheDocument();
  });

  it('shows error when session retrieval fails', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'Token expired' },
    });

    renderWithProviders(callbackRoutes, { route: '/auth/callback' });

    await waitFor(() => {
      expect(screen.getByText('Token expired')).toBeInTheDocument();
    });

    expect(screen.getByText(/confirmation error/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /go to sign in/i })).toBeInTheDocument();
  });

  it('shows error when no session found', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    renderWithProviders(callbackRoutes, { route: '/auth/callback' });

    await waitFor(() => {
      expect(screen.getByText(/no session found/i)).toBeInTheDocument();
    });
  });

  it('redirects to home on successful callback', async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: { id: 'user-1', email: 'test@example.com' },
          access_token: 'token',
        },
      },
      error: null,
    });

    renderWithProviders(callbackRoutes, { route: '/auth/callback' });

    await waitFor(() => {
      expect(screen.getByText('Home page')).toBeInTheDocument();
    });
  });
});
