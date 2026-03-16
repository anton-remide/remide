import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getEntityStats, getStablecoins, getCbdcs, getJurisdictions, getStablecoinIssuers } from '../data/dataLoader';
import type { EntityStats } from '../data/dataLoader';
import type { Entity, Stablecoin, Cbdc, Jurisdiction, StablecoinIssuer, EntitySector } from '../types';
import { STATUS_COLORS, SECTOR_COLORS, STABLECOIN_TYPE_COLORS, CBDC_STATUS_COLORS } from '../theme';
import { useReveal } from '../hooks/useAnimations';
import { useTableState } from '../hooks/useFilters';
import { useColumnFilters } from '../hooks/useColumnFilters';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { useProgressiveEntities } from '../hooks/useProgressiveEntities';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { countryCodeToFlag } from '../utils/countryFlags';
import Badge from '../components/ui/Badge';
import DataTable, { type Column } from '../components/ui/DataTable';
import SegmentedControl from '../components/ui/SegmentedControl';

type EntityTab = 'vasps' | 'stablecoins' | 'cbdcs' | 'issuers';

/* ── Region Mapping ── */
type RegionKey = 'Europe' | 'UK' | 'North America' | 'Asia-Pacific' | 'MENA' | 'Africa' | 'LATAM' | 'Caribbean & Offshore';
const REGION_MAP: Record<RegionKey, string[]> = {
  'Europe': ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE','CH','NO','IS','LI','AD','MC','SM','UA','MD','RS','BA','ME','MK','AL','XK'],
  'UK': ['GB','GG','JE','IM','GI'],
  'North America': ['US','CA'],
  'Asia-Pacific': ['JP','SG','HK','KR','AU','NZ','TH','MY','ID','PH','TW','IN','CN','VN','KH','MM','LA','BD','LK','PK','NP','MN','FJ','PG','WS','TO','MO'],
  'MENA': ['AE','SA','BH','QA','KW','OM','IL','JO','LB','EG','MA','TN','DZ','IQ','IR','TR','PS','YE','LY','SY'],
  'Africa': ['ZA','NG','KE','GH','MU','SC','TZ','UG','RW','ET','CI','SN','CM','BW','NA','MZ','ZW','MG','MW','ZM'],
  'LATAM': ['BR','AR','MX','CL','CO','PE','EC','UY','PY','BO','VE','CR','GT','HN','NI','DO','SV','PA','CU','HT'],
  'Caribbean & Offshore': ['KY','VG','BS','BM','CW','BB','JM','TT','AG','LC','VC','GD','DM','KN','TC','AI','MS','BZ','SR','GY','AW','SX','BQ','MF','BL'],
};
const ALL_REGION_CODES = new Set(Object.values(REGION_MAP).flat());

function getRegion(countryCode: string): RegionKey | 'Other' {
  for (const [region, codes] of Object.entries(REGION_MAP) as [RegionKey, string[]][]) {
    if (codes.includes(countryCode)) return region;
  }
  return 'Other';
}

const REGION_ORDER: (RegionKey | 'Other')[] = ['Europe', 'UK', 'North America', 'Asia-Pacific', 'MENA', 'Africa', 'LATAM', 'Caribbean & Offshore', 'Other'];

/* ── Stat Chip Component ── */
function StatChip({ value, label, active, onClick, compact }: { value: number | null; label: string; active: boolean; onClick: () => void; compact?: boolean }) {
  return (
    <button
      className={`st-entity-stat-chip${active ? ' active' : ''}${compact ? ' compact' : ''}`}
      onClick={onClick}
      aria-label={`Filter by ${label} sector${value !== null ? `, ${value.toLocaleString()} entities` : ''}`}
      aria-pressed={active}
    >
      <span className="st-entity-stat-value">{value !== null ? value.toLocaleString() : '…'}</span>
      <span className="st-entity-stat-label">{label}</span>
    </button>
  );
}

