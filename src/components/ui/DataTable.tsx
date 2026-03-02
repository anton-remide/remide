import type { SortConfig } from '../../types';
import { ChevronUp, ChevronDown } from 'lucide-react';

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
  width?: string;
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
}

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
}: Props<T>) {
  return (
    <div className="st-card clip-lg" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Showing {totalFiltered.toLocaleString()} of {totalCount.toLocaleString()}
        </span>
      </div>
      <div className="st-table-scroll">
        <table className="st-table">
          <thead>
            <tr>
              {columns.map((col) => (
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
              ))}
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
        </div>
      )}
    </div>
  );
}
