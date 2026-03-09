import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MobileMenu from './MobileMenu';
import { renderWithProviders, createMockUser } from '../../test/helpers';

const defaultLinks = [
  { to: '/jurisdictions', label: 'Jurisdictions' },
  { to: '/entities', label: 'Entities' },
];

describe('MobileMenu', () => {
  it('renders nav links', () => {
    renderWithProviders(
      <MobileMenu open={true} onClose={vi.fn()} links={defaultLinks} user={null} onSignOut={vi.fn()} />,
    );

    expect(screen.getByRole('link', { name: /jurisdictions/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /entities/i })).toBeInTheDocument();
  });

  it('shows sign in / sign up when not authenticated', () => {
    renderWithProviders(
      <MobileMenu open={true} onClose={vi.fn()} links={defaultLinks} user={null} onSignOut={vi.fn()} />,
    );

    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /register/i })).toBeInTheDocument();
  });

  it('shows sign out when authenticated', () => {
    const user = createMockUser();
    renderWithProviders(
      <MobileMenu open={true} onClose={vi.fn()} links={defaultLinks} user={user} onSignOut={vi.fn()} />,
    );

    expect(screen.getByText(/sign out/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /sign in/i })).not.toBeInTheDocument();
  });

  it('calls onSignOut and onClose when sign out is clicked', async () => {
    const clicker = userEvent.setup();
    const user = createMockUser();
    const onClose = vi.fn();
    const onSignOut = vi.fn();

    renderWithProviders(
      <MobileMenu open={true} onClose={onClose} links={defaultLinks} user={user} onSignOut={onSignOut} />,
    );

    await clicker.click(screen.getByText(/sign out/i));

    expect(onSignOut).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when a nav link is clicked', async () => {
    const clicker = userEvent.setup();
    const onClose = vi.fn();

    renderWithProviders(
      <MobileMenu open={true} onClose={onClose} links={defaultLinks} user={null} onSignOut={vi.fn()} />,
    );

    await clicker.click(screen.getByRole('link', { name: /jurisdictions/i }));

    expect(onClose).toHaveBeenCalled();
  });

  it('applies open class when open is true', () => {
    const { container } = renderWithProviders(
      <MobileMenu open={true} onClose={vi.fn()} links={defaultLinks} user={null} onSignOut={vi.fn()} />,
    );

    expect(container.querySelector('.st-mobile-menu.open')).toBeInTheDocument();
  });

  it('does not apply open class when open is false', () => {
    const { container } = renderWithProviders(
      <MobileMenu open={false} onClose={vi.fn()} links={defaultLinks} user={null} onSignOut={vi.fn()} />,
    );

    expect(container.querySelector('.st-mobile-menu.open')).not.toBeInTheDocument();
    expect(container.querySelector('.st-mobile-menu')).toBeInTheDocument();
  });

  it('renders search input when open', () => {
    renderWithProviders(
      <MobileMenu open={true} onClose={vi.fn()} links={defaultLinks} user={null} onSignOut={vi.fn()} />,
    );

    expect(screen.getByPlaceholderText(/search vasp or jurisdiction/i)).toBeInTheDocument();
  });
});
