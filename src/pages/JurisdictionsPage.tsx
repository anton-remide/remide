import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getJurisdictions } from '../data/dataLoader';
import type { Jurisdiction, RegimeType, TravelRuleStatus } from '../types';
import { REGIME_CHIP_COLORS, TRAVEL_RULE_COLORS } from '../theme';
import { useReveal } from '../hooks/useAnimations';
import { useTableState } from '../hooks/useFilters';
import { useColumnFilters } from '../hooks/useColumnFilters';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { countryCodeToFlag } from '../utils/countryFlags';
import Badge from '../components/ui/Badge';
import DataTable, { type Column } from '../components/ui/DataTable';
import WorldMap, { type MapColorMode } from '../components/map/WorldMap';
import SegmentedControl from '../components/ui/SegmentedControl';

export default function JurisdictionsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: allJurisdictions, loading, error, refetch } = useSupabaseQuery(getJurisdictions);
  const revealRef = useReveal(loading);

  const [mapColorMode, setMapColorMode] = useState<MapColorMode>('regime');
  const [activeMiniStat, setActiveMiniStat] = useState<string | null>(null);

  const safeJurisdictions = allJurisdictions ?? [];

  // Column filters hook (works on full dataset)
  const colFilters = useColumnFilters<Jurisdiction & Record<string, unknown>>(
    safeJurisdictions as (Jurisdiction & Record<string, unknown>)[],
  );

  // Derive regime/travelRule selections for the map from column filters
  const regimes = (colFilters.filters['regime'] ?? []) as RegimeType[];
  const travelRules = (colFilters.filters['travelRule'] ?? []) as TravelRuleStatus[];

  // Map mini-stat label (lowercase) → filter field value (title-case)
  const miniStatLabelToValue: Record<string, string> = {
    licensing: 'Licensing', registration: 'Registration', sandbox: 'Sandbox', ban: 'Ban',
    enforced: 'Enforced', legislated: 'Legislated', 'in progress': 'In Progress',
  };

  const handleMiniStatClick = useCallback((label: string) => {
    const filterField = mapColorMode === 'travelRule' ? 'travelRule' : 'regime';
    const value = miniStatLabelToValue[label] ?? label;

    if (activeMiniStat === label) {
      // Toggle off — clear filter
      colFilters.clearFilter(filterField);
      setActiveMiniStat(null);
    } else {
      // Toggle on — set filter to just this value
      colFilters.applyFilter(filterField, [value]);
      setActiveMiniStat(label);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapColorMode, activeMiniStat, colFilters.applyFilter, colFilters.clearFilter]);

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
    <div ref={revealRef} className="st-page" style={{ paddingBottom: 48 }}>
      {/* Map Frame — rounded corners, inside max-width container */}
      <div className="st-map-frame">
        <WorldMap
          jurisdictions={safeJurisdictions}
          selectedRegimes={regimes}
          selectedTravelRules={travelRules}
          onCountryClick={(code) => navigate(`/jurisdictions/${code}`)}
          onMiniStatClick={handleMiniStatClick}
          activeMiniStat={activeMiniStat}
          colorMode={mapColorMode}
        />
        {/* Toggles overlay — top-left */}
        <div className="st-map-toggles-overlay">
          <SegmentedControl
            options={[
              { value: 'regime', label: 'Crypto Regulation' },
              { value: 'travelRule', label: 'Travel Rule' },
            ]}
            value={mapColorMode}
            onChange={(v) => {
              setMapColorMode(v as MapColorMode);
              // Reset mini-stat filter when switching mode
              if (activeMiniStat) {
                const oldField = mapColorMode === 'travelRule' ? 'travelRule' : 'regime';
                colFilters.clearFilter(oldField);
                setActiveMiniStat(null);
              }
            }}
          />
        </div>
      </div>

      {/* Table */}
      <div style={{ marginTop: 24 }} className="reveal">
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
