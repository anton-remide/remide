import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import type { User } from '@supabase/supabase-js';

interface Props {
  open: boolean;
  onClose: () => void;
  links: { to: string; label: string }[];
  user: User | null;
  onSignOut: () => void;
}

export default function MobileMenu({ open, onClose, links, user, onSignOut }: Props) {
  const location = useLocation();

  // Lock body scroll when menu is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <div
      className={`st-mobile-menu${open ? ' open' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Navigation menu"
    >
      <button
        className="st-mobile-menu-close"
        onClick={onClose}
        aria-label="Close menu"
      >
        <X size={24} color="var(--black)" />
      </button>
      <nav>
        {links.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            onClick={onClose}
            className={location.pathname.startsWith(link.to) ? 'active' : ''}
          >
            {link.label}
          </Link>
        ))}
        <div className="st-mobile-menu-divider" />
        {user ? (
          <>
            <div className="st-mobile-menu-email">{user.email}</div>
            <button
              className="st-mobile-menu-action"
              onClick={() => { onSignOut(); onClose(); }}
            >
              Sign Out
            </button>
          </>
        ) : (
          <>
            <Link to="/login" onClick={onClose} className="st-mobile-menu-action">
              Sign In
            </Link>
            <Link to="/signup" onClick={onClose} className="st-mobile-menu-action">
              Register
            </Link>
          </>
        )}
      </nav>
    </div>
  );
}
