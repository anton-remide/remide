import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStablecoins, getCbdcs, getJurisdictions } from '../data/dataLoader';
import { expandRegionalCode } from '../data/regionCodes';
import type { Stablecoin, Cbdc, Jurisdiction } from '../types';
import {
  STABLECOIN_TYPE_COLORS,
  CBDC_STATUS_COLORS,
} from '../theme';
import { useReveal } from '../hooks/useAnimations';
import { useTableState } from '../hooks/useFilters';
import { useColumnFilters } from '../hooks/useColumnFilters';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { countryCodeToFlag } from '../utils/countryFlags';
import Badge from '../components/ui/Badge';
import DataTable, { type Column } from '../components/ui/DataTable';
import SegmentedControl from '../components/ui/SegmentedControl';
import WorldMap, { type MapColorMode } from '../components/map/WorldMap';

type TabMode = 'stablecoins' | 'cbdcs';

/* ── Stablecoins Table ── */
function StablecoinsTab() {
  const navigate = useNavigate();
  const { data: allStablecoins, loading, error, refetch } = useSupabaseQuery(getStablecoins);
  const safeData = allStablecoins ?? [];

  const colFilters = useColumnFilters<Stablecoin & Record<string, unknown>>(
    safeData as (Stablecoin & Record<string, unknown>)[],
  );

  const filterFn = useCallback((s: Stablecoin, q: string) => {
    return (
      s.name.toLowerCase().includes(q) ||
      s.ticker.toLowerCase().includes(q) ||
      s.issuer.toLowerCase().includes(q)
    );
  }, []);

  const table = useTableState(
    colFilters.filtered as Stablecoin[],
    filterFn,
    { field: 'marketCapBn', direction: 'desc' },
  );

  const columns: Column<Stablecoin>[] = [
    {
      key: 'ticker',
      label: 'Ticker',
      sortable: true,
      render: (r) => (
        <span style={{ fontWeight: 600, fontFamily: 'var(--font2)' }}>{r.ticker}</span>
      ),
    },
    { key: 'name', label: 'Name', sortable: true },
    {
      key: 'type',
      label: 'Type',
      sortable: true,
      filterable: true,
      filterValues: colFilters.getUniqueValues('type'),
      selectedFilters: colFilters.filters['type'] ?? [],
      onFilterApply: colFilters.applyFilter,
      onFilterClear: colFilters.clearFilter,
      render: (r) => <Badge label={r.type} colorMap={STABLECOIN_TYPE_COLORS} />,
      renderFilterValue: (v) => <Badge label={v} colorMap={STABLECOIN_TYPE_COLORS} />,
    },
    {
      key: 'pegCurrency',
      label: 'Peg',
      sortable: true,
      filterable: true,
      filterValues: colFilters.getUniqueValues('pegCurrency'),
      selectedFilters: colFilters.filters['pegCurrency'] ?? [],
      onFilterApply: colFilters.applyFilter,
      onFilterClear: colFilters.clearFilter,
    },
    {
      key: 'marketCapBn',
      label: 'Market Cap',
      sortable: true,
      render: (r) => (
        <span style={{ fontFamily: 'var(--font2)', fontWeight: 500 }}>
          ${r.marketCapBn >= 1 ? `${r.marketCapBn.toFixed(1)}B` : `${(r.marketCapBn * 1000).toFixed(0)}M`}
        </span>
      ),
    },
    {
      key: 'issuer',
      label: 'Issuer',
      sortable: true,
    },
    {
      key: 'issuerCountry',
      label: 'Country',
      sortable: true,
      filterable: true,
      filterValues: colFilters.getUniqueValues('issuerCountry'),
      selectedFilters: colFilters.filters['issuerCountry'] ?? [],
      onFilterApply: colFilters.applyFilter,
      onFilterClear: colFilters.clearFilter,
      render: (r) => r.issuerCountry || '—',
    },
    {
      key: 'regulatoryStatus',
      label: 'Reg. Status',
      sortable: true,
      render: (r) => (
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          {r.regulatoryStatus}
        </span>
      ),
    },
  ];

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 40 }}><div className="st-loading-pulse" /></div>;
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <p style={{ color: 'var(--text-muted)' }}>{error}</p>
        <button className="st-btn st-btn-sm" onClick={refetch} style={{ marginTop: 12 }}>Retry</button>
      </div>
    );
  }

  return (
    <>
      <DataTable
        columns={columns}
        data={table.paginated as (Stablecoin & Record<string, unknown>)[]}
        sort={table.sort}
        onSort={table.toggleSort}
        onRowClick={(row) => navigate(`/stablecoins/${(row as unknown as Stablecoin).id}`)}
        page={table.page}
        totalPages={table.totalPages}
        onPageChange={table.setPage}
        totalFiltered={table.totalFiltered}
        totalCount={safeData.length}
        pageSize={table.pageSize}
        onPageSizeChange={table.setPageSize}
        search={table.search}
        onSearchChange={table.setSearch}
        searchPlaceholder="Search stablecoins..."
      />
    </>
  );
}