/* ── VASPs Tab ── */
function VaspsTab({ searchQuery, tabSwitcher, stats }: { searchQuery?: string; tabSwitcher: React.ReactNode; stats: EntityStats | null }) {
  const navigate = useNavigate();
  const { data: allEntities, loading, progress, error, refetch } = useProgressiveEntities();
  // Filter out garbage entities — they have bad data (dates as names, codes, etc.)
  const safeEntities = useMemo(() => (allEntities ?? []).filter((e) => !e.isGarbage), [allEntities]);

  // Sector quick filter (from stat chips)
  const [sectorFilter, setSectorFilter] = useState<EntitySector | null>(null);
  // Region quick filter (second row of chips)
  const [regionFilter, setRegionFilter] = useState<RegionKey | 'Other' | null>(null);

  const sectorFiltered = useMemo(() => {
    if (!sectorFilter) return safeEntities;
    return safeEntities.filter((e) => e.sector === sectorFilter);
  }, [safeEntities, sectorFilter]);

  // Region counts computed from sector-filtered entities (cross-filter)
  const regionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const region of REGION_ORDER) counts[region] = 0;
    for (const e of sectorFiltered) {
      const r = getRegion(e.countryCode);
      counts[r] = (counts[r] || 0) + 1;
    }
    return counts;
  }, [sectorFiltered]);

  const regionFiltered = useMemo(() => {
    if (!regionFilter) return sectorFiltered;
    if (regionFilter === 'Other') {
      return sectorFiltered.filter((e) => !ALL_REGION_CODES.has(e.countryCode));
    }
    const codes = REGION_MAP[regionFilter];
    return sectorFiltered.filter((e) => codes.includes(e.countryCode));
  }, [sectorFiltered, regionFilter]);

  const colFilters = useColumnFilters<Entity & Record<string, unknown>>(
    regionFiltered as (Entity & Record<string, unknown>)[],
  );

  const filterFn = useCallback((e: Entity, q: string) => {
    const website = (e.website || '').toLowerCase();
    return (
      e.name.toLowerCase().includes(q) ||
      e.country.toLowerCase().includes(q) ||
      e.sector.toLowerCase().includes(q) ||
      website.includes(q)
    );
  }, []);

  const table = useTableState(colFilters.filtered as Entity[], filterFn, { field: 'name', direction: 'asc' });

  // Reset page when external filters change (J8-3 audit fix)
  useEffect(() => { table.setPage(1); }, [sectorFilter, regionFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync external search query
  useEffect(() => {
    if (searchQuery) table.setSearch(searchQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const columns: Column<Entity>[] = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (r) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 500 }}>{r.name}</span>
          {r.dnsStatus === 'dead' && <span title="Website is dead" style={{ fontSize: '0.75rem' }}>💀</span>}
        </span>
      ),
    },
    {
      key: 'sector',
      label: 'Sector',
      sortable: true,
      filterable: true,
      filterValues: colFilters.getUniqueValues('sector'),
      selectedFilters: colFilters.filters['sector'] ?? [],
      onFilterApply: colFilters.applyFilter,
      onFilterClear: colFilters.clearFilter,
      render: (r) => <Badge label={r.sector} colorMap={SECTOR_COLORS} />,
      renderFilterValue: (v) => <Badge label={v} colorMap={SECTOR_COLORS} />,
    },
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

  const handleSectorClick = useCallback((sector: EntitySector | null) => {
    setSectorFilter((prev) => prev === sector ? null : sector);
  }, []);

  const handleRegionClick = useCallback((region: RegionKey | 'Other' | null) => {
    setRegionFilter((prev) => prev === region ? null : region);
  }, []);

  // No data yet at all — show initial loading skeleton
  if (!allEntities) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <div className="st-loading-pulse" />
        <p style={{ color: 'var(--text-muted)', marginTop: 12, fontSize: '0.8125rem' }}>
          Loading entities...
        </p>
      </div>
    );
  }

  if (error && !allEntities) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <p style={{ color: 'var(--text-muted)' }}>{error}</p>
        <button className="st-btn st-btn-sm" onClick={refetch} style={{ marginTop: 12 }}>Retry</button>
      </div>
    );
  }

  const progressPct = progress.total > 0 ? Math.round((progress.loaded / progress.total) * 100) : 0;

  return (
    <>
      {/* Progressive loading indicator — shown while still fetching pages */}
      {loading && progress.total > 0 && (
        <div className="st-entity-progress">
          <div className="st-entity-progress-bar" style={{ width: `${progressPct}%` }} />
          <span className="st-entity-progress-text">
            Loading {progress.loaded.toLocaleString()} of ~{progress.total.toLocaleString()} entities...
          </span>
        </div>
      )}

      {/* Sector chips */}
      <div className="st-entity-stats-bar">
        <StatChip value={stats?.total ?? null} label="All Entities" active={sectorFilter === null} onClick={() => handleSectorClick(null)} />
        <StatChip value={stats?.crypto ?? null} label="Crypto" active={sectorFilter === 'Crypto'} onClick={() => handleSectorClick('Crypto')} />
        {(stats?.payments ?? 0) > 0 && (
          <StatChip value={stats?.payments ?? null} label="Payments" active={sectorFilter === 'Payments'} onClick={() => handleSectorClick('Payments')} />
        )}
        <StatChip value={stats?.banking ?? null} label="Banking" active={sectorFilter === 'Banking'} onClick={() => handleSectorClick('Banking')} />
      </div>

      {/* Region chips */}
      <div className="st-entity-stats-bar st-region-bar">
        <StatChip compact value={sectorFiltered.length} label="All Regions" active={regionFilter === null} onClick={() => handleRegionClick(null)} />
        {REGION_ORDER.map((r) => (
          <StatChip key={r} compact value={regionCounts[r] || 0} label={r} active={regionFilter === r} onClick={() => handleRegionClick(r)} />
        ))}
      </div>

      {/* Insight panel */}
      <div className="st-insight-panel" style={{ marginBottom: 16, marginTop: 0 }}>
        <div className="st-insight-disclaimer" style={{ padding: '8px 16px', background: 'var(--color-neutral-subtle)', borderRadius: 8, border: '1px solid var(--color-border)' }}>
          Aggregated from {stats ? '80+' : '…'} official registries. We are continuously connecting additional data sources — entity counts grow with each update.
        </div>
      </div>

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
        totalCount={regionFiltered.length}
        pageSize={table.pageSize}
        onPageSizeChange={table.setPageSize}
        search={table.search}
        onSearchChange={table.setSearch}
        searchPlaceholder="Search entities..."
        toolbarPrefix={tabSwitcher}
      />
    </>
  );
}

