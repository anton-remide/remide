import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Search, MapPin, Building2, Shield, Clock } from 'lucide-react';
import { searchGlobal, type SearchResult } from '../../data/dataLoader';
import { countryCodeToFlag } from '../../utils/countryFlags';

const RECENT_KEY = 'remide_recent_searches';
const MAX_RECENT = 5;

function getRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecent(term: string) {
  try {
    const prev = getRecent().filter((t) => t !== term);
    const next = [term, ...prev].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch { /* noop */ }
}

function clearRecent() {
  try { localStorage.removeItem(RECENT_KEY); } catch { /* noop */ }
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function MobileSearchOverlay({ open, onClose }: Props) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Load recent on open + auto-focus
  useEffect(() => {
    if (open) {
      setRecent(getRecent());
      document.body.style.overflow = 'hidden';
      setTimeout(() => inputRef.current?.focus(), 80);
    } else {
      document.body.style.overflow = '';
      setQuery('');
      setResults(null);
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // Close on Escape
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
    }, 200);
    return () => clearTimeout(timerRef.current);
  }, [query]);

  const handleSelect = useCallback((path: string, term?: string) => {
    if (term) saveRecent(term);
    else if (query.trim()) saveRecent(query.trim());
    setQuery('');
    setResults(null);
    onClose();
    navigate(path);
  }, [navigate, onClose, query]);

  const handleRecentClick = (term: string) => {
    setQuery(term);
  };

  const handleClearRecent = () => {
    clearRecent();
    setRecent([]);
  };

  const hasResults = results && (results.jurisdictions.length > 0 || results.entities.length > 0);
  const showRecent = recent.length > 0 && !query.trim();

  if (!open) return null;

  return (
    <div className="st-search-overlay" role="dialog" aria-modal="true" aria-label="Search">
      {/* Search bar */}
      <div className="st-search-overlay__bar">
        <Search size={18} className="st-search-overlay__icon" aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search VASP or jurisdiction..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="st-search-overlay__input"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {loading && <div className="st-header-search-spinner" role="status" aria-label="Loading" />}
        <button className="st-search-overlay__close" onClick={onClose} aria-label="Close search">
          <X size={20} />
        </button>
      </div>

      {/* Content area */}
      <div className="st-search-overlay__body">
        {/* Recent searches */}
        {showRecent && (
          <div className="st-search-overlay__recent">
            <div className="st-search-overlay__recent-header">
              <Clock size={13} />
              <span>Recent</span>
              <button className="st-search-overlay__recent-clear" onClick={handleClearRecent}>Clear</button>
            </div>
            {recent.map((term) => (
              <button key={term} className="st-search-overlay__recent-item" onClick={() => handleRecentClick(term)}>
                <Search size={13} />
                <span>{term}</span>
              </button>
            ))}
          </div>
        )}

        {/* No results */}
        {query.trim().length >= 2 && results && !hasResults && (
          <div className="st-search-overlay__empty">
            No results for &ldquo;{query}&rdquo;
          </div>
        )}

        {/* Results */}
        {results && hasResults && (
          <div className="st-search-overlay__results">
            {results.jurisdictions.length > 0 && (
              <>
                <div className="st-search-overlay__cat">
                  <MapPin size={13} /> Countries
                </div>
                {results.jurisdictions.map((j) => (
                  <button
                    key={j.code}
                    className="st-search-overlay__item"
                    onClick={() => handleSelect(`/jurisdictions/${j.code}`, j.name)}
                  >
                    <span className="st-search-overlay__item-flag">{countryCodeToFlag(j.code)}</span>
                    <span className="st-search-overlay__item-name">{j.name}</span>
                  </button>
                ))}
              </>
            )}
            {results.entities.length > 0 && (
              <>
                <div className="st-search-overlay__cat">
                  <Building2 size={13} /> Entities
                </div>
                {results.entities.map((e) => (
                  <button
                    key={e.id}
                    className="st-search-overlay__item"
                    onClick={() => handleSelect(`/entities/${e.id}`, e.name)}
                  >
                    <Shield size={14} className="st-search-overlay__item-icon" />
                    <span className="st-search-overlay__item-name">{e.name}</span>
                    <span className="st-search-overlay__item-sub">{countryCodeToFlag(e.countryCode)} {e.country}</span>
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
