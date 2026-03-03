import { useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getEntities } from '../data/dataLoader';
import type { Entity } from '../types';
import { STATUS_COLORS } from '../theme';
import { useReveal } from '../hooks/useAnimations';
import { useTableState } from '../hooks/useFilters';
import { useColumnFilters } from '../hooks/useColumnFilters';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { countryCodeToFlag } from '../utils/countryFlags';
import Badge from '../components/ui/Badge';
import DataTable, { type Column } from '../components/ui/DataTable';

export default function EntitiesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: allEntities, loading, error, refetch } = useSupabaseQuery(getEntities);
  const revealRef = useReveal(loading);

  const safeEntities = allEntities ?? [];

  // Column filters hook (works on full dataset)
  const colFilters = useColumnFilters<Entity & Record<string, unknown>>(
    safeEntities as (Entity & Record<string, unknown>)[],
  );

  const filterFn = useCallback((e: Entity, q: string) => {
    return e.name.toLowerCase().includes(q) || e.country.toLowerCase().includes(q);
  }, []);

  const table = useTableState(colFilters.filtered as Entity[], filterFn, { field: 'name', direction: 'asc' });

  // Sync header search query param → table search
  const qParam = searchParams.get('q');
  useEffect(() => {
    if (qParam) {
      table.setSearch(qParam);
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qParam]);

  const columns: Column<Entity>[] = [
    { key: 'name', label: 'Name', sortable: true },
    {
      key: 'country',
      label: 'Country',
      sortable: true,
      filterable: true,
      filterValues: colFilters.getUniqueValues('country'),
      selectedFilters: colFilters.filters['country'] ?? [],
      onFilterApply: colFilters.applyFilter,
      onFilterClear: colFilters.clearFilter,
      render: (r) => <><span style={{ marginRight: 6 }}>{countryCodeToFlag(r.countryCode)}</span>{r.country}</>,
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      filterable: true,
      filterValues: colFilters.getUniqueValues('status'),
      selectedFilters: colFilters.filters['status'] ?? [],
      onFilterApply: colFilters.applyFilter,
      onFilterClear: colFilters.clearFilter,
      render: (r) => <Badge label={r.status} colorMap={STATUS_COLORS} />,
      renderFilterValue: (v) => <Badge label={v} colorMap={STATUS_COLORS} />,
    },
    {
      key: 'licenseType',
      label: 'License Type',
      sortable: true,
      filterable: true,
      filterValues: colFilters.getUniqueValues('licenseType'),
      selectedFilters: colFilters.filters['licenseType'] ?? [],
      onFilterApply: colFilters.applyFilter,
      onFilterClear: colFilters.clearFilter,
    },
    {
      key: 'regulator',
      label: 'Regulator',
      sortable: true,
      filterable: true,
      filterValues: colFilters.getUniqueValues('regulator'),
      selectedFilters: colFilters.filters['regulator'] ?? [],
      onFilterApply: colFilters.applyFilter,
      onFilterClear: colFilters.clearFilter,
    },
  ];

  if (loading) {
    return (
      <div className="st-page" style={{ paddingTop: 120, textAlign: 'center' }}>
        <div className="st-loading-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="st-page" style={{ paddingTop: 120, textAlign: 'center' }}>
        <h4 style={{ marginBottom: 12 }}>Failed to load entities</h4>
        <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: '0.875rem' }}>{error}</p>
        <button className="st-btn" onClick={refetch}>Try Again</button>
      </div>
    );
  }

  return (
    <div ref={revealRef} className="st-page">
      <div className="reveal" style={{ marginBottom: 32 }}>
        <h2 style={{ marginBottom: 4 }}>Entity Directory</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          {safeEntities.length.toLocaleString()} licensed entities worldwide
        </p>
      </div>

      <div className="reveal">
        <DataTable
          columns={columns}
          data={table.paginated as (Entity & Record<string, unknown>)[]}
          sort={table.sort}
          onSort={table.toggleSort}
          onRowClick={(row) => navigate(`/entities/${(row as unknown as Entity).id}`)}
          page={table.page}
          totalPages={table.totalPages}
          onPageChange={table.setPage}
          totalFiltered={table.totalFiltered}
          totalCount={safeEntities.length}
          pageSize={table.pageSize}
          onPageSizeChange={table.setPageSize}
          search={table.search}
          onSearchChange={table.setSearch}
          searchPlaceholder="Search entities..."
        />
      </div>
    </div>
  );
}
