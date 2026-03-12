import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronUp, ChevronDown, Filter, Search, Check } from 'lucide-react';
import type { SortDirection } from '../../types';
import { BREAKPOINTS } from '../../constants/breakpoints';

/** Detect mobile viewport (matches shared breakpoint registry) */
const isMobileViewport = () => window.innerWidth <= BREAKPOINTS.md;

interface Props {
  label: string;
  field: string;
  values: string[];
  selected: string[];
  onApply: (field: string, selected: string[]) => void;
  onClear: (field: string) => void;
  sortField: string;
  sortDirection: SortDirection;
  onSort: (field: string) => void;
  renderValue?: (value: string) => React.ReactNode;
}

export default function ColumnHeaderFilter({
  label,
  field,
  values,
  selected,
  onApply,
  onClear,
  sortField,
  sortDirection,
  onSort,
  renderValue,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const triggerRef = useRef<HTMLTableCellElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const isActive = selected.length > 0;
  const isSorted = sortField === field && sortDirection !== null;

  // Sync checked state when popup opens
  useEffect(() => {
    if (open) {
      setChecked(new Set(selected.length > 0 ? selected : values));
      setSearch('');
    }
  }, [open, selected, values]);

  // Recalculate popup position (used on open, scroll, resize)
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popupWidth = 260;
    let left = rect.left;
    // Keep popup within viewport
    if (left + popupWidth > window.innerWidth - 16) {
      left = window.innerWidth - popupWidth - 16;
    }
    setPos({ top: rect.bottom + 4, left: Math.max(8, left) });
  }, []);

  // Position popup and track scroll/resize while open
  useEffect(() => {
    if (!open) return;
    updatePosition();
    const onScrollOrResize = () => updatePosition();
    window.addEventListener('scroll', onScrollOrResize, { passive: true, capture: true });
    window.addEventListener('resize', onScrollOrResize, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open, updatePosition]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        popupRef.current &&
        !popupRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Lock body scroll on mobile when popup is open (bottom sheet)
  useEffect(() => {
    if (!open || !isMobileViewport()) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const filteredValues = useMemo(() => {
    if (!search.trim()) return values;
    const q = search.toLowerCase();
    return values.filter((v) => v.toLowerCase().includes(q));
  }, [values, search]);

  const allChecked = filteredValues.length > 0 && filteredValues.every((v) => checked.has(v));

  const toggleAll = () => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (allChecked) {
        filteredValues.forEach((v) => next.delete(v));
      } else {
        filteredValues.forEach((v) => next.add(v));
      }
      return next;
    });
  };

  const toggleOne = (val: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(val)) next.delete(val);
      else next.add(val);
      return next;
    });
  };

  const handleApply = () => {
    const arr = [...checked];
    // If all values are selected, clear the filter
    if (arr.length === values.length || arr.length === 0) {
      onClear(field);
    } else {
      onApply(field, arr);
    }
    setOpen(false);
  };

  const handleCancel = () => {
    setOpen(false);
  };

  const handleSort = (dir: 'asc' | 'desc') => {
    // If already sorting this direction, clear sort
    if (sortField === field && sortDirection === dir) {
      onSort(field); // toggle will clear
    } else {
      // Set sort to this direction
      if (sortField !== field) {
        onSort(field); // first click → asc
        if (dir === 'desc') onSort(field); // second click → desc
      } else if (sortDirection === 'asc' && dir === 'desc') {
        onSort(field); // toggle from asc to desc
      } else if (sortDirection === 'desc' && dir === 'asc') {
        onSort(field); // toggle from desc → null
        onSort(field); // null → asc
      }
    }
    setOpen(false);
  };

  return (
    <>
      <th
        ref={triggerRef}
        className={`st-col-filter-th${isActive ? ' filter-active' : ''}`}
        onClick={() => setOpen(!open)}
      >
        <span className="st-col-filter-label">
          {label}
          {isSorted && sortDirection === 'asc' && <ChevronUp size={13} style={{ marginLeft: 2 }} />}
          {isSorted && sortDirection === 'desc' && <ChevronDown size={13} style={{ marginLeft: 2 }} />}
        </span>
        <Filter
          size={12}
          className={`st-col-filter-icon${isActive ? ' active' : ''}`}
        />
      </th>

      {open &&
        createPortal(
          <>
            {/* Backdrop for mobile bottom sheet */}
            <div className="st-col-filter-backdrop" onClick={() => setOpen(false)} />
            <div
              ref={popupRef}
              className="st-col-filter-popup"
              style={{ top: pos.top, left: pos.left }}
            >
            {/* Sort buttons */}
            <div className="st-col-filter-sort">
              <button
                className={`st-col-filter-sort-btn${sortField === field && sortDirection === 'asc' ? ' active' : ''}`}
                onClick={() => handleSort('asc')}
              >
                <ChevronUp size={13} /> Sort A–Z
              </button>
              <button
                className={`st-col-filter-sort-btn${sortField === field && sortDirection === 'desc' ? ' active' : ''}`}
                onClick={() => handleSort('desc')}
              >
                <ChevronDown size={13} /> Sort Z–A
              </button>
            </div>

            <div className="st-col-filter-divider" />

            {/* Search */}
            <div className="st-col-filter-search">
              <Search size={13} color="var(--text-muted)" />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Select All / Clear All */}
            <div className="st-col-filter-toggle-row">
              <button onClick={toggleAll}>
                {allChecked ? 'Clear All' : 'Select All'}
              </button>
              <span className="st-col-filter-count">
                {checked.size} of {values.length}
              </span>
            </div>

            {/* Checkbox list */}
            <div className="st-col-filter-list">
              {filteredValues.map((val) => (
                <label key={val} className="st-col-filter-item" onClick={() => toggleOne(val)}>
                  <span className={`st-col-filter-check${checked.has(val) ? ' checked' : ''}`}>
                    {checked.has(val) && <Check size={11} strokeWidth={3} />}
                  </span>
                  <span className="st-col-filter-item-label">
                    {renderValue ? renderValue(val) : val}
                  </span>
                </label>
              ))}
              {filteredValues.length === 0 && (
                <div style={{ padding: '12px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                  No matches
                </div>
              )}
            </div>

            <div className="st-col-filter-divider" />

            {/* Actions */}
            <div className="st-col-filter-actions">
              <button className="st-col-filter-btn-cancel" onClick={handleCancel}>
                Cancel
              </button>
              <button className="st-col-filter-btn-apply" onClick={handleApply}>
                Apply
              </button>
            </div>
          </div>
          </>,
          document.body,
        )}
    </>
  );
}
