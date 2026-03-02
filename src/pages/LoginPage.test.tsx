import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import LoginPage from './LoginPage';
import { renderWithProviders } from '../test/helpers';

// Mock useReveal — returns a ref-like object
vi.mock('../hooks/useAnimations', () => ({
  useReveal: () => ({ current: null }),
  useStagger: () => ({ current: null }),
  useCounter: vi.fn(),
}));

describe('LoginPage', () => {
  const loginRoutes = (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<div>Signup page</div>} />
      <Route path="/" element={<div>Home page</div>} />
    </Routes>
  );

  it('renders sign in form', () => {
    renderWithProviders(loginRoutes, { route: '/login' });

    expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('has a link to sign up page', () => {
    renderWithProviders(loginRoutes, { route: '/login' });

    const link = screen.getByRole('link', { name: /create one/i });
    expect(link).toHaveAttribute('href', '/signup');
  });

  it('calls signIn on form submit', async () => {
    const user = userEvent.setup();
    const { authValue } = renderWithProviders(loginRoutes, { route: '/login' });

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(authValue.signIn).toHaveBeenCalledWith('test@example.com', 'password123');
  });

  it('shows error message on failed sign in', async () => {
    const user = userEvent.setup();
    const { authValue } = renderWithProviders(loginRoutes, { route: '/login' });

    authValue.signIn.mockResolvedValue({ error: 'Invalid credentials' });

    await user.type(screen.getByLabelText(/email/i), 'bad@example.com');
    await user.type(screen.getByLabelText(/password/i), 'wrong');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
  });

  it('shows loading state during submit', async () => {
    const user = userEvent.setup();
    const { authValue } = renderWithProviders(loginRoutes, { route: '/login' });

    // Never resolve to keep loading state
    authValue.signIn.mockReturnValue(new Promise(() => {}));

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();
  });
});