/* ── CBDCs Table ── */
function CbdcsTab() {
  const navigate = useNavigate();
  const { data: allCbdcs, loading, error, refetch } = useSupabaseQuery(getCbdcs);
  const safeData = allCbdcs ?? [];

  const colFilters = useColumnFilters<Cbdc & Record<string, unknown>>(
    safeData as (Cbdc & Record<string, unknown>)[],
  );

  const filterFn = useCallback((c: Cbdc, q: string) => {
    return (
      c.name.toLowerCase().includes(q) ||
      c.country.toLowerCase().includes(q) ||
      c.centralBank.toLowerCase().includes(q)
    );
  }, []);

  const table = useTableState(
    colFilters.filtered as Cbdc[],
    filterFn,
    { field: 'status', direction: 'asc' },
  );

  const columns: Column<Cbdc>[] = [
    {
      key: 'country',
      label: 'Country',
      sortable: true,
      render: (r) => (
        <>
          <span style={{ marginRight: 6 }}>{countryCodeToFlag(r.countryCode)}</span>
          {r.country}
        </>
      ),
    },
    { key: 'name', label: 'CBDC Name', sortable: true },
    { key: 'currency', label: 'Currency', sortable: true },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      filterable: true,
      filterValues: colFilters.getUniqueValues('status'),
      selectedFilters: colFilters.filters['status'] ?? [],
      onFilterApply: colFilters.applyFilter,
      onFilterClear: colFilters.clearFilter,
      render: (r) => <Badge label={r.status} colorMap={CBDC_STATUS_COLORS} />,
      renderFilterValue: (v) => <Badge label={v} colorMap={CBDC_STATUS_COLORS} />,
    },
    {
      key: 'retailOrWholesale',
      label: 'Type',
      sortable: true,
      filterable: true,
      filterValues: colFilters.getUniqueValues('retailOrWholesale'),
      selectedFilters: colFilters.filters['retailOrWholesale'] ?? [],
      onFilterApply: colFilters.applyFilter,
      onFilterClear: colFilters.clearFilter,
    },
    {
      key: 'centralBank',
      label: 'Central Bank',
      sortable: true,
    },
    {
      key: 'crossBorder',
      label: 'Cross-Border',
      sortable: true,
      render: (r) => (
        <span style={{ color: r.crossBorder ? '#2B7A4B' : 'var(--text-muted)' }}>
          {r.crossBorder ? '✓ Yes' : '—'}
        </span>
      ),
    },
  ];

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 40 }}><div className="st-loading-pulse" /></div>;
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <p style={{ color: 'var(--text-muted)' }}>{error}</p>
        <button className="st-btn st-btn-sm" onClick={refetch} style={{ marginTop: 12 }}>Retry</button>
      </div>
    );
  }

  return (
    <>
      <DataTable
        columns={columns}
        data={table.paginated as (Cbdc & Record<string, unknown>)[]}
        sort={table.sort}
        onSort={table.toggleSort}
        onRowClick={(row) => navigate(`/cbdcs/${(row as unknown as Cbdc).id}`)}
        page={table.page}
        totalPages={table.totalPages}
        onPageChange={table.setPage}
        totalFiltered={table.totalFiltered}
        totalCount={safeData.length}
        pageSize={table.pageSize}
        onPageSizeChange={table.setPageSize}
        search={table.search}
        onSearchChange={table.setSearch}
        searchPlaceholder="Search CBDCs..."
      />
    </>
  );
}