/* ── Stablecoins Tab ── */
function StablecoinsTab({ codeToName, tabSwitcher }: { codeToName: Map<string, string>; tabSwitcher: React.ReactNode }) {
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
      render: (r) => {
        const code = r.issuerCountry?.toUpperCase();
        const name = codeToName.get(code) ?? r.issuerCountry;
        return code ? <><span style={{ marginRight: 6 }}>{countryCodeToFlag(code)}</span>{name}</> : <>—</>;
      },
      renderFilterValue: (v) => {
        const name = codeToName.get(v.toUpperCase()) ?? v;
        return <><span style={{ marginRight: 4 }}>{countryCodeToFlag(v)}</span>{name}</>;
      },
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
      toolbarPrefix={tabSwitcher}
    />
  );
}

/* ── CBDCs Tab ── */
function CbdcsTab({ tabSwitcher }: { tabSwitcher: React.ReactNode }) {
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
        <span style={{ color: r.crossBorder ? 'var(--color-success)' : 'var(--text-muted)' }}>
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
      toolbarPrefix={tabSwitcher}
    />
  );
}

/* ── Issuers Tab ── */
function IssuersTab({ tabSwitcher }: { tabSwitcher: React.ReactNode }) {
  const navigate = useNavigate();
  const { data: allIssuers, loading, error, refetch } = useSupabaseQuery(getStablecoinIssuers);
  const safeData = allIssuers ?? [];

  const colFilters = useColumnFilters<StablecoinIssuer & Record<string, unknown>>(
    safeData as (StablecoinIssuer & Record<string, unknown>)[],
  );

  const filterFn = useCallback((i: StablecoinIssuer, q: string) => {
    return (
      i.name.toLowerCase().includes(q) ||
      i.country.toLowerCase().includes(q) ||
      i.auditor.toLowerCase().includes(q)
    );
  }, []);

  const table = useTableState(
    colFilters.filtered as StablecoinIssuer[],
    filterFn,
    { field: 'name', direction: 'asc' },
  );

  const columns: Column<StablecoinIssuer>[] = [
    { key: 'name', label: 'Name', sortable: true, render: (r) => <span style={{ fontWeight: 600 }}>{r.name}</span> },
    {
      key: 'country',
      label: 'Country',
      sortable: true,
      filterable: true,
      filterValues: colFilters.getUniqueValues('country'),
      selectedFilters: colFilters.filters['country'] ?? [],
      onFilterApply: colFilters.applyFilter,
      onFilterClear: colFilters.clearFilter,
      render: (r) => r.countryCode ? <><span style={{ marginRight: 6 }}>{countryCodeToFlag(r.countryCode)}</span>{r.country || r.countryCode}</> : <>—</>,
      renderFilterValue: (v) => <>{v}</>,
    },
    { key: 'auditor', label: 'Auditor', sortable: true },
    {
      key: 'lei',
      label: 'LEI',
      sortable: true,
      render: (r) => r.lei ? <span style={{ fontFamily: 'var(--font2)', fontSize: '0.8125rem' }}>{r.lei}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>,
    },
    {
      key: 'isVerified',
      label: 'Verified',
      sortable: true,
      render: (r) => (
        <span style={{ color: r.isVerified ? 'var(--color-success)' : 'var(--text-muted)' }}>
          {r.isVerified ? '✓ Yes' : '—'}
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
    <DataTable
      columns={columns}
      data={table.paginated as (StablecoinIssuer & Record<string, unknown>)[]}
      sort={table.sort}
      onSort={table.toggleSort}
      onRowClick={(row) => {
        const issuer = row as unknown as StablecoinIssuer;
        if (issuer.slug) navigate(`/issuers/${issuer.slug}`);
      }}
      page={table.page}
      totalPages={table.totalPages}
      onPageChange={table.setPage}
      totalFiltered={table.totalFiltered}
      totalCount={safeData.length}
      pageSize={table.pageSize}
      onPageSizeChange={table.setPageSize}
      search={table.search}
      onSearchChange={table.setSearch}
      searchPlaceholder="Search issuers..."
      toolbarPrefix={tabSwitcher}
    />
  );
}

/* ── Main Page ── */
export default function EntitiesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as EntityTab | null;
  const qParam = searchParams.get('q');
  const [activeTab, setActiveTab] = useState<EntityTab>(tabParam ?? 'vasps');
  const revealRef = useReveal(false);

  // Sync tab to URL
  const handleTabChange = useCallback((v: string) => {
    const tab = v as EntityTab;
    setActiveTab(tab);
    setSearchParams(tab === 'vasps' ? {} : { tab }, { replace: true });
  }, [setSearchParams]);

  // Load entity stats for stat chips (fast COUNT queries)
  const { data: entityStats } = useSupabaseQuery(getEntityStats);

  // Load jurisdictions for code→name map (used by stablecoins country column)
  const { data: allJurisdictions } = useSupabaseQuery(getJurisdictions);
  const codeToName = useMemo(() => {
    const m = new Map<string, string>();
    (allJurisdictions ?? []).forEach((j: Jurisdiction) => m.set(j.code.toUpperCase(), j.name));
    return m;
  }, [allJurisdictions]);

  // SEO meta
  const titles: Record<EntityTab, string> = {
    vasps: 'Regulated Entities — VASPs, EMIs, Payment Institutions & Banks',
    stablecoins: 'Stablecoins — Digital Currency Tracker',
    cbdcs: 'CBDCs — Central Bank Digital Currencies',
    issuers: 'Stablecoin Issuers — Company Profiles',
  };
  const descriptions: Record<EntityTab, string> = {
    vasps: 'Browse 14,000+ licensed entities across crypto, payments and banking sectors in 82+ countries.',
    stablecoins: 'Track 15+ major stablecoins. Compare regulatory status, market caps, and issuers.',
    cbdcs: 'Track 24+ central bank digital currencies (CBDCs). Compare status, type, and central banks.',
    issuers: 'Browse 44+ stablecoin issuers worldwide. Compare auditors, LEI codes, and regulatory licenses.',
  };

  useDocumentMeta({
    title: titles[activeTab],
    description: descriptions[activeTab],
    path: activeTab === 'vasps' ? '/entities' : `/entities?tab=${activeTab}`,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Dataset',
      name: titles[activeTab],
      description: descriptions[activeTab],
      url: `https://anton-remide.github.io/remide/entities${activeTab !== 'vasps' ? `?tab=${activeTab}` : ''}`,
      creator: { '@type': 'Organization', name: 'RemiDe' },
      keywords: ['cryptocurrency', 'VASP', 'stablecoin', 'CBDC', 'regulation', 'licensing'],
    },
  });

  // Consume ?q= param once for VASPs
  const [initialSearch] = useState(qParam ?? undefined);
  useEffect(() => {
    if (qParam) setSearchParams(activeTab === 'vasps' ? {} : { tab: activeTab }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tab switcher — rendered inside each tab's DataTable toolbar
  const tabSwitcher = (
    <SegmentedControl
      options={[
        { value: 'vasps', label: 'Entities' },
        { value: 'stablecoins', label: 'Stablecoins' },
        { value: 'cbdcs', label: 'CBDCs' },
        { value: 'issuers', label: 'Issuers' },
      ]}
      value={activeTab}
      onChange={handleTabChange}
    />
  );

  return (
    <div ref={revealRef} className="st-page st-page-entities">
      <h2 className="st-entities-page-title">Browse 10K+ Entities</h2>
      {activeTab === 'vasps' && <VaspsTab searchQuery={initialSearch} tabSwitcher={tabSwitcher} stats={entityStats ?? null} />}
      {activeTab === 'stablecoins' && <StablecoinsTab codeToName={codeToName} tabSwitcher={tabSwitcher} />}
      {activeTab === 'cbdcs' && <CbdcsTab tabSwitcher={tabSwitcher} />}
      {activeTab === 'issuers' && <IssuersTab tabSwitcher={tabSwitcher} />}
    </div>
  );
}
