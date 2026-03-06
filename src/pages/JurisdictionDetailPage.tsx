import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState, useCallback, useMemo } from 'react';
import {
  getJurisdictionByCode, getEntitiesByCountry, getStablecoinsByCountry,
  getCbdcsByCountry, getStablecoinLawsByCountry, getStablecoinEventsByCountry,
  getLicensesByCountry, getJurisdictions, getCbdcs,
  getEntitiesByRegion, getJurisdictionsByRegion,
} from '../data/dataLoader';
import { expandRegionalCode } from '../data/regionCodes';
import type { Entity, Jurisdiction, Cbdc, StablecoinLaw, StablecoinEvent, IssuerLicense } from '../types';
import { REGIME_CHIP_COLORS, TRAVEL_RULE_COLORS, STATUS_COLORS, STABLECOIN_STAGE_COLORS, CBDC_STATUS_COLORS } from '../theme';
import { useReveal } from '../hooks/useAnimations';
import { useTableState } from '../hooks/useFilters';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { countryCodeToFlag } from '../utils/countryFlags';
import Breadcrumb from '../components/ui/Breadcrumb';
import Badge from '../components/ui/Badge';
import DataTable, { type Column } from '../components/ui/DataTable';
import SegmentedControl from '../components/ui/SegmentedControl';
import WorldMap, { type MapColorMode } from '../components/map/WorldMap';

/* ── Helpers ── */

const STAGE_LABELS: Record<number, string> = {
  3: 'Live', 2: 'In Progress', 1: 'Developing', 0: 'No Framework',
};

const BACKING_LABELS: Record<number, string> = {
  1: 'Permitted', 0: 'Prohibited', 2: 'Unclear',
};

const BACKING_COLORS: Record<number, { color: string; bg: string }> = {
  1: { color: '#2B7A4B', bg: '#ECFDF3' },  // Permitted — green
  0: { color: '#A93F3F', bg: '#FFF0F0' },  // Prohibited — red
  2: { color: '#586B82', bg: '#F1F5F9' },  // Unclear — gray
};

function BackingBadge({ value, alert }: { value: number | null; alert?: string }) {
  if (value === null) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
  const c = BACKING_COLORS[value] ?? { color: '#586B82', bg: '#F1F5F9' };
  return (
    <span>
      <span style={{
        display: 'inline-block', padding: '2px 10px', borderRadius: 6,
        fontSize: '0.8125rem', fontWeight: 500, backgroundColor: c.bg, color: c.color,
      }}>
        {BACKING_LABELS[value] ?? 'Unknown'}
      </span>
      {alert && <span style={{ marginLeft: 6, fontSize: '0.75rem', color: 'var(--text-muted)' }}>{alert}</span>}
    </span>
  );
}