/* ── Main Page ── */
export default function StablecoinsPage() {
  useDocumentMeta({
    title: 'Stablecoins & CBDCs — Digital Currency Tracker',
    description: 'Track 15 major stablecoins and 24 central bank digital currencies (CBDCs). Compare regulatory status, market caps, and jurisdiction coverage.',
    path: '/stablecoins',
  });

  const navigate = useNavigate();
  const [tab, setTab] = useState<TabMode>('stablecoins');
  const [activeMiniStats, setActiveMiniStats] = useState<string[]>([]);
  const revealRef = useReveal(false);

  // Load jurisdictions + CBDCs for the map
  const { data: allJurisdictions } = useSupabaseQuery(getJurisdictions);
  const { data: allCbdcsForMap } = useSupabaseQuery(getCbdcs);
  const safeJurisdictions = allJurisdictions ?? [];

  // Stablecoin regulatory stage per country (from Stride data on jurisdictions)
  // Stage: 0=No Framework, 1=Developing, 2=In Progress, 3=Live
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

  // CBDC statuses per country (expand "EU" → 27 member states for Digital Euro)
  const cbdcStatuses = useMemo(() => {
    const m = new Map<string, string>();
    (allCbdcsForMap ?? []).forEach((c: Cbdc) => {
      const codes = expandRegionalCode(c.countryCode);
      codes.forEach((code) => {
        // Don't overwrite a country's own CBDC status with EU-level status
        if (!m.has(code)) m.set(code, c.status);
      });
    });
    return m;
  }, [allCbdcsForMap]);

  // Choose which map data to show based on tab
  const mapStatuses = tab === 'stablecoins' ? stablecoinStatuses : cbdcStatuses;
  const mapMode: MapColorMode = tab === 'stablecoins' ? 'stablecoin' : 'cbdc';

  // Mini-stat label (lowercase) → stablecoinStatus value mapping for map filtering
  const miniStatLabelToValues: Record<string, string[]> = {
    live: ['Live'],
    'in progress': ['In Progress'],
    developing: ['Developing'],
    'no framework': ['No Framework'],
    // CBDC labels
    launched: ['Launched'],
    pilot: ['Pilot'],
    development: ['Development'],
    research: ['Research'],
  };

  // Derive stablecoin/CBDC status filters from activeMiniStats
  const selectedStablecoinStatuses = useMemo(() => {
    if (activeMiniStats.length === 0) return [] as string[];
    return activeMiniStats.flatMap((l) => miniStatLabelToValues[l] ?? [l]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMiniStats]);

  const handleMiniStatClick = useCallback((label: string) => {
    setActiveMiniStats((prev) => {
      return prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label];
    });
  }, []);

  return (
    <div ref={revealRef} className="st-page">
      <div className="reveal" style={{ marginBottom: 24 }}>
        <h2 style={{ marginBottom: 4 }}>Stablecoins & CBDCs</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Track stablecoin regulatory status and central bank digital currency projects worldwide
        </p>
      </div>

      {/* Map */}
      <div className="reveal st-map-frame" style={{ marginBottom: 24 }}>
        <WorldMap
          jurisdictions={safeJurisdictions}
          colorMode={mapMode}
          stablecoinStatuses={mapStatuses}
          selectedStablecoinStatuses={selectedStablecoinStatuses}
          onCountryClick={(code) => navigate(`/jurisdictions/${code}`)}
          onMiniStatClick={handleMiniStatClick}
          activeMiniStats={activeMiniStats}
        />
        {/* Toggles overlay — top-left */}
        <div className="st-map-toggles-overlay">
          <SegmentedControl
            options={[
              { value: 'stablecoins', label: 'Stablecoins' },
              { value: 'cbdcs', label: 'CBDCs' },
            ]}
            value={tab}
            onChange={(v) => {
              setTab(v as TabMode);
              setActiveMiniStats([]);
            }}
          />
        </div>
      </div>

      {tab === 'stablecoins' ? <StablecoinsTab /> : <CbdcsTab />}
    </div>
  );
}
