import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Header from './Header';
import { renderWithProviders, createMockUser } from '../../test/helpers';

describe('Header', () => {
  it('renders brand link', () => {
    renderWithProviders(<Header />);

    const brand = screen.getByAltText('RemiDe');
    expect(brand).toBeInTheDocument();
    expect(brand.closest('a')).toHaveAttribute('href', '/');
  });

  it('renders navigation links in header nav', () => {
    renderWithProviders(<Header />);

    // Use getAllByRole to handle duplicates (header + mobile menu)
    const links = screen.getAllByRole('link', { name: /jurisdictions/i });
    expect(links.length).toBeGreaterThanOrEqual(1);
    expect(links[0]).toHaveAttribute('href', '/jurisdictions');

    const entityLinks = screen.getAllByRole('link', { name: /entities/i });
    expect(entityLinks.length).toBeGreaterThanOrEqual(1);
    expect(entityLinks[0]).toHaveAttribute('href', '/entities');
  });

  it('shows sign in / sign up when not authenticated', () => {
    renderWithProviders(<Header />, { user: null });

    // Header nav has sign in / sign up links (mobile menu also has them)
    const signInLinks = screen.getAllByRole('link', { name: /sign in/i });
    expect(signInLinks.length).toBeGreaterThanOrEqual(1);

    const signUpLinks = screen.getAllByRole('link', { name: /sign up/i });
    expect(signUpLinks.length).toBeGreaterThanOrEqual(1);
  });

  it('shows user avatar and sign out when authenticated', async () => {
    const clicker = userEvent.setup();
    const user = createMockUser({ email: 'test@example.com' });
    renderWithProviders(<Header />, { user });

    // Avatar with first letter of email
    expect(screen.getByText('T')).toBeInTheDocument();

    // Sign Out is in dropdown — click avatar first
    const avatarBtn = screen.getByLabelText(/account menu/i);
    await clicker.click(avatarBtn);

    // Sign Out now visible in both header dropdown and mobile menu
    const signOuts = screen.getAllByText(/sign out/i);
    expect(signOuts.length).toBeGreaterThanOrEqual(1);
  });

  it('calls signOut on header sign out button click', async () => {
    const clicker = userEvent.setup();
    const user = createMockUser({ email: 'test@example.com' });
    const { authValue } = renderWithProviders(<Header />, { user });

    // Open avatar dropdown first
    const avatarBtn = screen.getByLabelText(/account menu/i);
    await clicker.click(avatarBtn);

    // Click Sign Out in the header dropdown
    const header = document.querySelector('header')!;
    const signOutBtn = within(header).getByText(/sign out/i);
    await clicker.click(signOutBtn);

    expect(authValue.signOut).toHaveBeenCalled();
  });

  it('has a hamburger menu toggle', () => {
    renderWithProviders(<Header />);

    expect(screen.getByLabelText(/toggle menu/i)).toBeInTheDocument();
  });
});
