import { Link } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';

interface Props {
  open: boolean;
  onClose: () => void;
  links: { to: string; label: string }[];
  user: User | null;
  onSignOut: () => void;
}

export default function MobileMenu({ open, onClose, links, user, onSignOut }: Props) {
  return (
    <div className={`st-mobile-menu${open ? ' open' : ''}`}>
      <nav>
        {links.map((link) => (
          <Link key={link.to} to={link.to} onClick={onClose}>
            {link.label}
          </Link>
        ))}
        <div style={{ borderTop: '1px solid var(--border)', margin: '8px 0' }} />
        {user ? (
          <button
            onClick={() => { onSignOut(); onClose(); }}
            style={{
              background: 'none',
              border: 'none',
              padding: '12px 24px',
              fontSize: '1rem',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%',
            }}
          >
            Sign Out
          </button>
        ) : (
          <>
            <Link to="/login" onClick={onClose}>Sign In</Link>
            <Link to="/signup" onClick={onClose}>Sign Up</Link>
          </>
        )}
      </nav>
    </div>
  );
}
