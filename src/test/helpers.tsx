/**
 * Test render helpers — wraps components with providers needed for tests.
 */
import { render, type RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../context/AuthProvider';
import { ThemeProvider } from '../context/ThemeProvider';
import type { Session, User } from '@supabase/supabase-js';
import type { ReactNode } from 'react';

// Minimal mock user
export function createMockUser(overrides?: Partial<User>): User {
  return {
    id: 'test-user-id',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2025-01-01T00:00:00Z',
    ...overrides,
  } as User;
}

// Minimal mock session
export function createMockSession(user?: User): Session {
  const u = user ?? createMockUser();
  return {
    access_token: 'test-token',
    refresh_token: 'test-refresh',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: u,
  };
}

interface TestOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Pass `null` for unauthenticated, or a User object for authenticated */
  user?: User | null;
  /** Initial route path */
  route?: string;
  /** Whether auth is still loading */
  authLoading?: boolean;
}

/**
 * Renders a component wrapped in MemoryRouter + AuthProvider.
 */
export function renderWithProviders(ui: ReactNode, options: TestOptions = {}) {
  const {
    user = null,
    route = '/',
    authLoading = false,
    ...renderOptions
  } = options;

  const session = user ? createMockSession(user) : null;

  const authValue = {
    session,
    user,
    loading: authLoading,
    signUp: vi.fn().mockResolvedValue({ error: null }),
    signIn: vi.fn().mockResolvedValue({ error: null }),
    signOut: vi.fn().mockResolvedValue(undefined),
  };

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ThemeProvider>
        <AuthContext.Provider value={authValue}>
          <MemoryRouter initialEntries={[route]}>
            {children}
          </MemoryRouter>
        </AuthContext.Provider>
      </ThemeProvider>
    );
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    authValue,
  };
}
