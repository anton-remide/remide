import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { X, Search, MapPin, Building2, Shield } from 'lucide-react';
import { searchGlobal, type SearchResult } from '../../data/dataLoader';
import { countryCodeToFlag } from '../../utils/countryFlags';
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
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Reset search when menu closes
  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults(null);
    }
  }, [open]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Debounced search
  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setResults(null);
      return;
    }
    setLoading(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await searchGlobal(query.trim());
        setResults(res);
      } catch {
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timerRef.current);
  }, [query]);

  const handleSelect = useCallback((path: string) => {
    setQuery('');
    setResults(null);
    onClose();
    navigate(path);
  }, [navigate, onClose]);

  const hasResults = results && (results.jurisdictions.length > 0 || results.entities.length > 0);

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

      {/* Search */}
      <div className="st-mobile-search">
        <Search size={16} className="st-mobile-search-icon" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search VASP or jurisdiction..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="st-mobile-search-input"
          autoComplete="off"
        />
        {loading && <div className="st-header-search-spinner" />}
      </div>

      {/* Search results */}
      {results && query.trim().length >= 2 && (
        <div className="st-mobile-search-results">
          {!hasResults && (
            <div className="st-mobile-search-empty">No results for &ldquo;{query}&rdquo;</div>
          )}
          {results.jurisdictions.length > 0 && (
            <>
              <div className="st-mobile-search-cat"><MapPin size={12} /> Countries</div>
              {results.jurisdictions.map((j) => (
                <button key={j.code} className="st-mobile-search-item" onClick={() => handleSelect(`/jurisdictions/${j.code}`)}>
                  <span>{countryCodeToFlag(j.code)}</span>
                  <span>{j.name}</span>
                </button>
              ))}
            </>
          )}
          {results.entities.length > 0 && (
            <>
              <div className="st-mobile-search-cat"><Building2 size={12} /> Entities</div>
              {results.entities.map((e) => (
                <button key={e.id} className="st-mobile-search-item" onClick={() => handleSelect(`/entities/${e.id}`)}>
                  <Shield size={14} />
                  <span className="st-mobile-search-item-name">{e.name}</span>
                  <span className="st-mobile-search-item-sub">{countryCodeToFlag(e.countryCode)} {e.country}</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}

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
