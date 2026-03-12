import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Building2, Shield } from 'lucide-react';
import { searchGlobal, type SearchResult } from '../../data/dataLoader';
import { useClickOutside } from '../../hooks/useClickOutside';
import { countryCodeToFlag } from '../../utils/countryFlags';

export default function HeaderSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  // Keep header search expanded (regression: collapsed into a center icon)
  const [expanded] = useState(true);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // ⌘K / Ctrl+K global shortcut to focus search (Stripe pattern)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Flatten results for keyboard navigation
  const flatItems = useCallback(() => {
    if (!results) return [];
    const items: { type: 'jurisdiction' | 'entity'; label: string; sub: string; path: string }[] = [];
    results.jurisdictions.forEach((j) => {
      items.push({
        type: 'jurisdiction',
        label: j.name,
        sub: j.regulator,
        path: `/jurisdictions/${j.code}`,
      });
    });
    results.entities.forEach((e) => {
      items.push({
        type: 'entity',
        label: e.name,
        sub: `${e.country} · ${e.regulator}`,
        path: `/entities/${e.id}`,
      });
    });
    return items;
  }, [results]);

  // Debounced search
  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setResults(null);
      setOpen(false);
      return;
    }

    setLoading(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await searchGlobal(query.trim());
        setResults(res);
        setOpen(true);
        setActiveIndex(-1);
      } catch (err) {
        console.error('Search failed:', err);
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timerRef.current);
  }, [query]);

  // Click outside: close dropdown
  const closeDropdown = useCallback(() => {
    setOpen(false);
  }, []);
  useClickOutside(wrapperRef, closeDropdown);

  const handleSelect = (path: string) => {
    setOpen(false);
    setQuery('');
    navigate(path);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const items = flatItems();
    if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
      inputRef.current?.blur();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < items.length) {
        handleSelect(items[activeIndex].path);
      } else if (query.trim()) {
        // Fallback: navigate to jurisdictions search
        setOpen(false);
        navigate(`/jurisdictions?q=${encodeURIComponent(query.trim())}`);
        setQuery('');
      }
    }
  };

  const hasResults = results && (results.jurisdictions.length > 0 || results.entities.length > 0);

  return (
    <div ref={wrapperRef} className={`st-header-search-wrapper${expanded ? ' expanded' : ''}`}>
      <div className="st-header-search">
        <Search size={14} className="st-header-search-icon" aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search VASP or Jurisdiction..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results) setOpen(true); }}
          onKeyDown={handleKeyDown}
          className="st-header-search-input"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls="header-search-listbox"
          aria-activedescendant={activeIndex >= 0 ? `search-item-${activeIndex}` : undefined}
        />
        {loading && <div className="st-header-search-spinner" role="status" aria-label="Loading search results" />}
      </div>

      {open && results && (
        <div className="st-search-dropdown" id="header-search-listbox" role="listbox">
          {!hasResults && (
            <div className="st-search-empty">No results for "{query}"</div>
          )}

          {results.jurisdictions.length > 0 && (
            <>
              <div className="st-search-category">
                <MapPin size={12} />
                <span>Countries</span>
              </div>
              {results.jurisdictions.map((j, i) => (
                <button
                  key={j.code}
                  id={`search-item-${i}`}
                  role="option"
                  aria-selected={activeIndex === i}
                  className={`st-search-item${activeIndex === i ? ' active' : ''}`}
                  onClick={() => handleSelect(`/jurisdictions/${j.code}`)}
                  onMouseEnter={() => setActiveIndex(i)}
                >
                  <span className="st-search-item-flag">{countryCodeToFlag(j.code)}</span>
                  <span className="st-search-item-name">{j.name}</span>
                </button>
              ))}
            </>
          )}

          {results.entities.length > 0 && (
            <>
              <div className="st-search-category">
                <Building2 size={12} />
                <span>Entities</span>
              </div>
              {results.entities.map((e, i) => {
                const idx = results.jurisdictions.length + i;
                return (
                  <button
                    key={e.id}
                    id={`search-item-${idx}`}
                    role="option"
                    aria-selected={activeIndex === idx}
                    className={`st-search-item${activeIndex === idx ? ' active' : ''}`}
                    onClick={() => handleSelect(`/entities/${e.id}`)}
                    onMouseEnter={() => setActiveIndex(idx)}
                  >
                    <Shield size={14} className="st-search-item-icon" />
                    <span className="st-search-item-name">{e.name}</span>
                    <span className="st-search-item-sub">{countryCodeToFlag(e.countryCode)} {e.country}</span>
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
