import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getJurisdictions } from '../data/dataLoader';
import type { Jurisdiction, RegimeType, TravelRuleStatus } from '../types';
import { REGIME_COLORS, REGIME_CHIP_COLORS, TRAVEL_RULE_COLORS } from '../theme';
import { useReveal } from '../hooks/useAnimations';
import { useTableState } from '../hooks/useFilters';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import SearchInput from '../components/ui/SearchInput';
import FilterChips from '../components/ui/FilterChips';
import Badge from '../components/ui/Badge';
import DataTable, { type Column } from '../components/ui/DataTable';
import WorldMap from '../components/map/WorldMap';

const REGIME_OPTIONS: RegimeType[] = ['Licensing', 'Registration', 'Sandbox', 'Ban', 'None', 'Unclear'];
const TRAVEL_RULE_OPTIONS: TravelRuleStatus[] = ['Enforced', 'Legislated', 'In Progress', 'Not Implemented'];

export default function JurisdictionsPage() {
  const navigate = useNavigate();
  const { data: allJurisdictions, loading, error, refetch } = useSupabaseQuery(getJurisdictions);
  const revealRef = useReveal(loading);

  const [regimes, setRegimes] = useState<RegimeType[]>([]);
  const [travelRules, setTravelRules] = useState<TravelRuleStatus[]>([]);

  const safeJurisdictions = allJurisdictions ?? [];

  const preFiltered = useMemo(() => {
    let data = safeJurisdictions;
    if (regimes.length) data = data.filter((j) => regimes.includes(j.regime));
    if (travelRules.length) data = data.filter((j) => travelRules.includes(j.travelRule));
    return data;
  }, [safeJurisdictions, regimes, travelRules]);

  const filterFn = useCallback((j: Jurisdiction, q: string) => {
    return j.name.toLowerCase().includes(q) || j.regulator.toLowerCase().includes(q);
  }, []);

  const table = useTableState(preFiltered, filterFn, { field: 'entityCount', direction: 'desc' });

  const toggleRegime = (r: RegimeType) => {
    setRegimes((prev) => prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]);
  };
  const toggleTravelRule = (t: TravelRuleStatus) => {
    setTravelRules((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
  };

  const columns: Column<Jurisdiction>[] = [
    { key: 'name', label: 'Country', sortable: true },
    { key: 'regime', label: 'Regime', sortable: true, render: (r) => <Badge label={r.regime} colorMap={REGIME_CHIP_COLORS} /> },
    { key: 'travelRule', label: 'Travel Rule', sortable: true, render: (r) => <Badge label={r.travelRule} colorMap={TRAVEL_RULE_COLORS} /> },
    { key: 'entityCount', label: 'Entities', sortable: true, width: '100px' },
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
        <h4 style={{ marginBottom: 12 }}>Failed to load jurisdictions</h4>
        <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: '0.875rem' }}>{error}</p>
        <button className="st-btn" onClick={refetch}>Try Again</button>
      </div>
    );
  }

  return (
    <div ref={revealRef}>
      {/* Map with padding for fixed header */}
      <div style={{ paddingTop: 64 }}>
        <WorldMap
          jurisdictions={safeJurisdictions}
          selectedRegimes={regimes}
          selectedTravelRules={travelRules}
          onCountryClick={(code) => navigate(`/jurisdictions/${code}`)}
        />
      </div>

      {/* Filters + Table */}
      <div className="st-page" style={{ paddingTop: 32, paddingBottom: 48 }}>
        <div className="reveal" style={{ marginBottom: 24 }}>
          <SearchInput
            value={table.search}
            onChange={table.setSearch}
            placeholder="Search countries or regulators..."
          />
        </div>

        <div className="reveal" style={{ marginBottom: 16 }}>
          <div className="st-label" style={{ marginBottom: 8 }}>Regime</div>
          <FilterChips options={REGIME_OPTIONS} selected={regimes} onToggle={toggleRegime} colorMap={REGIME_COLORS} />
        </div>

        <div className="reveal" style={{ marginBottom: 24 }}>
          <div className="st-label" style={{ marginBottom: 8 }}>Travel Rule</div>
          <FilterChips options={TRAVEL_RULE_OPTIONS} selected={travelRules} onToggle={toggleTravelRule} />
        </div>

        <div className="reveal">
          <div className="clip-lg">
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
            />
          </div>
        </div>
      </div>
    </div>
  );
}
