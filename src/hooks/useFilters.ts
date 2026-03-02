import { useState, useMemo, useCallback } from 'react';
import type { SortConfig, SortDirection } from '../types';

/** Debounced search + generic filter/sort/pagination hook */
export function useTableState<T>(
  data: T[],
  filterFn: (item: T, search: string) => boolean,
  defaultSort?: SortConfig,
  pageSize = 25,
) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortConfig>(defaultSort ?? { field: '', direction: null });
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return q ? data.filter((item) => filterFn(item, q)) : data;
  }, [data, search, filterFn]);

  const sorted = useMemo(() => {
    if (!sort.field || !sort.direction) return filtered;
    const dir = sort.direction === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = (a as Record<string, unknown>)[sort.field];
      const bv = (b as Record<string, unknown>)[sort.field];
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av ?? '').localeCompare(String(bv ?? '')) * dir;
    });
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleSort = useCallback((field: string) => {
    setSort((prev) => {
      let next: SortDirection;
      if (prev.field !== field) next = 'asc';
      else if (prev.direction === 'asc') next = 'desc';
      else if (prev.direction === 'desc') next = null;
      else next = 'asc';
      return { field: next ? field : '', direction: next };
    });
    setPage(1);
  }, []);

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  return {
    search,
    setSearch: handleSearch,
    sort,
    toggleSort,
    page: safePage,
    setPage,
    totalPages,
    filtered,
    sorted,
    paginated,
    totalFiltered: filtered.length,
  };
}
