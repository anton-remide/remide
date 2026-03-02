import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { getEntities } from '../data/dataLoader';
import type { Entity, EntityStatus } from '../types';
import { STATUS_COLORS } from '../theme';
import { useReveal } from '../hooks/useAnimations';
import { useTableState } from '../hooks/useFilters';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import SearchInput from '../components/ui/SearchInput';
import Badge from '../components/ui/Badge';
import DataTable, { type Column } from '../components/ui/DataTable';

export default function EntitiesPage() {
  const navigate = useNavigate();
  const { data: allEntities, loading, error, refetch } = useSupabaseQuery(getEntities);
  const revealRef = useReveal(loading);

  const safeEntities = allEntities ?? [];

  const [country, setCountry] = useState('');
  const [status, setStatus] = useState('');
  const [regulator, setRegulator] = useState('');

  // Unique values for dropdowns
  const countryOptions = useMemo(() => [...new Set(safeEntities.map((e) => e.country))].sort(), [safeEntities]);
  const statusOptions = useMemo(() => [...new Set(safeEntities.map((e) => e.status))].sort(), [safeEntities]);
  const regulatorOptions = useMemo(() => [...new Set(safeEntities.map((e) => e.regulator))].sort(), [safeEntities]);

  const preFiltered = useMemo(() => {
    let data = safeEntities;
    if (country) data = data.filter((e) => e.country === country);
    if (status) data = data.filter((e) => e.status === status);
    if (regulator) data = data.filter((e) => e.regulator === regulator);
    return data;
  }, [safeEntities, country, status, regulator]);

  const filterFn = useCallback((e: Entity, q: string) => {
    return e.name.toLowerCase().includes(q) || e.country.toLowerCase().includes(q);
  }, []);

  const table = useTableState(preFiltered, filterFn, { field: 'name', direction: 'asc' });

  const activeFilters = [
    country && { label: `Country: ${country}`, clear: () => setCountry('') },
    status && { label: `Status: ${status}`, clear: () => setStatus('') },
    regulator && { label: `Regulator: ${regulator}`, clear: () => setRegulator('') },
  ].filter(Boolean) as { label: string; clear: () => void }[];

  const columns: Column<Entity>[] = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'country', label: 'Country', sortable: true },
    { key: 'status', label: 'Status', sortable: true, render: (r) => <Badge label={r.status} colorMap={STATUS_COLORS} /> },
    { key: 'licenseType', label: 'License Type', sortable: true },
    { key: 'regulator', label: 'Regulator', sortable: true },
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

      <div className="reveal" style={{ marginBottom: 16 }}>
        <SearchInput
          value={table.search}
          onChange={table.setSearch}
          placeholder="Search entities by name or country..."
        />
      </div>

      <div className="reveal row g-2" style={{ marginBottom: 16 }}>
        <div className="col-12 col-md-4">
          <select className="st-select" style={{ width: '100%' }} value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="">All Countries</option>
            {countryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="col-12 col-md-4">
          <select className="st-select" style={{ width: '100%' }} value={status} onChange={(e) => setStatus(e.target.value as EntityStatus | '')}>
            <option value="">All Statuses</option>
            {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="col-12 col-md-4">
          <select className="st-select" style={{ width: '100%' }} value={regulator} onChange={(e) => setRegulator(e.target.value)}>
            <option value="">All Regulators</option>
            {regulatorOptions.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>

      {activeFilters.length > 0 && (
        <div className="reveal" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {activeFilters.map((f) => (
            <button key={f.label} className="st-filter-chip-remove" onClick={f.clear}>
              {f.label}
              <X size={12} />
            </button>
          ))}
        </div>
      )}

      <div className="reveal">
        <div className="clip-lg">
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
          />
        </div>
      </div>
    </div>
  );
}
