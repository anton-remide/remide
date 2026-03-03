import { useState, useMemo, useCallback } from 'react';

/**
 * Hook to manage Google Sheets-style column filters.
 * Feed full (unfiltered) data in, get filtered data out.
 */
export function useColumnFilters<T extends Record<string, unknown>>(data: T[]) {
  const [filters, setFilters] = useState<Record<string, string[]>>({});

  /** Get sorted unique string values for a given field */
  const getUniqueValues = useCallback(
    (field: string) => {
      const vals = new Set<string>();
      data.forEach((item) => {
        const v = item[field];
        if (v != null) vals.add(String(v));
      });
      return [...vals].sort((a, b) => a.localeCompare(b));
    },
    [data],
  );

  /** Apply filter: replace selected values for a column */
  const applyFilter = useCallback((field: string, selected: string[]) => {
    setFilters((prev) => {
      if (selected.length === 0) {
        const next = { ...prev };
        delete next[field];
        return next;
      }
      return { ...prev, [field]: selected };
    });
  }, []);

  /** Clear a single column filter */
  const clearFilter = useCallback((field: string) => {
    setFilters((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  /** Clear all column filters */
  const clearAll = useCallback(() => setFilters({}), []);

  /** Data filtered by all active column filters */
  const filtered = useMemo(() => {
    const entries = Object.entries(filters);
    if (entries.length === 0) return data;
    return data.filter((item) =>
      entries.every(([field, selected]) => {
        if (selected.length === 0) return true;
        return selected.includes(String(item[field] ?? ''));
      }),
    );
  }, [data, filters]);

  /** Number of active column filters */
  const activeCount = Object.keys(filters).length;

  return {
    filters,
    applyFilter,
    clearFilter,
    clearAll,
    filtered,
    getUniqueValues,
    activeCount,
  };
}
