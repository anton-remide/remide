import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import SignupPage from './SignupPage';
import { renderWithProviders } from '../test/helpers';

// Mock animations
vi.mock('../hooks/useAnimations', () => ({
  useReveal: () => ({ current: null }),
  useStagger: () => ({ current: null }),
  useCounter: vi.fn(),
}));

describe('SignupPage', () => {
  const signupRoutes = (
    <Routes>
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/login" element={<div>Login page</div>} />
    </Routes>
  );

  it('renders all form fields', () => {
    renderWithProviders(signupRoutes, { route: '/signup' });

    expect(screen.getByRole('heading', { name: /create/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/business email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/phone/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/role/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create free account/i })).toBeInTheDocument();
  });

  it('has a link to sign in page', () => {
    renderWithProviders(signupRoutes, { route: '/signup' });

    const link = screen.getByRole('link', { name: /sign in/i });
    expect(link).toHaveAttribute('href', '/login');
  });

  it('calls signUp with form data on submit', async () => {
    const user = userEvent.setup();
    const { authValue } = renderWithProviders(signupRoutes, { route: '/signup' });

    await user.type(screen.getByLabelText(/first name/i), 'Jane');
    await user.type(screen.getByLabelText(/last name/i), 'Doe');
    await user.type(screen.getByLabelText(/business email/i), 'jane@company.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.type(screen.getByLabelText(/phone/i), '+1234567890');
    await user.type(screen.getByLabelText(/^role$/i), 'Compliance Officer');

    await user.click(screen.getByRole('button', { name: /create free account/i }));

    expect(authValue.signUp).toHaveBeenCalledWith('jane@company.com', 'password123', {
      first_name: 'Jane',
      last_name: 'Doe',
      business_email: 'jane@company.com',
      phone: '+1234567890',
      role_title: 'Compliance Officer',
    });
  });

  it('shows success message after signup', async () => {
    const user = userEvent.setup();
    renderWithProviders(signupRoutes, { route: '/signup' });

    await user.type(screen.getByLabelText(/first name/i), 'Jane');
    await user.type(screen.getByLabelText(/last name/i), 'Doe');
    await user.type(screen.getByLabelText(/business email/i), 'jane@company.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.type(screen.getByLabelText(/phone/i), '+1234567890');
    await user.type(screen.getByLabelText(/^role$/i), 'Officer');

    await user.click(screen.getByRole('button', { name: /create free account/i }));

    expect(await screen.findByText(/check your email/i)).toBeInTheDocument();
    expect(screen.getByText('jane@company.com')).toBeInTheDocument();
  });

  it('shows error on failed signup', async () => {
    const user = userEvent.setup();
    const { authValue } = renderWithProviders(signupRoutes, { route: '/signup' });

    authValue.signUp.mockResolvedValue({ error: 'Email already registered' });

    await user.type(screen.getByLabelText(/first name/i), 'Jane');
    await user.type(screen.getByLabelText(/last name/i), 'Doe');
    await user.type(screen.getByLabelText(/business email/i), 'jane@company.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.type(screen.getByLabelText(/phone/i), '+1234567890');
    await user.type(screen.getByLabelText(/^role$/i), 'Officer');

    await user.click(screen.getByRole('button', { name: /create free account/i }));

    expect(await screen.findByText('Email already registered')).toBeInTheDocument();
  });

  it('shows loading state during submit', async () => {
    const user = userEvent.setup();
    const { authValue } = renderWithProviders(signupRoutes, { route: '/signup' });

    authValue.signUp.mockReturnValue(new Promise(() => {})); // never resolves

    await user.type(screen.getByLabelText(/first name/i), 'Jane');
    await user.type(screen.getByLabelText(/last name/i), 'Doe');
    await user.type(screen.getByLabelText(/business email/i), 'jane@company.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.type(screen.getByLabelText(/phone/i), '+1234567890');
    await user.type(screen.getByLabelText(/^role$/i), 'Officer');

    await user.click(screen.getByRole('button', { name: /create free account/i }));

    expect(screen.getByRole('button', { name: /creating account/i })).toBeDisabled();
  });

  it('stores metadata in localStorage before signUp', async () => {
    const user = userEvent.setup();
    renderWithProviders(signupRoutes, { route: '/signup' });

    await user.type(screen.getByLabelText(/first name/i), 'Jane');
    await user.type(screen.getByLabelText(/last name/i), 'Doe');
    await user.type(screen.getByLabelText(/business email/i), 'jane@company.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.type(screen.getByLabelText(/phone/i), '+1234567890');
    await user.type(screen.getByLabelText(/^role$/i), 'Officer');

    await user.click(screen.getByRole('button', { name: /create free account/i }));

    const stored = localStorage.getItem('remide_signup_meta');
    expect(stored).toBeTruthy();
    expect(stored).toContain('"first_name":"Jane"');
  });
});
