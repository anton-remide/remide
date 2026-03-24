import { useParams, useNavigate, Link } from 'react-router-dom';
import { useCallback, useMemo, useEffect } from 'react';
import { ExternalLink, Building2, Shield, Globe, BadgeCheck, Users } from 'lucide-react';
import {
  getIssuerBySlug,
  getStablecoinsByIssuer,
  getSubsidiariesByIssuer,
  getLicensesByIssuer,
} from '../data/dataLoader';
import { STABLECOIN_TYPE_COLORS } from '../theme';
import { useReveal } from '../hooks/useAnimations';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { usePaywall } from '../hooks/usePaywall';
import { trackEvent } from '../utils/analytics';
import { countryCodeToFlag } from '../utils/countryFlags';
import Breadcrumb from '../components/ui/Breadcrumb';
import Badge from '../components/ui/Badge';
import PaywallGate from '../components/ui/PaywallGate';
import FloatingPaywallCTA from '../components/ui/FloatingPaywallCTA';

/* ── Style helpers ── */

/* SECTION_LABEL → now uses CSS class .st-section-label (B3 audit fix) */

export default function IssuerDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { isAnonymous, hasAccess, hasFullAccess } = usePaywall();

  /* ── Data fetching ── */
  const issuerFetcher = useCallback(() => getIssuerBySlug(slug ?? ''), [slug]);
  const { data: issuer, loading, error } = useSupabaseQuery(issuerFetcher, [slug]);

  const stablecoinsFetcher = useCallback(
    () => (issuer?.strideId ? getStablecoinsByIssuer(issuer.strideId) : Promise.resolve([])),
    [issuer?.strideId],
  );
  const subsidsFetcher = useCallback(
    () => (issuer?.strideId ? getSubsidiariesByIssuer(issuer.strideId) : Promise.resolve([])),
    [issuer?.strideId],
  );
  const licensesFetcher = useCallback(
    () => (issuer?.strideId ? getLicensesByIssuer(issuer.strideId) : Promise.resolve([])),
    [issuer?.strideId],
  );

  const { data: stablecoins } = useSupabaseQuery(stablecoinsFetcher, [issuer?.strideId]);
  const { data: subsidiaries } = useSupabaseQuery(subsidsFetcher, [issuer?.strideId]);
  const { data: licenses } = useSupabaseQuery(licensesFetcher, [issuer?.strideId]);

  // Re-trigger reveal when secondary data arrives
  const revealTrigger = `${loading}-${!!issuer}-${stablecoins?.length}-${subsidiaries?.length}-${licenses?.length}`;
  const revealRef = useReveal(revealTrigger);

  // Stablecoin count for header
  const coinCount = useMemo(() => stablecoins?.length ?? 0, [stablecoins]);

  useEffect(() => {
    if (slug) {
      trackEvent('issuer_detail_view', { slug });
      if (isAnonymous) {
        trackEvent('paywall_shown', { page: `/issuers/${slug}`, type: 'issuer' });
      }
    }
  }, [slug, isAnonymous]);

  /* ── SEO ── */
  useDocumentMeta({
    title: issuer ? `${issuer.name} — Stablecoin Issuer Profile` : 'Issuer Profile',
    description: issuer
      ? `${issuer.name}${issuer.officialName && issuer.officialName !== issuer.name ? ` (${issuer.officialName})` : ''}: Stablecoin issuer based in ${issuer.country || 'N/A'}. ${issuer.auditor ? `Audited by ${issuer.auditor}.` : ''} ${coinCount > 0 ? `Issues ${coinCount} stablecoin${coinCount > 1 ? 's' : ''}.` : ''}`
      : 'Loading issuer details...',
    path: slug ? `/issuers/${slug}` : undefined,
    jsonLd: issuer ? {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: issuer.name,
      ...(issuer.officialName && issuer.officialName !== issuer.name ? { legalName: issuer.officialName } : {}),
      description: issuer.description || `Stablecoin issuer based in ${issuer.country || 'N/A'}.`,
      url: issuer.website || `https://anton-remide.github.io/remide/issuers/${slug}`,
      ...(issuer.lei ? { identifier: { '@type': 'PropertyValue', propertyID: 'LEI', value: issuer.lei } } : {}),
      ...(issuer.countryCode ? { address: { '@type': 'PostalAddress', addressCountry: issuer.countryCode } } : {}),
    } : undefined,
  });

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="st-page" style={{ paddingTop: 120, textAlign: 'center' }}>
        <div className="st-loading-pulse" />
      </div>
    );
  }

  if (error || !issuer) {
    return (
      <div className="st-page" style={{ paddingTop: 120, textAlign: 'center' }}>
        <h4 style={{ marginBottom: 12 }}>{error || 'Issuer not found'}</h4>
        <button className="st-btn" onClick={() => navigate('/entities?tab=issuers')}>Back to Issuers</button>
      </div>
    );
  }

  return (
    <article ref={revealRef} className="st-page">
      {/* ── Breadcrumb ── */}
      <div className="reveal">
        <Breadcrumb crumbs={[
          { label: 'Home', to: '/' },
          { label: 'Entities', to: '/entities' },
          { label: 'Issuers', to: '/entities?tab=issuers' },
          { label: issuer.name },
        ]} />
      </div>

      {/* ── Header ── */}
      <div className="reveal" style={{ marginTop: 24, marginBottom: 32 }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {issuer.countryCode && (
            <span style={{ fontSize: '1.5rem' }}>{countryCodeToFlag(issuer.countryCode)}</span>
          )}
          {issuer.name}
          {issuer.isVerified && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.875rem', color: 'var(--color-success)' }}>
              <BadgeCheck size={18} /> Verified
            </span>
          )}
        </h2>
        {issuer.officialName && issuer.officialName !== issuer.name && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>{issuer.officialName}</p>
        )}
        {issuer.formerNames && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', margin: '4px 0 0', fontStyle: 'italic' }}>
            Formerly: {issuer.formerNames}
          </p>
        )}
      </div>

      {/* ── Description ── */}
      {issuer.description && (
        <div className="reveal" style={{ marginBottom: 28 }}>
          <p style={{ color: 'var(--text)', lineHeight: 1.65, fontSize: '0.9375rem' }}>{issuer.description}</p>
        </div>
      )}

      {/* ── Info card ── */}
      <div className="reveal" style={{ marginBottom: 32 }}>
        <div className="st-info-card clip-lg">
          {issuer.country && (
            <div className="st-info-row">
              <span className="st-info-label">Country</span>
              <span className="st-info-value">
                {issuer.countryCode && (
                  <Link to={`/jurisdictions/${issuer.countryCode}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {countryCodeToFlag(issuer.countryCode)} {issuer.country}
                  </Link>
                )}
              </span>
            </div>
          )}
          {issuer.lei && (
            <div className="st-info-row">
              <span className="st-info-label">LEI</span>
              <span className="st-info-value" style={{ fontFamily: 'var(--font-heading)', fontSize: '0.8125rem' }}>{issuer.lei}</span>
            </div>
          )}
          {issuer.cik && (
            <div className="st-info-row">
              <span className="st-info-label">SEC CIK</span>
              <span className="st-info-value" style={{ fontFamily: 'var(--font-heading)', fontSize: '0.8125rem' }}>{issuer.cik}</span>
            </div>
          )}
          {issuer.auditor && (
            <div className="st-info-row">
              <span className="st-info-label">Auditor</span>
              <span className="st-info-value">{issuer.auditor}</span>
            </div>
          )}
          {issuer.assuranceFrequency && (
            <div className="st-info-row">
              <span className="st-info-label">Assurance Frequency</span>
              <span className="st-info-value">{issuer.assuranceFrequency}</span>
            </div>
          )}
          {issuer.redemptionPolicy && (
            <div className="st-info-row">
              <span className="st-info-label">Redemption Policy</span>
              <span className="st-info-value">{issuer.redemptionPolicy}</span>
            </div>
          )}
          {issuer.website && (
            <div className="st-info-row">
              <span className="st-info-label">Website</span>
              <span className="st-info-value">
                <a href={issuer.website} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Globe size={13} />
                  {issuer.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  <ExternalLink size={12} />
                </a>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Stablecoins Issued — registered+ ── */}
      {hasAccess && stablecoins && stablecoins.length > 0 && (
        <div className="reveal" style={{ marginBottom: 32 }}>
          <h6 className="st-section-label">
            <Building2 size={13} style={{ marginRight: 4, verticalAlign: -2 }} />
            Stablecoins Issued <span style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)', fontWeight: 400 }}>({stablecoins.length})</span>
          </h6>
          <div className="st-card clip-lg" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="st-table-scroll">
            <table className="st-table" style={{ width: '100%', margin: 0 }}>
              <thead>
                <tr>
                  <th style={{ padding: '10px 16px' }}>Ticker</th>
                  <th style={{ padding: '10px 16px' }}>Name</th>
                  <th style={{ padding: '10px 16px' }}>Type</th>
                  <th style={{ padding: '10px 16px' }}>Peg</th>
                  <th style={{ padding: '10px 16px' }}>Market Cap</th>
                </tr>
              </thead>
              <tbody>
                {stablecoins.map((sc) => (
                  <tr
                    key={sc.id}
                    onClick={() => navigate(`/stablecoins/${sc.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td style={{ padding: '10px 16px', fontWeight: 600, fontFamily: 'var(--font-heading)' }}>{sc.ticker}</td>
                    <td style={{ padding: '10px 16px' }}>{sc.name}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <Badge label={sc.type} colorMap={STABLECOIN_TYPE_COLORS} />
                    </td>
                    <td style={{ padding: '10px 16px' }}>{sc.pegCurrency}</td>
                    <td style={{ padding: '10px 16px', fontFamily: 'var(--font-heading)', fontWeight: 500 }}>
                      ${sc.marketCapBn >= 1 ? `${sc.marketCapBn.toFixed(1)}B` : `${(sc.marketCapBn * 1000).toFixed(0)}M`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Corporate Structure & Licenses — shown blurred for non-paid via PaywallGate ── */}
      {((subsidiaries && subsidiaries.length > 0) || (licenses && licenses.length > 0)) && (
        <PaywallGate
          locked={!hasFullAccess}
          title={isAnonymous ? `Unlock ${issuer.name} Full Profile` : `Unlock ${issuer.name} Premium Data`}
          count={(subsidiaries?.length ?? 0) + (licenses?.length ?? 0)}
          noun="corporate records"
          variant={isAnonymous ? 'signup' : 'upgrade'}
        >
          {/* ── Corporate Structure (Subsidiaries) ── */}
          {subsidiaries && subsidiaries.length > 0 && (
            <div className="reveal" style={{ marginBottom: 32 }}>
              <h6 className="st-section-label">
                <Users size={13} style={{ marginRight: 4, verticalAlign: -2 }} />
                Corporate Structure <span style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)', fontWeight: 400 }}>({subsidiaries.length})</span>
              </h6>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(300px, 100%), 1fr))', gap: 12 }}>
                {subsidiaries.map((sub) => (
                  <div key={sub.id} className="st-card clip-lg" style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <h6 style={{ fontSize: '0.8125rem', fontWeight: 600, margin: 0, flex: 1 }}>{sub.name}</h6>
                      {sub.canIssue && (
                        <span className="st-badge" style={{ backgroundColor: 'var(--color-success-subtle)', color: 'var(--color-success)', fontSize: '0.625rem', flexShrink: 0 }}>Can Issue</span>
                      )}
                    </div>
                    <div style={{ marginTop: 8, fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {sub.countryCode && (
                        <span>{countryCodeToFlag(sub.countryCode)} {sub.country || sub.countryCode}</span>
                      )}
                      {sub.lei && (
                        <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.6875rem' }}>LEI: {sub.lei}</span>
                      )}
                      {sub.incorporationDate && (
                        <span>Est. {new Date(sub.incorporationDate).getFullYear()}</span>
                      )}
                    </div>
                    {sub.description && (
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '6px 0 0', lineHeight: 1.5 }}>
                        {sub.description.length > 150 ? `${sub.description.slice(0, 150)}...` : sub.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Global Licenses ── */}
          {licenses && licenses.length > 0 && (
            <div className="reveal" style={{ marginBottom: 32 }}>
              <h6 className="st-section-label">
                <Shield size={13} style={{ marginRight: 4, verticalAlign: -2 }} />
                Global Licenses <span style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)', fontWeight: 400 }}>({licenses.length})</span>
              </h6>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                {licenses.map((lic) => (
                  <div key={lic.id} className="st-card clip-lg" style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <h6 style={{ fontSize: '0.8125rem', fontWeight: 600, margin: 0, flex: 1 }}>{lic.title}</h6>
                      {lic.canIssue && (
                        <span className="st-badge" style={{ backgroundColor: 'var(--color-success-subtle)', color: 'var(--color-success)', fontSize: '0.625rem', flexShrink: 0 }}>Can Issue</span>
                      )}
                    </div>
                    {lic.detail && (
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '6px 0 0', lineHeight: 1.5 }}>
                        {lic.detail.length > 150 ? `${lic.detail.slice(0, 150)}...` : lic.detail}
                      </p>
                    )}
                    <div style={{ marginTop: 8, fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {lic.countryCode && (
                        <span>{countryCodeToFlag(lic.countryCode)} {lic.country || lic.countryCode}</span>
                      )}
                      {lic.subsidiaryName && (
                        <span>via {lic.subsidiaryName}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </PaywallGate>
      )}

      {/* ── Floating bottom CTA for non-paid users ── */}
      <FloatingPaywallCTA />
    </article>
  );
}
