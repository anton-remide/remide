import { useParams, useNavigate } from 'react-router-dom';
import { useCallback, useMemo } from 'react';
import { getJurisdictionByCode, getEntitiesByCountry } from '../data/dataLoader';
import type { Entity } from '../types';
import { REGIME_CHIP_COLORS, TRAVEL_RULE_COLORS, STATUS_COLORS } from '../theme';
import { useReveal } from '../hooks/useAnimations';
import { useTableState } from '../hooks/useFilters';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import Breadcrumb from '../components/ui/Breadcrumb';
import Badge from '../components/ui/Badge';
import SearchInput from '../components/ui/SearchInput';
import DataTable, { type Column } from '../components/ui/DataTable';

export default function JurisdictionDetailPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  const jurisdictionFetcher = useCallback(() => getJurisdictionByCode(code ?? ''), [code]);
  const entitiesFetcher = useCallback(() => getEntitiesByCountry(code ?? ''), [code]);

  const { data: jurisdiction, loading: jLoading, error: jError } = useSupabaseQuery(jurisdictionFetcher, [code]);
  const { data: entities, loading: eLoading, error: eError } = useSupabaseQuery(entitiesFetcher, [code]);

  const loading = jLoading || eLoading;
  const revealRef = useReveal(loading);

  const safeEntities = useMemo(() => entities ?? [], [entities]);

  const filterFn = useCallback((e: Entity, q: string) => {
    return e.name.toLowerCase().includes(q);
  }, []);

  const table = useTableState(safeEntities, filterFn, { field: 'name', direction: 'asc' });

  if (loading) {
    return (
      <div className="st-page" style={{ paddingTop: 120, textAlign: 'center' }}>
        <div className="st-loading-pulse" />
      </div>
    );
  }

  if (jError || eError) {
    return (
      <div className="st-page" style={{ paddingTop: 120, textAlign: 'center' }}>
        <h4 style={{ marginBottom: 12 }}>Failed to load data</h4>
        <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: '0.875rem' }}>{jError || eError}</p>
        <button className="st-btn" onClick={() => navigate('/jurisdictions')}>Back to Jurisdictions</button>
      </div>
    );
  }

  if (!jurisdiction) {
    return (
      <div className="st-page" style={{ paddingTop: 48, textAlign: 'center' }}>
        <h4>Jurisdiction not found</h4>
        <button className="st-btn" style={{ marginTop: 16 }} onClick={() => navigate('/jurisdictions')}>
          Back to Jurisdictions
        </button>
      </div>
    );
  }

  const entityColumns: Column<Entity>[] = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'status', label: 'Status', sortable: true, render: (r) => <Badge label={r.status} colorMap={STATUS_COLORS} /> },
    { key: 'licenseType', label: 'License Type', sortable: true },
    { key: 'activities', label: 'Activities', render: (r) => r.activities.slice(0, 3).join(', ') || '—' },
  ];

  return (
    <div ref={revealRef} className="st-page">
      <div className="reveal">
        <Breadcrumb crumbs={[
          { label: 'Home', to: '/' },
          { label: 'Jurisdictions', to: '/jurisdictions' },
          { label: jurisdiction.name },
        ]} />
      </div>

      <div className="reveal" style={{ marginTop: 24, marginBottom: 32 }}>
        <h2 style={{ fontFamily: 'var(--font2)', marginBottom: 12 }}>{jurisdiction.name}</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Badge label={jurisdiction.regime} colorMap={REGIME_CHIP_COLORS} />
          <Badge label={jurisdiction.travelRule} colorMap={TRAVEL_RULE_COLORS} />
        </div>
      </div>

      <div className="reveal st-info-card clip-lg" style={{ marginBottom: 32 }}>
        <div className="st-info-row">
          <span className="st-info-label">Regulator</span>
          <span className="st-info-value">{jurisdiction.regulator || '—'}</span>
        </div>
        <div className="st-info-row">
          <span className="st-info-label">Key Law</span>
          <span className="st-info-value">{jurisdiction.keyLaw || '—'}</span>
        </div>
        <div className="st-info-row">
          <span className="st-info-label">Entities</span>
          <span className="st-info-value">{jurisdiction.entityCount}</span>
        </div>
        {jurisdiction.notes && (
          <div className="st-info-row">
            <span className="st-info-label">Notes</span>
            <span className="st-info-value">{jurisdiction.notes}</span>
          </div>
        )}
      </div>

      {jurisdiction.sources.length > 0 && (
        <div className="reveal" style={{ marginBottom: 32 }}>
          <h6 style={{ marginBottom: 12 }}>Sources</h6>
          <div className="st-card clip-lg" style={{ padding: 0, overflow: 'hidden' }}>
            {jurisdiction.sources.map((s, i) => (
              <a
                key={i}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="st-related-link"
                style={{ fontSize: '0.875rem' }}
              >
                {s.name}
              </a>
            ))}
          </div>
        </div>
      )}

      {safeEntities.length > 0 && (
        <>
          <div className="reveal" style={{ marginBottom: 16 }}>
            <h5 style={{ marginBottom: 16 }}>Entities in {jurisdiction.name}</h5>
            <SearchInput value={table.search} onChange={table.setSearch} placeholder="Search entities..." />
          </div>
          <div className="reveal">
            <div className="clip-lg">
              <DataTable
                columns={entityColumns}
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
        </>
      )}
    </div>
  );
}
