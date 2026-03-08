import { useEffect, type RefObject } from 'react';

/**
 * Hook to detect clicks outside a referenced element.
 * Calls `callback` when a mousedown event occurs outside the ref element.
 * Optionally only active when `enabled` is true (default: true).
 *
 * Audit fix E1: extracted from 3 duplicate implementations
 * (Header.tsx, HeaderSearch.tsx, ColumnHeaderFilter.tsx)
 */
export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  callback: () => void,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) return;

    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        callback();
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, callback, enabled]);
}