export default function JurisdictionDetailPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const isEU = (code ?? '').toUpperCase() === 'EU';

  const jurisdictionFetcher = useCallback(() => getJurisdictionByCode(code ?? ''), [code]);
  // EU → aggregate entities from all 27 member states; regular → single country
  const entitiesFetcher = useCallback(
    () => isEU ? getEntitiesByRegion(code ?? '') : getEntitiesByCountry(code ?? ''),
    [code, isEU],
  );

  const { data: jurisdiction, loading: jLoading, error: jError } = useSupabaseQuery(jurisdictionFetcher, [code]);
  const { data: entities, loading: eLoading, error: eError } = useSupabaseQuery(entitiesFetcher, [code]);

  // EU-specific: fetch member state jurisdictions
  const memberStatesFetcher = useCallback(
    () => isEU ? getJurisdictionsByRegion('EU') : Promise.resolve([]),
    [isEU],
  );
  const { data: memberStatesData } = useSupabaseQuery(memberStatesFetcher, [isEU]);
  const memberStates = useMemo(() => memberStatesData ?? [], [memberStatesData]);

  const loading = jLoading || eLoading;
  const revealRef = useReveal(loading);

  useDocumentMeta({
    title: jurisdiction ? `${jurisdiction.name} — Crypto Regulation` : 'Jurisdiction',
    description: jurisdiction
      ? `Cryptocurrency regulation in ${jurisdiction.name}: ${jurisdiction.regime} regime, ${(entities ?? []).length} licensed VASPs. Travel Rule: ${jurisdiction.travelRule}.`
      : 'Loading jurisdiction details...',
    path: code ? `/jurisdictions/${code}` : undefined,
    jsonLd: jurisdiction ? {
      '@context': 'https://schema.org',
      '@type': 'Article',
      name: `${jurisdiction.name} — Crypto Regulation`,
      description: `Cryptocurrency regulation in ${jurisdiction.name}: ${jurisdiction.regime} regime, ${(entities ?? []).length} licensed VASPs.`,
      url: `https://anton-remide.github.io/remide/jurisdictions/${code}`,
      publisher: { '@type': 'Organization', name: 'RemiDe' },
      about: { '@type': 'Country', name: jurisdiction.name },
    } : undefined,
  });

  const safeEntities = useMemo(() => (entities ?? []).filter((e) => !e.isGarbage), [entities]);

  // Stablecoins & CBDCs per country (async Supabase)
  const stablecoinsFetcher = useCallback(
    () => code ? getStablecoinsByCountry(code) : Promise.resolve([]),
    [code],
  );
  const cbdcsFetcher = useCallback(
    () => code ? getCbdcsByCountry(code) : Promise.resolve([]),
    [code],
  );
  const { data: countryStablecoinsData } = useSupabaseQuery(stablecoinsFetcher, [code]);
  const { data: countryCbdcsData } = useSupabaseQuery(cbdcsFetcher, [code]);
  const countryStablecoins = useMemo(() => countryStablecoinsData ?? [], [countryStablecoinsData]);
  const countryCbdcs = useMemo(() => countryCbdcsData ?? [], [countryCbdcsData]);

  // Stride: stablecoin laws, events, issuer licenses per country
  const lawsFetcher = useCallback(
    () => code ? getStablecoinLawsByCountry(code) : Promise.resolve([]),
    [code],
  );
  const eventsFetcher = useCallback(
    () => code ? getStablecoinEventsByCountry(code) : Promise.resolve([]),
    [code],
  );
  const licensesFetcher = useCallback(
    () => code ? getLicensesByCountry(code) : Promise.resolve([]),
    [code],
  );
  const { data: lawsData } = useSupabaseQuery(lawsFetcher, [code]);
  const { data: eventsData } = useSupabaseQuery(eventsFetcher, [code]);
  const { data: licensesData } = useSupabaseQuery(licensesFetcher, [code]);
  const countryLaws = useMemo(() => lawsData ?? [], [lawsData]);
  const countryEvents = useMemo(() => eventsData ?? [], [eventsData]);
  const countryLicenses = useMemo(() => licensesData ?? [], [licensesData]);

  // Mini-map: all jurisdictions + CBDCs for full map coloring
  const { data: allJurisdictions } = useSupabaseQuery(getJurisdictions);
  const { data: allCbdcsForMap } = useSupabaseQuery(getCbdcs);
  const safeAllJurisdictions = allJurisdictions ?? [];

  const [mapColorMode, setMapColorMode] = useState<MapColorMode>('regime');

  // Stablecoin regulatory stage per country
  const STAGE_MAP_LABELS: Record<number, string> = {
    3: 'Live', 2: 'In Progress', 1: 'Developing', 0: 'No Framework',
  };
  const stablecoinStatuses = useMemo(() => {
    const m = new Map<string, string>();
    safeAllJurisdictions.forEach((j: Jurisdiction) => {
      if (j.stablecoinStage !== null && j.stablecoinStage !== undefined) {
        m.set(j.code.toUpperCase(), STAGE_MAP_LABELS[j.stablecoinStage] ?? 'No Data');
      }
    });
    return m;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeAllJurisdictions]);

  // CBDC statuses per country
  const cbdcStatuses = useMemo(() => {
    const m = new Map<string, string>();
    (allCbdcsForMap ?? []).forEach((c: Cbdc) => {
      const codes = expandRegionalCode(c.countryCode);
      codes.forEach((cc) => { if (!m.has(cc)) m.set(cc, c.status); });
    });
    return m;
  }, [allCbdcsForMap]);

  // Choose which map statuses to show
  const mapStatuses = mapColorMode === 'stablecoin' ? stablecoinStatuses
    : mapColorMode === 'cbdc' ? cbdcStatuses
    : undefined;

  // For regime/travelRule modes, pass all jurisdictions; for stablecoin/cbdc, also need all
  const jurisdictionList = safeAllJurisdictions.length > 0 ? safeAllJurisdictions : (jurisdiction ? [jurisdiction] : []);

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
    ...(isEU ? [{
      key: 'country' as keyof Entity,
      label: 'Country',
      sortable: true,
      render: (r: Entity) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '1rem' }}>{countryCodeToFlag(r.countryCode)}</span>
          {r.country}
        </span>
      ),
    }] : []),
    { key: 'status', label: 'Status', sortable: true, render: (r) => <Badge label={r.status} colorMap={STATUS_COLORS} /> },
    { key: 'licenseType', label: 'License Type', sortable: true },
    { key: 'activities', label: 'Activities', render: (r) => r.activities.slice(0, 3).join(', ') || '—' },
  ];

  return (
    <article ref={revealRef} className="st-page">
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
      <div className="reveal st-detail-hero">
        <div className="st-detail-hero-info">
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
            {isEU && memberStates.length > 0 && (
              <div className="st-info-row">
                <span className="st-info-label">Member States</span>
                <span className="st-info-value">{memberStates.length} countries</span>
              </div>
            )}
            <div className="st-info-row">
              <span className="st-info-label">Licensed Entities</span>
              <span className="st-info-value">
                {isEU ? safeEntities.length : jurisdiction.entityCount}
              </span>
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
        <div className="st-detail-hero-map" style={{ position: 'relative' }}>
          <WorldMap
            height="100%"
            jurisdictions={jurisdictionList}
            compact
            focusCountry={code?.toUpperCase()}
            colorMode={mapColorMode}
            stablecoinStatuses={mapStatuses}
            onCountryClick={(c) => c !== code?.toUpperCase() && navigate(`/jurisdictions/${c}`)}
          />
          <div className="st-map-toggles-overlay" style={{ top: 8, left: 8 }}>
            <SegmentedControl
              options={[
                { value: 'regime', label: 'Regulation' },
                { value: 'travelRule', label: 'Travel Rule' },
                { value: 'stablecoin', label: 'Stablecoins' },
                { value: 'cbdc', label: 'CBDCs' },
              ]}
              value={mapColorMode}
              onChange={(v) => setMapColorMode(v as MapColorMode)}
            />
          </div>
        </div>
      </div>

      {/* ── Stablecoin Regulation (Stride data) ── */}
      {jurisdiction.stablecoinStage !== null && jurisdiction.stablecoinStage !== undefined && (
        <div className="reveal" style={{ marginTop: 32 }}>
          <h5 style={{ marginBottom: 16 }}>Stablecoin Regulation</h5>

          {/* Stage badge + yield */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
            <Badge
              label={STAGE_LABELS[jurisdiction.stablecoinStage] ?? 'Unknown'}
              colorMap={STABLECOIN_STAGE_COLORS}
            />
            {jurisdiction.yieldAllowed !== null && (
              <span style={{
                display: 'inline-block', padding: '2px 10px', borderRadius: 6,
                fontSize: '0.8125rem', fontWeight: 500,
                backgroundColor: jurisdiction.yieldAllowed ? '#ECFDF3' : '#FFF0F0',
                color: jurisdiction.yieldAllowed ? '#2B7A4B' : '#A93F3F',
              }}>
                Yield {jurisdiction.yieldAllowed ? 'Allowed' : 'Prohibited'}
              </span>
            )}
            {jurisdiction.isStablecoinSpecific && (
              <span style={{
                display: 'inline-block', padding: '2px 10px', borderRadius: 6,
                fontSize: '0.8125rem', fontWeight: 500, backgroundColor: '#EEF0FF', color: '#4B5CC4',
              }}>
                Stablecoin-Specific Law
              </span>
            )}
          </div>

          {/* Backing rules grid */}
          <div className="st-info-card clip-lg" style={{ margin: 0, marginBottom: 16 }}>
            <div className="st-info-row">
              <span className="st-info-label">Fiat-Backed</span>
              <span className="st-info-value">
                <BackingBadge value={jurisdiction.fiatBacked} alert={jurisdiction.fiatAlert} />
              </span>
            </div>
            <div className="st-info-row">
              <span className="st-info-label">Crypto-Backed</span>
              <span className="st-info-value">
                <BackingBadge value={jurisdiction.cryptoBacked} alert={jurisdiction.cryptoAlert} />
              </span>
            </div>
            <div className="st-info-row">
              <span className="st-info-label">Commodity-Backed</span>
              <span className="st-info-value">
                <BackingBadge value={jurisdiction.commodityBacked} alert={jurisdiction.commodityAlert} />
              </span>
            </div>
            <div className="st-info-row">
              <span className="st-info-label">Algorithmic</span>
              <span className="st-info-value">
                <BackingBadge value={jurisdiction.algorithmBacked} alert={jurisdiction.algorithmAlert} />
              </span>
            </div>
          </div>

          {/* Description */}
          {jurisdiction.stablecoinDescription && (
            <p style={{ color: 'var(--text)', lineHeight: 1.65, fontSize: '0.875rem', marginBottom: 16 }}>
              {jurisdiction.stablecoinDescription}
            </p>
          )}
          {jurisdiction.regulatorDescription && (
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.55, fontSize: '0.8125rem', marginBottom: 16 }}>
              {jurisdiction.regulatorDescription}
            </p>
          )}

          {/* Laws */}
          {countryLaws.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <h6 style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                Stablecoin Laws
              </h6>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {countryLaws.map((law: StablecoinLaw) => (
                  <div key={law.id} className="st-info-card clip-lg" style={{ margin: 0, padding: '12px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: 4 }}>
                          {law.citationUrl ? (
                            <a href={law.citationUrl} target="_blank" rel="noopener noreferrer" className="st-inline-link">
                              {law.title}
                            </a>
                          ) : law.title}
                        </div>
                        {law.description && (
                          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                            {law.description}
                          </div>
                        )}
                      </div>
                      {law.enactedDate && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {new Date(law.enactedDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Events timeline */}
          {countryEvents.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <h6 style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                Regulatory Events
              </h6>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {countryEvents
                  .sort((a: StablecoinEvent, b: StablecoinEvent) =>
                    (b.eventDate ?? '').localeCompare(a.eventDate ?? ''))
                  .map((ev: StablecoinEvent) => (
                  <div key={ev.id} className="st-info-card clip-lg" style={{ margin: 0, padding: '12px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: 4 }}>
                          {ev.citationUrl ? (
                            <a href={ev.citationUrl} target="_blank" rel="noopener noreferrer" className="st-inline-link">
                              {ev.title}
                            </a>
                          ) : ev.title}
                        </div>
                        {ev.details && (
                          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                            {ev.details}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, gap: 4 }}>
                        {ev.eventDate && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {new Date(ev.eventDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </span>
                        )}
                        {ev.eventType !== null && (
                          <span style={{
                            fontSize: '0.6875rem', padding: '1px 6px', borderRadius: 4,
                            backgroundColor: ev.eventType === 2 ? '#EEF0FF' : '#F0FDFA',
                            color: ev.eventType === 2 ? '#4B5CC4' : '#0D6857',
                          }}>
                            {ev.eventType === 2 ? 'Legislative' : 'Regulatory'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Issuer Licenses in this jurisdiction */}
          {countryLicenses.length > 0 && (
            <div>
              <h6 style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                Issuer Licenses
              </h6>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {countryLicenses.map((lic: IssuerLicense) => (
                  <div key={lic.id} className="st-info-card clip-lg" style={{ margin: 0, padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: 4 }}>
                      {lic.title}
                    </div>
                    {lic.subsidiaryName && (
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 2 }}>
                        {lic.subsidiaryName}
                      </div>
                    )}
                    {lic.detail && (
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                        {lic.detail}
                      </div>
                    )}
                    {lic.canIssue && (
                      <span style={{
                        display: 'inline-block', marginTop: 4, padding: '1px 8px', borderRadius: 4,
                        fontSize: '0.6875rem', fontWeight: 500, backgroundColor: '#ECFDF3', color: '#2B7A4B',
                      }}>
                        Can Issue
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CBDCs ── */}
      {countryCbdcs.length > 0 && (
        <div className="reveal" style={{ marginTop: 32 }}>
          <h5 style={{ marginBottom: 16 }}>Central Bank Digital Currencies</h5>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {countryCbdcs.map((cbdc) => (
              <div key={cbdc.id} className="st-info-card clip-lg" style={{ margin: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <h6 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
                    {cbdc.name}
                  </h6>
                  <Badge label={cbdc.status} colorMap={CBDC_STATUS_COLORS} />
                </div>
                <div className="st-info-row">
                  <span className="st-info-label">Currency</span>
                  <span className="st-info-value">{cbdc.currency || '—'}</span>
                </div>
                <div className="st-info-row">
                  <span className="st-info-label">Central Bank</span>
                  <span className="st-info-value">{cbdc.centralBank || '—'}</span>
                </div>
                <div className="st-info-row">
                  <span className="st-info-label">Type</span>
                  <span className="st-info-value">{cbdc.retailOrWholesale || '—'}</span>
                </div>
                {cbdc.technology && (
                  <div className="st-info-row">
                    <span className="st-info-label">Technology</span>
                    <span className="st-info-value">{cbdc.technology}</span>
                  </div>
                )}
                {cbdc.launchDate && (
                  <div className="st-info-row">
                    <span className="st-info-label">Launch Date</span>
                    <span className="st-info-value">
                      {new Date(cbdc.launchDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
                    </span>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  {cbdc.crossBorder && (
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: 4,
                      fontSize: '0.6875rem', fontWeight: 500, backgroundColor: '#ECFDF3', color: '#2B7A4B',
                    }}>
                      Cross-Border
                    </span>
                  )}
                  {cbdc.programmable && (
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: 4,
                      fontSize: '0.6875rem', fontWeight: 500, backgroundColor: '#EEF0FF', color: '#4B5CC4',
                    }}>
                      Programmable
                    </span>
                  )}
                  {cbdc.offlineCapable && (
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: 4,
                      fontSize: '0.6875rem', fontWeight: 500, backgroundColor: '#FFF8EB', color: '#92610B',
                    }}>
                      Offline Capable
                    </span>
                  )}
                  {cbdc.interestBearing && (
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: 4,
                      fontSize: '0.6875rem', fontWeight: 500, backgroundColor: '#F0FDFA', color: '#0D6857',
                    }}>
                      Interest-Bearing
                    </span>
                  )}
                </div>
                {cbdc.privacyModel && (
                  <div className="st-info-row" style={{ marginTop: 4 }}>
                    <span className="st-info-label">Privacy</span>
                    <span className="st-info-value">{cbdc.privacyModel}</span>
                  </div>
                )}
                {cbdc.crossBorderProjects.length > 0 && (
                  <div className="st-info-row">
                    <span className="st-info-label">Cross-Border Projects</span>
                    <span className="st-info-value">{cbdc.crossBorderProjects.join(', ')}</span>
                  </div>
                )}
                {cbdc.notes && (
                  <div className="st-info-row">
                    <span className="st-info-label">Notes</span>
                    <span className="st-info-value" style={{ fontSize: '0.8125rem' }}>{cbdc.notes}</span>
                  </div>
                )}
                {cbdc.sources.length > 0 && (
                  <div className="st-info-row">
                    <span className="st-info-label">Sources</span>
                    <span className="st-info-value">
                      {cbdc.sources.map((s, i) => (
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
            ))}
          </div>
        </div>
      )}

      {/* ── EU Member States Grid ── */}
      {isEU && memberStates.length > 0 && (
        <div className="reveal" style={{ marginTop: 32 }}>
          <h5 style={{ marginBottom: 16 }}>EU Member States</h5>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 12,
          }}>
            {memberStates.map((ms: Jurisdiction) => (
              <Link
                key={ms.code}
                to={`/jurisdictions/${ms.code}`}
                className="st-info-card clip-lg"
                style={{
                  margin: 0, padding: '14px 16px', textDecoration: 'none',
                  display: 'flex', alignItems: 'center', gap: 12,
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = '';
                  (e.currentTarget as HTMLElement).style.boxShadow = '';
                }}
              >
                <span style={{ fontSize: '1.5rem' }}>{countryCodeToFlag(ms.code)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {ms.name}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {ms.entityCount} {ms.entityCount === 1 ? 'entity' : 'entities'}
                    </span>
                    <Badge label={ms.regime} colorMap={REGIME_CHIP_COLORS} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {safeEntities.length > 0 && (
        <>
          <div className="reveal" style={{ marginBottom: 16 }}>
            <h5>{isEU ? `All Licensed Entities across the EU` : `Entities in ${jurisdiction.name}`}</h5>
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
    </article>
  );
}
