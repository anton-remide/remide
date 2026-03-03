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
      <Route path="/signup" element={<div>Signup page</div>} />
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

  it('shows blurred content with registration popup when not authenticated', () => {
    renderWithProviders(protectedContent, {
      route: '/secret',
      user: null,
    });

    // Content is rendered but blurred
    expect(screen.getByText('Secret content')).toBeInTheDocument();
    expect(document.querySelector('.st-auth-blur')).toBeInTheDocument();
    expect(document.querySelector('.st-auth-overlay')).toBeInTheDocument();

    // Popup has CTA
    expect(screen.getByText('Sign up for free access')).toBeInTheDocument();
    expect(screen.getByText('Create Free Account')).toBeInTheDocument();
    expect(screen.getByText('Sign in')).toBeInTheDocument();
  });

  it('renders children when authenticated', () => {
    renderWithProviders(protectedContent, {
      route: '/secret',
      user: createMockUser(),
    });

    expect(screen.getByText('Secret content')).toBeInTheDocument();
    expect(document.querySelector('.st-auth-blur')).not.toBeInTheDocument();
    expect(document.querySelector('.st-auth-overlay')).not.toBeInTheDocument();
  });
});
