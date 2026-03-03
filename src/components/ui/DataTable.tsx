import { useState, useRef, useEffect } from 'react';
import type { SortConfig } from '../../types';
import { ChevronUp, ChevronDown, Search, X } from 'lucide-react';
import ColumnHeaderFilter from './ColumnHeaderFilter';

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
  width?: string;
  /** Enable Google Sheets-style column filter popup */
  filterable?: boolean;
  /** Unique values for filter popup (pass from useColumnFilters.getUniqueValues) */
  filterValues?: string[];
  /** Currently selected filter values */
  selectedFilters?: string[];
  /** Callback when filter is applied */
  onFilterApply?: (field: string, selected: string[]) => void;
  /** Callback to clear filter */
  onFilterClear?: (field: string) => void;
  /** Custom renderer for filter checkbox values */
  renderFilterValue?: (value: string) => React.ReactNode;
}

interface Props<T> {
  columns: Column<T>[];
  data: T[];
  sort: SortConfig;
  onSort: (field: string) => void;
  onRowClick?: (row: T) => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalFiltered: number;
  totalCount: number;
  /** Current page size */
  pageSize?: number;
  /** Callback to change page size */
  onPageSizeChange?: (size: number) => void;
  /** Search value (shows search in header bar) */
  search?: string;
  /** Search change callback */
  onSearchChange?: (value: string) => void;
  /** Search placeholder */
  searchPlaceholder?: string;
}

const PAGE_SIZE_OPTIONS = [25, 50, 100];

export default function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  sort,
  onSort,
  onRowClick,
  page,
  totalPages,
  onPageChange,
  totalFiltered,
  totalCount,
  pageSize = 25,
  onPageSizeChange,
  search,
  onSearchChange,
  searchPlaceholder = 'Search...',
}: Props<T>) {
  const startIndex = (page - 1) * pageSize + 1;
  const endIndex = Math.min(page * pageSize, totalFiltered);

  // Local search state for debounce
  const [localSearch, setLocalSearch] = useState(search ?? '');
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => { setLocalSearch(search ?? ''); }, [search]);

  const handleSearchChange = (val: string) => {
    setLocalSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => onSearchChange?.(val), 200);
  };

  return (
    <div className="st-card" style={{ padding: 0, overflow: 'hidden', borderRadius: 10 }}>
      {/* Header bar */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        {onSearchChange && (
          <div className="st-table-search">
            <Search size={14} className="st-table-search-icon" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
            />
            {localSearch && (
              <button className="st-table-search-clear" onClick={() => handleSearchChange('')} aria-label="Clear search">
                <X size={12} />
              </button>
            )}
          </div>
        )}
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {totalFiltered > 0
            ? `Showing ${startIndex}–${endIndex} of ${totalFiltered.toLocaleString()}`
            : 'No results'
          }
          {totalFiltered < totalCount && (
            <span style={{ opacity: 0.6 }}> (filtered from {totalCount.toLocaleString()})</span>
          )}
        </span>
      </div>

      {/* Table */}
      <div className="st-table-scroll">
        <table className="st-table">
          <thead>
            <tr>
              {columns.map((col) => {
                const hasFilter = col.filterable && col.filterValues && col.onFilterApply && col.onFilterClear;
                if (hasFilter) {
                  return (
                    <ColumnHeaderFilter
                      key={col.key}
                      label={col.label}
                      field={col.key}
                      values={col.filterValues!}
                      selected={col.selectedFilters ?? []}
                      onApply={col.onFilterApply!}
                      onClear={col.onFilterClear!}
                      sortField={sort.field}
                      sortDirection={sort.direction}
                      onSort={onSort}
                      renderValue={col.renderFilterValue}
                    />
                  );
                }

                return (
                  <th
                    key={col.key}
                    onClick={col.sortable ? () => onSort(col.key) : undefined}
                    className={col.sortable ? 'sortable' : ''}
                    style={col.width ? { width: col.width } : undefined}
                  >
                    {col.label}
                    {col.sortable && sort.field === col.key && sort.direction === 'asc' && (
                      <ChevronUp size={14} style={{ marginLeft: 4, verticalAlign: 'middle' }} />
                    )}
                    {col.sortable && sort.field === col.key && sort.direction === 'desc' && (
                      <ChevronDown size={14} style={{ marginLeft: 4, verticalAlign: 'middle' }} />
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                  No results found
                </td>
              </tr>
            ) : (
              data.map((row, i) => (
                <tr
                  key={i}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  style={onRowClick ? { cursor: 'pointer' } : undefined}
                >
                  {columns.map((col) => (
                    <td key={col.key}>
                      {col.render ? col.render(row) : String(row[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="st-pagination">
          <button
            className="st-btn-sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Prev
          </button>

          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Page {page} of {totalPages}
          </span>

          <button
            className="st-btn-sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </button>

          {onPageSizeChange && (
            <select
              className="st-page-size-select"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
          )}
        </div>
      )}
    </div>
  );
}
