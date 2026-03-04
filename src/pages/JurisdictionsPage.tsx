import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getJurisdictions, getStablecoins } from '../data/dataLoader';
import type { Jurisdiction, RegimeType, TravelRuleStatus, Stablecoin, StablecoinJurisdictionStatus } from '../types';
import { REGIME_CHIP_COLORS, TRAVEL_RULE_COLORS } from '../theme';
import { useReveal } from '../hooks/useAnimations';
import { useTableState } from '../hooks/useFilters';
import { useColumnFilters } from '../hooks/useColumnFilters';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { countryCodeToFlag } from '../utils/countryFlags';
import Badge from '../components/ui/Badge';
import DataTable, { type Column } from '../components/ui/DataTable';
import WorldMap, { type MapColorMode } from '../components/map/WorldMap';
import SegmentedControl from '../components/ui/SegmentedControl';

export default function JurisdictionsPage() {
  useDocumentMeta({
    title: 'Crypto Regulation Map — 206 Countries',
    description: 'Interactive world map of cryptocurrency regulations. Compare VASP licensing regimes, Travel Rule compliance, and stablecoin status across 206 jurisdictions.',
    path: '/jurisdictions',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Dataset',
      name: 'RemiDe Crypto Jurisdictions Dataset',
      description: 'Regulatory classification of 206 countries for cryptocurrency and VASP licensing.',
      url: 'https://anton-remide.github.io/remide/jurisdictions',
      license: 'https://creativecommons.org/licenses/by-nc/4.0/',
    },
  });

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: allJurisdictions, loading: jLoading, error, refetch } = useSupabaseQuery(getJurisdictions);
  const { data: allStablecoins } = useSupabaseQuery(getStablecoins);
  const loading = jLoading;
  const revealRef = useReveal(loading);

  const [mapColorMode, setMapColorMode] = useState<MapColorMode>('regime');
  const [activeMiniStats, setActiveMiniStats] = useState<string[]>([]);

  const safeJurisdictions = allJurisdictions ?? [];

  // Build best stablecoin regulatory status per country (from Supabase data)
  // Priority: Compliant > Allowed > Pending > Restricted > Non-Compliant > Discontinued > Unclear
  const stablecoinStatuses = useMemo(() => {
    const priority: Record<string, number> = {
      Compliant: 1, Allowed: 2, Pending: 3, Restricted: 4,
      'Non-Compliant': 5, Discontinued: 6, Unclear: 7,
    };
    const m = new Map<string, string>();
    (allStablecoins ?? []).forEach((s: Stablecoin) => {
      s.majorJurisdictions.forEach((j) => {
        const code = j.code.toUpperCase();
        const current = m.get(code);
        const currentP = current ? (priority[current] ?? 99) : 99;
        const newP = priority[j.status as StablecoinJurisdictionStatus] ?? 99;
        if (newP < currentP) m.set(code, j.status);
      });
    });
    return m;
  }, [allStablecoins]);

  // Column filters hook (works on full dataset)
  const colFilters = useColumnFilters<Jurisdiction & Record<string, unknown>>(
    safeJurisdictions as (Jurisdiction & Record<string, unknown>)[],
  );

  // Derive regime/travelRule selections for the map from column filters
  const regimes = (colFilters.filters['regime'] ?? []) as RegimeType[];
  const travelRules = (colFilters.filters['travelRule'] ?? []) as TravelRuleStatus[];

  // Map mini-stat label (lowercase) → filter field values (title-case)
  // "none / unclear" maps to TWO regime values, "not implemented" maps to two travel rule values
  const miniStatLabelToValues: Record<string, string[]> = {
    licensing: ['Licensing'], registration: ['Registration'], sandbox: ['Sandbox'], ban: ['Ban'],
    'none / unclear': ['None', 'Unclear'],
    enforced: ['Enforced'], legislated: ['Legislated'], 'in progress': ['In Progress'],
    'not implemented': ['Not Implemented', 'N/A'],
    // Stablecoin status labels → status values
    'compliant / allowed': ['Compliant', 'Allowed'],
    pending: ['Pending'],
    restricted: ['Restricted'],
    'non-compliant': ['Non-Compliant', 'Discontinued'],
    'no data': ['Unclear', 'None'],
  };

  // Derive stablecoin status filters from activeMiniStats when in stablecoin mode
  const stablecoinStatusFilters = useMemo(() => {
    if (mapColorMode !== 'stablecoin' || activeMiniStats.length === 0) return [] as string[];
    return activeMiniStats.flatMap((l) => miniStatLabelToValues[l] ?? [l]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapColorMode, activeMiniStats]);

  const handleMiniStatClick = useCallback((label: string) => {
    setActiveMiniStats((prev) => {
      const isActive = prev.includes(label);
      const next = isActive ? prev.filter((l) => l !== label) : [...prev, label];

      // In stablecoin mode, we only update activeMiniStats — map handles it via selectedStablecoinStatuses
      if (mapColorMode === 'stablecoin') {
        return next;
      }

      // For regime/travelRule modes, apply column filters
      const filterField = mapColorMode === 'travelRule' ? 'travelRule' : 'regime';
      if (next.length === 0) {
        colFilters.clearFilter(filterField);
      } else {
        const combined = next.flatMap((l) => miniStatLabelToValues[l] ?? [l]);
        colFilters.applyFilter(filterField, combined);
      }
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapColorMode, colFilters.applyFilter, colFilters.clearFilter]);

  const filterFn = useCallback((j: Jurisdiction, q: string) => {
    return j.name.toLowerCase().includes(q) || j.regulator.toLowerCase().includes(q);
  }, []);

  const table = useTableState(colFilters.filtered as Jurisdiction[], filterFn, { field: 'name', direction: 'asc' });

  // Sync header search query param → table search
  const qParam = searchParams.get('q');
  useEffect(() => {
    if (qParam) {
      table.setSearch(qParam);
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qParam]);

  const columns: Column<Jurisdiction>[] = [
    { key: 'name', label: 'Country', sortable: true, render: (r) => <><span style={{ marginRight: 6 }}>{countryCodeToFlag(r.code)}</span>{r.name}</> },
    {
      key: 'regime',
      label: 'Regime',
      sortable: true,
      filterable: true,
      filterValues: colFilters.getUniqueValues('regime'),
      selectedFilters: colFilters.filters['regime'] ?? [],
      onFilterApply: colFilters.applyFilter,
      onFilterClear: colFilters.clearFilter,
      render: (r) => <Badge label={r.regime} colorMap={REGIME_CHIP_COLORS} />,
      renderFilterValue: (v) => <Badge label={v} colorMap={REGIME_CHIP_COLORS} />,
    },
    {
      key: 'travelRule',
      label: 'Travel Rule',
      sortable: true,
      filterable: true,
      filterValues: colFilters.getUniqueValues('travelRule'),
      selectedFilters: colFilters.filters['travelRule'] ?? [],
      onFilterApply: colFilters.applyFilter,
      onFilterClear: colFilters.clearFilter,
      render: (r) => <Badge label={r.travelRule} colorMap={TRAVEL_RULE_COLORS} />,
      renderFilterValue: (v) => <Badge label={v} colorMap={TRAVEL_RULE_COLORS} />,
    },
    { key: 'entityCount', label: 'Entities', sortable: true, width: '100px' },
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
        <h4 style={{ marginBottom: 12 }}>Failed to load jurisdictions</h4>
        <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: '0.875rem' }}>{error}</p>
        <button className="st-btn" onClick={refetch}>Try Again</button>
      </div>
    );
  }

  return (
    <div ref={revealRef} className="st-map-section">
      {/* Map Frame — rounded corners */}
      <div className="st-map-frame">
        <WorldMap
          jurisdictions={safeJurisdictions}
          selectedRegimes={regimes}
          selectedTravelRules={travelRules}
          selectedStablecoinStatuses={stablecoinStatusFilters}
          onCountryClick={(code) => navigate(`/jurisdictions/${code}`)}
          onMiniStatClick={handleMiniStatClick}
          activeMiniStats={activeMiniStats}
          colorMode={mapColorMode}
          stablecoinStatuses={stablecoinStatuses}
        />
        {/* Toggles overlay — top-left */}
        <div className="st-map-toggles-overlay">
          <SegmentedControl
            options={[
              { value: 'regime', label: 'Regulation' },
              { value: 'travelRule', label: 'Travel Rule' },
              { value: 'stablecoin', label: 'Stablecoins' },
            ]}
            value={mapColorMode}
            onChange={(v) => {
              // Reset mini-stat filter when switching mode
              if (activeMiniStats.length > 0) {
                // Clear column filters for previous mode (stablecoin mode doesn't use column filters)
                if (mapColorMode === 'travelRule') colFilters.clearFilter('travelRule');
                else if (mapColorMode === 'regime') colFilters.clearFilter('regime');
                setActiveMiniStats([]);
              }
              setMapColorMode(v as MapColorMode);
            }}
          />
        </div>
      </div>

      {/* Table */}
      <div style={{ marginTop: 24 }}>
        <DataTable
          columns={columns}
          data={table.paginated as (Jurisdiction & Record<string, unknown>)[]}
          sort={table.sort}
          onSort={table.toggleSort}
          onRowClick={(row) => navigate(`/jurisdictions/${(row as unknown as Jurisdiction).code}`)}
          page={table.page}
          totalPages={table.totalPages}
          onPageChange={table.setPage}
          totalFiltered={table.totalFiltered}
          totalCount={safeJurisdictions.length}
          pageSize={table.pageSize}
          onPageSizeChange={table.setPageSize}
          search={table.search}
          onSearchChange={table.setSearch}
          searchPlaceholder="Search countries..."
        />
      </div>
    </div>
  );
}
