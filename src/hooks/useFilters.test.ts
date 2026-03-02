import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTableState } from './useFilters';

interface Item {
  name: string;
  country: string;
  count: number;
}

const testData: Item[] = [
  { name: 'Alpha Corp', country: 'United States', count: 50 },
  { name: 'Beta Ltd', country: 'Singapore', count: 20 },
  { name: 'Gamma Inc', country: 'Japan', count: 35 },
  { name: 'Delta SA', country: 'Switzerland', count: 10 },
  { name: 'Epsilon GmbH', country: 'Germany', count: 45 },
];

const filterFn = (item: Item, q: string) =>
  item.name.toLowerCase().includes(q) || item.country.toLowerCase().includes(q);

describe('useTableState', () => {
  it('returns all data when no search is applied', () => {
    const { result } = renderHook(() => useTableState(testData, filterFn));

    expect(result.current.filtered).toHaveLength(5);
    expect(result.current.paginated).toHaveLength(5);
    expect(result.current.totalPages).toBe(1);
  });

  it('filters data by search term', () => {
    const { result } = renderHook(() => useTableState(testData, filterFn));

    act(() => {
      result.current.setSearch('alpha');
    });

    expect(result.current.filtered).toHaveLength(1);
    expect(result.current.filtered[0].name).toBe('Alpha Corp');
  });

  it('filters case-insensitively', () => {
    const { result } = renderHook(() => useTableState(testData, filterFn));

    act(() => {
      result.current.setSearch('SINGAPORE');
    });

    expect(result.current.filtered).toHaveLength(1);
    expect(result.current.filtered[0].country).toBe('Singapore');
  });

  it('resets page to 1 when search changes', () => {
    const { result } = renderHook(() => useTableState(testData, filterFn, undefined, 2));

    // Go to page 2
    act(() => result.current.setPage(2));
    expect(result.current.page).toBe(2);

    // Search should reset to page 1
    act(() => result.current.setSearch('alpha'));
    expect(result.current.page).toBe(1);
  });

  // ── Sorting ──

  it('sorts ascending on first click', () => {
    const { result } = renderHook(() => useTableState(testData, filterFn));

    act(() => {
      result.current.toggleSort('count');
    });

    expect(result.current.sort).toEqual({ field: 'count', direction: 'asc' });
    expect(result.current.sorted[0].count).toBe(10);
    expect(result.current.sorted[4].count).toBe(50);
  });

  it('sorts descending on second click', () => {
    const { result } = renderHook(() => useTableState(testData, filterFn));

    act(() => result.current.toggleSort('count'));
    act(() => result.current.toggleSort('count'));

    expect(result.current.sort).toEqual({ field: 'count', direction: 'desc' });
    expect(result.current.sorted[0].count).toBe(50);
  });

  it('removes sort on third click', () => {
    const { result } = renderHook(() => useTableState(testData, filterFn));

    act(() => result.current.toggleSort('count'));
    act(() => result.current.toggleSort('count'));
    act(() => result.current.toggleSort('count'));

    expect(result.current.sort).toEqual({ field: '', direction: null });
  });

  it('resets sort when switching to a different field', () => {
    const { result } = renderHook(() => useTableState(testData, filterFn));

    act(() => result.current.toggleSort('count'));
    expect(result.current.sort.field).toBe('count');

    act(() => result.current.toggleSort('name'));
    expect(result.current.sort).toEqual({ field: 'name', direction: 'asc' });
  });

  it('sorts strings alphabetically', () => {
    const { result } = renderHook(() => useTableState(testData, filterFn));

    act(() => result.current.toggleSort('name'));

    expect(result.current.sorted[0].name).toBe('Alpha Corp');
    expect(result.current.sorted[4].name).toBe('Gamma Inc');
  });

  // ── Pagination ──

  it('paginates correctly', () => {
    const { result } = renderHook(() => useTableState(testData, filterFn, undefined, 2));

    expect(result.current.totalPages).toBe(3);
    expect(result.current.paginated).toHaveLength(2);
    expect(result.current.page).toBe(1);
  });

  it('navigates to page 2', () => {
    const { result } = renderHook(() => useTableState(testData, filterFn, undefined, 2));

    act(() => result.current.setPage(2));

    expect(result.current.page).toBe(2);
    expect(result.current.paginated).toHaveLength(2);
  });

  it('clamps page to totalPages if data shrinks', () => {
    const { result } = renderHook(() => useTableState(testData, filterFn, undefined, 2));

    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);

    // Filter to 1 result — page should clamp to 1
    act(() => result.current.setSearch('alpha'));
    expect(result.current.page).toBe(1);
  });

  // ── Default sort ──

  it('applies default sort', () => {
    const { result } = renderHook(() =>
      useTableState(testData, filterFn, { field: 'count', direction: 'desc' }),
    );

    expect(result.current.sort).toEqual({ field: 'count', direction: 'desc' });
    expect(result.current.sorted[0].count).toBe(50);
  });

  // ── Edge cases ──

  it('handles empty data', () => {
    const { result } = renderHook(() => useTableState([] as Item[], filterFn));

    expect(result.current.filtered).toEqual([]);
    expect(result.current.totalPages).toBe(1);
    expect(result.current.page).toBe(1);
  });

  it('handles whitespace-only search', () => {
    const { result } = renderHook(() => useTableState(testData, filterFn));

    act(() => result.current.setSearch('   '));
    expect(result.current.filtered).toHaveLength(5);
  });
});
