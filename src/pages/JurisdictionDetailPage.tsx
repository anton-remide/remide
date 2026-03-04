import { useParams, useNavigate } from 'react-router-dom';
import { useCallback, useMemo } from 'react';
import { getJurisdictionByCode, getEntitiesByCountry, getStablecoinsByCountry, getCbdcsByCountry } from '../data/dataLoader';
import type { Entity } from '../types';
import { REGIME_CHIP_COLORS, TRAVEL_RULE_COLORS, STATUS_COLORS } from '../theme';
import { useReveal } from '../hooks/useAnimations';
import { useTableState } from '../hooks/useFilters';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { countryCodeToFlag } from '../utils/countryFlags';
import Breadcrumb from '../components/ui/Breadcrumb';
import Badge from '../components/ui/Badge';
import DataTable, { type Column } from '../components/ui/DataTable';
import WorldMap from '../components/map/WorldMap';

export default function JurisdictionDetailPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  const jurisdictionFetcher = useCallback(() => getJurisdictionByCode(code ?? ''), [code]);
  const entitiesFetcher = useCallback(() => getEntitiesByCountry(code ?? ''), [code]);

  const { data: jurisdiction, loading: jLoading, error: jError } = useSupabaseQuery(jurisdictionFetcher, [code]);
  const { data: entities, loading: eLoading, error: eError } = useSupabaseQuery(entitiesFetcher, [code]);

  const loading = jLoading || eLoading;
  const revealRef = useReveal(loading);

  useDocumentMeta({
    title: jurisdiction ? `${jurisdiction.name} — Crypto Regulation` : 'Jurisdiction',
    description: jurisdiction
      ? `Cryptocurrency regulation in ${jurisdiction.name}: ${jurisdiction.regime} regime, ${(entities ?? []).length} licensed VASPs. Travel Rule: ${jurisdiction.travelRule}.`
      : 'Loading jurisdiction details...',
    path: code ? `/jurisdictions/${code}` : undefined,
  });

  const safeEntities = useMemo(() => entities ?? [], [entities]);

  // Stablecoins & CBDCs per country (synchronous — static JSON)
  const countryStablecoins = useMemo(
    () => code ? getStablecoinsByCountry(code) : [],
    [code],
  );
  const countryCbdcs = useMemo(
    () => code ? getCbdcsByCountry(code) : [],
    [code],
  );

  // Mini-map needs just this jurisdiction for coloring
  const jurisdictionList = useMemo(
    () => jurisdiction ? [jurisdiction] : [],
    [jurisdiction],
  );

  const filterFn = useCallback((e: Entity, q: string) => {
    return e.name.toLowerCase().includes(q) || (e.licenseType ?? '').toLowerCase().includes(q);
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

      {/* Title, badges, description */}
      <div className="reveal" style={{ marginTop: 24, marginBottom: 20 }}>
        <h2 style={{ fontFamily: 'var(--font2)', marginBottom: 12 }}>
          <span style={{ marginRight: 8 }}>{countryCodeToFlag(jurisdiction.code)}</span>
          {jurisdiction.name}
        </h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: jurisdiction.description ? 20 : 0 }}>
          <Badge label={jurisdiction.regime} colorMap={REGIME_CHIP_COLORS} />
          <Badge label={jurisdiction.travelRule} colorMap={TRAVEL_RULE_COLORS} />
        </div>
        {jurisdiction.description && (
          <p style={{ color: 'var(--text)', lineHeight: 1.65, fontSize: '0.9375rem', margin: 0 }}>
            {jurisdiction.description}
          </p>
        )}
      </div>

      {/* Info card + Mini map — aligned side by side */}
      <div className="reveal" style={{ display: 'flex', gap: 24, alignItems: 'stretch', flexWrap: 'wrap', marginBottom: 32 }}>
        <div style={{ flex: '1 1 400px', minWidth: 0 }}>
          <div className="st-info-card clip-lg" style={{ height: '100%', margin: 0 }}>
            <div className="st-info-row">
              <span className="st-info-label">Regulator</span>
              <span className="st-info-value">{jurisdiction.regulator || '—'}</span>
            </div>
            <div className="st-info-row">
              <span className="st-info-label">Key Law</span>
              <span className="st-info-value">{jurisdiction.keyLaw || '—'}</span>
            </div>
            <div className="st-info-row">
              <span className="st-info-label">Travel Rule</span>
              <span className="st-info-value">
                <Badge label={jurisdiction.travelRule} colorMap={TRAVEL_RULE_COLORS} />
              </span>
            </div>
            <div className="st-info-row">
              <span className="st-info-label">Licensed Entities</span>
              <span className="st-info-value">{jurisdiction.entityCount}</span>
            </div>
            <div className="st-info-row">
              <span className="st-info-label">Stablecoins</span>
              <span className="st-info-value">
                {countryStablecoins.length > 0
                  ? `${countryStablecoins.length} (${countryStablecoins.map((s) => s.ticker).join(', ')})`
                  : '—'}
              </span>
            </div>
            <div className="st-info-row">
              <span className="st-info-label">CBDCs</span>
              <span className="st-info-value">
                {countryCbdcs.length > 0
                  ? countryCbdcs.map((c) => `${c.name} (${c.status})`).join(', ')
                  : '—'}
              </span>
            </div>
            {jurisdiction.notes && (
              <div className="st-info-row">
                <span className="st-info-label">Notes</span>
                <span className="st-info-value">{jurisdiction.notes}</span>
              </div>
            )}
            {jurisdiction.sources.length > 0 && (
              <div className="st-info-row">
                <span className="st-info-label">Sources</span>
                <span className="st-info-value">
                  {jurisdiction.sources.map((s, i) => (
                    <span key={i}>
                      {i > 0 && <span style={{ margin: '0 6px', color: 'var(--text-muted)' }}>·</span>}
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="st-inline-link">
                        {s.name}
                      </a>
                    </span>
                  ))}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Mini map — same height as info card */}
        <div style={{ flex: '1 1 360px', minHeight: 280, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', position: 'relative' }}>
          <WorldMap
            height="100%"
            jurisdictions={jurisdictionList}
            compact
            focusCountry={code?.toUpperCase()}
            onCountryClick={(c) => c !== code?.toUpperCase() && navigate(`/jurisdictions/${c}`)}
          />
        </div>
      </div>

      {safeEntities.length > 0 && (
        <>
          <div className="reveal" style={{ marginBottom: 16 }}>
            <h5>Entities in {jurisdiction.name}</h5>
          </div>
          <div className="reveal">
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
              search={table.search}
              onSearchChange={table.setSearch}
              searchPlaceholder="Search entities..."
              pageSize={table.pageSize}
              onPageSizeChange={table.setPageSize}
            />
          </div>
        </>
      )}
    </div>
  );
}
