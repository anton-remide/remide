import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import { renderWithProviders, createMockUser } from '../../test/helpers';

describe('ProtectedRoute', () => {
  const protectedContent = (
    <Routes>
      <Route
        path="/secret"
        element={
          <ProtectedRoute>
            <div>Secret content</div>
          </ProtectedRoute>
        }
      />
      <Route path="/login" element={<div>Login page</div>} />
    </Routes>
  );

  it('shows loading pulse while auth is loading', () => {
    renderWithProviders(protectedContent, {
      route: '/secret',
      authLoading: true,
    });

    expect(document.querySelector('.st-loading-pulse')).toBeInTheDocument();
    expect(screen.queryByText('Secret content')).not.toBeInTheDocument();
  });

  it('redirects to /login when not authenticated', () => {
    renderWithProviders(protectedContent, {
      route: '/secret',
      user: null,
    });

    expect(screen.getByText('Login page')).toBeInTheDocument();
    expect(screen.queryByText('Secret content')).not.toBeInTheDocument();
  });

  it('renders children when authenticated', () => {
    renderWithProviders(protectedContent, {
      route: '/secret',
      user: createMockUser(),
    });

    expect(screen.getByText('Secret content')).toBeInTheDocument();
  });
});
