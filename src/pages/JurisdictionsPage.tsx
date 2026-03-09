import { useState, useCallback, useEffect, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getJurisdictions, getCbdcs } from '../data/dataLoader';
import { expandRegionalCode } from '../data/regionCodes';
import type { Jurisdiction, Cbdc, RegimeType, TravelRuleStatus } from '../types';
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
    title: 'Stablecoin Regulation Map — 206 Jurisdictions',
    description: 'Interactive regulatory map covering stablecoin frameworks, VASP licensing regimes, Travel Rule compliance, and CBDC status across 206 jurisdictions.',
    path: '/jurisdictions',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Dataset',
      name: 'RemiDe Stablecoin Regulatory Intelligence Dataset',
      description: 'Stablecoin regulation, VASP licensing regimes, and Travel Rule compliance across 206 jurisdictions.',
      url: 'https://anton-remide.github.io/remide/jurisdictions',
      license: 'https://creativecommons.org/licenses/by-nc/4.0/',
    },
  });

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: allJurisdictions, loading: jLoading, error, refetch } = useSupabaseQuery(getJurisdictions);
  const loading = jLoading;
  const revealRef = useReveal(loading);

  const [mapColorMode, setMapColorMode] = useState<MapColorMode>('regime');
  const [activeMiniStats, setActiveMiniStats] = useState<string[]>([]);
  const [insightOpen, setInsightOpen] = useState(false);

  const safeJurisdictions = allJurisdictions ?? [];

  // Stablecoin regulatory stage per country (Stride data: 0=No Framework, 1=Developing, 2=In Progress, 3=Live)
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
  const { data: allCbdcsForMap } = useSupabaseQuery(getCbdcs);
  const cbdcStatuses = useMemo(() => {
    const m = new Map<string, string>();
    (allCbdcsForMap ?? []).forEach((c: Cbdc) => {
      const codes = expandRegionalCode(c.countryCode);
      codes.forEach((cc) => { if (!m.has(cc)) m.set(cc, c.status); });
    });
    return m;
  }, [allCbdcsForMap]);

  // Choose which statuses to pass to the map based on color mode
  const mapStatuses = mapColorMode === 'cbdc' ? cbdcStatuses
    : mapColorMode === 'stablecoin' ? stablecoinStatuses
    : stablecoinStatuses; // regime/travelRule don't use stablecoinStatuses, but it's harmless

  // Quick regime counts for insight panel
  const regimeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    safeJurisdictions.forEach((j) => { counts[j.regime] = (counts[j.regime] ?? 0) + 1; });
    return counts;
  }, [safeJurisdictions]);

  const travelEnforced = useMemo(
    () => safeJurisdictions.filter((j) => j.travelRule === 'Enforced').length,
    [safeJurisdictions],
  );

  const stablecoinsLive = useMemo(
    () => safeJurisdictions.filter((j) => j.stablecoinStage === 3).length,
    [safeJurisdictions],
  );

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
    // Stablecoin stage labels → stage values (Stride)
    live: ['Live'],
    developing: ['Developing'],
    'no framework': ['No Framework'],
    'no data': ['No Data'],
    // CBDC status labels
    launched: ['Launched'],
    pilot: ['Pilot'],
    development: ['Development'],
    research: ['Research'],
  };

  // Derive stablecoin/CBDC status filters from activeMiniStats
  const stablecoinStatusFilters = useMemo(() => {
    if ((mapColorMode !== 'stablecoin' && mapColorMode !== 'cbdc') || activeMiniStats.length === 0) return [] as string[];
    return activeMiniStats.flatMap((l) => miniStatLabelToValues[l] ?? [l]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapColorMode, activeMiniStats]);

  const handleMiniStatClick = useCallback((label: string) => {
    setActiveMiniStats((prev) => {
      const isActive = prev.includes(label);
      const next = isActive ? prev.filter((l) => l !== label) : [...prev, label];

      // In stablecoin/cbdc mode, filter jurisdictions by matching country codes
      if (mapColorMode === 'stablecoin' || mapColorMode === 'cbdc') {
        if (next.length === 0) {
          colFilters.clearFilter('code');
        } else {
          const statusValues = next.flatMap((l) => miniStatLabelToValues[l] ?? [l]);
          const statusMap = mapColorMode === 'cbdc' ? cbdcStatuses : stablecoinStatuses;
          const matchingCodes: string[] = [];
          statusMap.forEach((status, code) => {
            if (statusValues.includes(status)) matchingCodes.push(code);
          });
          colFilters.applyFilter('code', matchingCodes);
        }
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
  }, [mapColorMode, colFilters.applyFilter, colFilters.clearFilter, stablecoinStatuses, cbdcStatuses]);

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
    <div ref={revealRef} className="st-map-section" style={{ paddingLeft: 16, paddingRight: 16 }}>
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
              // Reset mini-stat filter when switching mode
              if (activeMiniStats.length > 0) {
                // Clear column filters for previous mode
                if (mapColorMode === 'travelRule') colFilters.clearFilter('travelRule');
                else if (mapColorMode === 'regime') colFilters.clearFilter('regime');
                else colFilters.clearFilter('code'); // stablecoin/cbdc mode filters by code
                setActiveMiniStats([]);
              }
              setMapColorMode(v as MapColorMode);
            }}
          />
        </div>
      </div>

      {/* Collapsible insight panel */}
      <div className="st-insight-panel">
        <button
          className={`st-insight-toggle${insightOpen ? ' is-open' : ''}`}
          onClick={() => setInsightOpen((v) => !v)}
          aria-expanded={insightOpen}
        >
          <span className="st-insight-toggle-label">About this data</span>
          <ChevronDown size={16} className="st-insight-chevron" />
        </button>
        {insightOpen && (
          <div className="st-insight-body">
            <div className="st-insight-stats-row">
              <span><strong>{safeJurisdictions.length}</strong> jurisdictions tracked</span>
              <span className="st-insight-dot" />
              <span><strong>{regimeCounts['Licensing'] ?? 0}</strong> require licensing</span>
              <span className="st-insight-dot" />
              <span><strong>{regimeCounts['Registration'] ?? 0}</strong> use registration</span>
              <span className="st-insight-dot" />
              <span><strong>{regimeCounts['Ban'] ?? 0}</strong> have bans</span>
            </div>
            <p className="st-insight-text">
              RemiDe maps the regulatory landscape for crypto-asset service providers across {safeJurisdictions.length} jurisdictions worldwide.{' '}
              {travelEnforced > 0 && <><strong>{travelEnforced}</strong> countries enforce the FATF Travel Rule. </>}
              {stablecoinsLive > 0 && <><strong>{stablecoinsLive}</strong> have live stablecoin frameworks. </>}
              Use the tabs above to switch between Regulation, Travel Rule, Stablecoin, and CBDC views.
            </p>
            <p className="st-insight-disclaimer">
              Data is sourced from official regulators and public registries. Coverage is expanding continuously — some jurisdictions may have partial data.
            </p>
          </div>
        )}
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
