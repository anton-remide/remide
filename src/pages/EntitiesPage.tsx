import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getEntities, getJurisdictions, getCbdcs } from '../data/dataLoader';
import { expandRegionalCode } from '../data/regionCodes';
import type { Entity, Jurisdiction, Cbdc, RegimeType, TravelRuleStatus } from '../types';
import { STATUS_COLORS } from '../theme';
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

export default function EntitiesPage() {
  useDocumentMeta({
    title: 'Licensed Crypto Entities — VASP Registry',
    description: 'Browse 4,000+ licensed cryptocurrency service providers (VASPs) across 82 countries. Filter by status, country, and license type.',
    path: '/entities',
  });

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: allEntities, loading, error, refetch } = useSupabaseQuery(getEntities);
  const revealRef = useReveal(loading);

  const safeEntities = allEntities ?? [];

  // ── Map data ──
  const [mapColorMode, setMapColorMode] = useState<MapColorMode>('regime');
  const [activeMiniStats, setActiveMiniStats] = useState<string[]>([]);

  const { data: allJurisdictions } = useSupabaseQuery(getJurisdictions);
  const { data: allCbdcsForMap } = useSupabaseQuery(getCbdcs);
  const safeJurisdictions = allJurisdictions ?? [];

  // Stablecoin regulatory stage per country
  const stageLabels: Record<number, string> = {
    3: 'Live', 2: 'In Progress', 1: 'Developing', 0: 'No Framework',
  };

  const stablecoinStatuses = useMemo(() => {
    const m = new Map<string, string>();
    safeJurisdictions.forEach((j: Jurisdiction) => {
      if (j.stablecoinStage !== null && j.stablecoinStage !== undefined) {
        m.set(j.code.toUpperCase(), stageLabels[j.stablecoinStage] ?? 'No Data');
      }
    });
    return m;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeJurisdictions]);

  // CBDC statuses per country (expand "EU" → member states)
  const cbdcStatuses = useMemo(() => {
    const m = new Map<string, string>();
    (allCbdcsForMap ?? []).forEach((c: Cbdc) => {
      const codes = expandRegionalCode(c.countryCode);
      codes.forEach((cc) => { if (!m.has(cc)) m.set(cc, c.status); });
    });
    return m;
  }, [allCbdcsForMap]);

  const mapStatuses = mapColorMode === 'cbdc' ? cbdcStatuses
    : mapColorMode === 'stablecoin' ? stablecoinStatuses
    : stablecoinStatuses;

  // Derive regime/travelRule selections for the map from column filters
  const colFilters = useColumnFilters<Entity & Record<string, unknown>>(
    safeEntities as (Entity & Record<string, unknown>)[],
  );

  // Mini-stat label (lowercase) → filter field values
  const miniStatLabelToValues: Record<string, string[]> = {
    licensing: ['Licensing'], registration: ['Registration'], sandbox: ['Sandbox'], ban: ['Ban'],
    'none / unclear': ['None', 'Unclear'],
    enforced: ['Enforced'], legislated: ['Legislated'], 'in progress': ['In Progress'],
    'not implemented': ['Not Implemented', 'N/A'],
    live: ['Live'], developing: ['Developing'], 'no framework': ['No Framework'], 'no data': ['No Data'],
    launched: ['Launched'], pilot: ['Pilot'], development: ['Development'], research: ['Research'],
  };

  // For map highlighting: derive regime/travelRule from active mini-stats when in those modes
  const mapRegimes = useMemo(() => {
    if (mapColorMode !== 'regime' || activeMiniStats.length === 0) return [] as RegimeType[];
    return activeMiniStats.flatMap((l) => miniStatLabelToValues[l] ?? [l]) as RegimeType[];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapColorMode, activeMiniStats]);

  const mapTravelRules = useMemo(() => {
    if (mapColorMode !== 'travelRule' || activeMiniStats.length === 0) return [] as TravelRuleStatus[];
    return activeMiniStats.flatMap((l) => miniStatLabelToValues[l] ?? [l]) as TravelRuleStatus[];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapColorMode, activeMiniStats]);

  const stablecoinStatusFilters = useMemo(() => {
    if ((mapColorMode !== 'stablecoin' && mapColorMode !== 'cbdc') || activeMiniStats.length === 0) return [] as string[];
    return activeMiniStats.flatMap((l) => miniStatLabelToValues[l] ?? [l]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapColorMode, activeMiniStats]);

  // Helper: get matching country codes for a set of status values from a Map
  const getMatchingCodes = useCallback((statusMap: Map<string, string>, statusValues: string[]) => {
    const codes: string[] = [];
    statusMap.forEach((status, code) => {
      if (statusValues.includes(status)) codes.push(code);
    });
    return codes;
  }, []);

  // Helper: get matching country codes from jurisdictions for regime/travelRule modes
  const getMatchingCodesFromJurisdictions = useCallback((field: 'regime' | 'travelRule', values: string[]) => {
    return safeJurisdictions
      .filter((j) => values.includes(String(j[field])))
      .map((j) => j.code.toUpperCase());
  }, [safeJurisdictions]);

  const handleMiniStatClick = useCallback((label: string) => {
    setActiveMiniStats((prev) => {
      const next = prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label];

      if (next.length === 0) {
        colFilters.clearFilter('countryCode');
        return next;
      }

      const statusValues = next.flatMap((l) => miniStatLabelToValues[l] ?? [l]);
      let matchingCodes: string[];

      if (mapColorMode === 'stablecoin') {
        matchingCodes = getMatchingCodes(stablecoinStatuses, statusValues);
      } else if (mapColorMode === 'cbdc') {
        matchingCodes = getMatchingCodes(cbdcStatuses, statusValues);
      } else if (mapColorMode === 'travelRule') {
        matchingCodes = getMatchingCodesFromJurisdictions('travelRule', statusValues);
      } else {
        matchingCodes = getMatchingCodesFromJurisdictions('regime', statusValues);
      }

      colFilters.applyFilter('countryCode', matchingCodes);
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapColorMode, colFilters.applyFilter, colFilters.clearFilter, stablecoinStatuses, cbdcStatuses, getMatchingCodes, getMatchingCodesFromJurisdictions]);

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
    <div ref={revealRef} className="st-map-section">
      {/* Map Frame */}
      <div className="st-map-frame">
        <WorldMap
          jurisdictions={safeJurisdictions}
          selectedRegimes={mapRegimes}
          selectedTravelRules={mapTravelRules}
          selectedStablecoinStatuses={stablecoinStatusFilters}
          onCountryClick={(code) => navigate(`/jurisdictions/${code}`)}
          onMiniStatClick={handleMiniStatClick}
          activeMiniStats={activeMiniStats}
          colorMode={mapColorMode}
          stablecoinStatuses={mapStatuses}
        />
        {/* Toggles overlay — top-left */}
        <div className="st-map-toggles-overlay">
          <SegmentedControl
            options={[
              { value: 'regime', label: 'Regulation' },
              { value: 'travelRule', label: 'Travel Rule' },
              { value: 'stablecoin', label: 'Stablecoins' },
              { value: 'cbdc', label: 'CBDCs' },
            ]}
            value={mapColorMode}
            onChange={(v) => {
              if (activeMiniStats.length > 0) {
                colFilters.clearFilter('countryCode');
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
