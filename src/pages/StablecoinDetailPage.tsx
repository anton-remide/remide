import { useParams, useNavigate, Link } from 'react-router-dom';
import { useCallback, useMemo } from 'react';
import { ExternalLink, FileText, Building2, Shield, Globe, Copy, Check } from 'lucide-react';
import { getStablecoinById, getStablecoinIssuerByStrideId, getBlockchainsByStablecoin, getLicensesByIssuer } from '../data/dataLoader';
import { STABLECOIN_TYPE_COLORS, STABLECOIN_STATUS_COLORS } from '../theme';
import { useReveal } from '../hooks/useAnimations';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { countryCodeToFlag } from '../utils/countryFlags';
import Breadcrumb from '../components/ui/Breadcrumb';
import Badge from '../components/ui/Badge';
import { useState } from 'react';

/* ── Helpers ── */

const SECTION_LABEL: React.CSSProperties = {
  marginBottom: 16,
  color: 'var(--text-muted)',
  fontSize: '0.75rem',
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
};

function truncateAddress(addr: string): string {
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* fallback: ignore */ }
  };
  return (
    <button
      onClick={handleCopy}
      title="Copy address"
      style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: 2,
        color: copied ? 'var(--green)' : 'var(--text-muted)',
        display: 'inline-flex', alignItems: 'center',
      }}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}

/** Codes that don't have a standalone jurisdiction page (supranational / virtual) */
const NON_JURISDICTION_CODES = new Set<string>([]);

/** Renders a country code as a clickable link or plain text if no jurisdiction page exists */
function JurisdictionLink({ code, label, style }: { code: string; label?: string; style?: React.CSSProperties }) {
  const display = (
    <>
      {countryCodeToFlag(code)} {label || code}
    </>
  );
  if (NON_JURISDICTION_CODES.has(code.toUpperCase())) {
    return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, ...style }}>{display}</span>;
  }
  return (
    <Link to={`/jurisdictions/${code}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, ...style }}>
      {display}
    </Link>
  );
}

export default function StablecoinDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const fetcher = useCallback(() => getStablecoinById(id ?? ''), [id]);
  const { data: coin, loading, error } = useSupabaseQuery(fetcher, [id]);

  // Stride: issuer, blockchains, licenses — fetch only when coin is loaded
  const issuerFetcher = useCallback(
    () => (coin?.issuerId ? getStablecoinIssuerByStrideId(coin.issuerId) : Promise.resolve(null)),
    [coin?.issuerId],
  );
  const blockchainFetcher = useCallback(
    () => (coin?.ticker ? getBlockchainsByStablecoin(coin.ticker) : Promise.resolve([])),
    [coin?.ticker],
  );
  const licenseFetcher = useCallback(
    () => (coin?.issuerId ? getLicensesByIssuer(coin.issuerId) : Promise.resolve([])),
    [coin?.issuerId],
  );

  const { data: issuer } = useSupabaseQuery(issuerFetcher, [coin?.issuerId]);
  const { data: blockchains } = useSupabaseQuery(blockchainFetcher, [coin?.ticker]);
  const { data: licenses } = useSupabaseQuery(licenseFetcher, [coin?.issuerId]);

  // Re-trigger reveal when secondary data arrives
  const revealTrigger = `${loading}-${!!issuer}-${blockchains?.length}-${licenses?.length}`;
  const revealRef = useReveal(revealTrigger);

  // Unique chains from blockchains (more detailed than coin.chains)
  const chainCount = useMemo(() => blockchains?.length ?? 0, [blockchains]);

  useDocumentMeta({
    title: coin ? `${coin.name} (${coin.ticker}) — Stablecoin Profile` : 'Stablecoin',
    description: coin
      ? `${coin.name} (${coin.ticker}): ${coin.type} stablecoin. Market cap: $${coin.marketCapBn.toFixed(1)}B. Issuer: ${coin.issuer}.`
      : 'Loading stablecoin details...',
    path: id ? `/stablecoins/${id}` : undefined,
    jsonLd: coin ? {
      '@context': 'https://schema.org',
      '@type': 'FinancialProduct',
      name: `${coin.name} (${coin.ticker})`,
      description: `${coin.type} stablecoin pegged to ${coin.pegCurrency}. Issued by ${coin.issuer}.`,
      url: `https://anton-remide.github.io/remide/stablecoins/${id}`,
      provider: { '@type': 'Organization', name: coin.issuer },
      category: 'Stablecoin',
    } : undefined,
  });

  if (loading) {
    return (
      <div className="st-page" style={{ paddingTop: 120, textAlign: 'center' }}>
        <div className="st-loading-pulse" />
      </div>
    );
  }

  if (error || !coin) {
    return (
      <div className="st-page" style={{ paddingTop: 120, textAlign: 'center' }}>
        <h4 style={{ marginBottom: 12 }}>{error || 'Stablecoin not found'}</h4>
        <button className="st-btn" onClick={() => navigate('/stablecoins')}>Back to Stablecoins</button>
      </div>
    );
  }

  return (
    <article ref={revealRef} className="st-page">
      <div className="reveal">
        <Breadcrumb crumbs={[
          { label: 'Home', to: '/' },
          { label: 'Stablecoins & CBDCs', to: '/stablecoins' },
          { label: `${coin.ticker} — ${coin.name}` },
        ]} />
      </div>

      {/* ── Header ── */}
      <div className="reveal" style={{ marginTop: 24, marginBottom: 32 }}>
        <h2 style={{ fontFamily: 'var(--font2)', marginBottom: 8 }}>
          {coin.ticker} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>— {coin.name}</span>
        </h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Badge label={coin.type} colorMap={STABLECOIN_TYPE_COLORS} />
          <span className="st-badge" style={{ backgroundColor: 'var(--bg-light)', color: 'var(--text)', fontWeight: 600, fontFamily: 'var(--font2)' }}>
            {coin.pegCurrency}
          </span>
          <span className="st-badge" style={{ backgroundColor: 'var(--bg-light)', color: 'var(--text)', fontFamily: 'var(--font2)' }}>
            ${coin.marketCapBn >= 1 ? `${coin.marketCapBn.toFixed(1)}B` : `${(coin.marketCapBn * 1000).toFixed(0)}M`}
          </span>
          {coin.collateralMethod && (
            <span className="st-badge" style={{ backgroundColor: 'var(--bg-light)', color: 'var(--text)', fontSize: '0.75rem' }}>
              {coin.collateralMethod}
            </span>
          )}
        </div>
      </div>

      {/* Notes */}
      {coin.notes && (
        <div className="reveal" style={{ marginBottom: 28 }}>
          <p style={{ color: 'var(--text)', lineHeight: 1.65, fontSize: '0.9375rem' }}>{coin.notes}</p>
        </div>
      )}

      {/* ── Two-column layout: Info + Issuer ── */}
      <div className="reveal" style={{ display: 'grid', gridTemplateColumns: issuer ? 'repeat(auto-fit, minmax(320px, 1fr))' : '1fr', gap: 24, marginBottom: 32 }}>

        {/* Info card */}
        <div className="st-info-card clip-lg">
          <div className="st-info-row">
            <span className="st-info-label">Issuer</span>
            <span className="st-info-value">{coin.issuer}</span>
          </div>
          <div className="st-info-row">
            <span className="st-info-label">Issuer Country</span>
            <span className="st-info-value">{countryCodeToFlag(coin.issuerCountry)} {coin.issuerCountry}</span>
          </div>
          <div className="st-info-row">
            <span className="st-info-label">Launch Date</span>
            <span className="st-info-value">{coin.launchDate ? new Date(coin.launchDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}</span>
          </div>
          <div className="st-info-row">
            <span className="st-info-label">Reserve Type</span>
            <span className="st-info-value">{coin.reserveType}</span>
          </div>
          <div className="st-info-row">
            <span className="st-info-label">Audit Status</span>
            <span className="st-info-value">{coin.auditStatus}</span>
          </div>
          <div className="st-info-row">
            <span className="st-info-label">Regulatory Status</span>
            <span className="st-info-value">{coin.regulatoryStatus}</span>
          </div>
          {coin.collateralMethod && (
            <div className="st-info-row">
              <span className="st-info-label">Collateral Method</span>
              <span className="st-info-value">{coin.collateralMethod}</span>
            </div>
          )}
          {coin.website && (
            <div className="st-info-row">
              <span className="st-info-label">Website</span>
              <span className="st-info-value">
                <a href={coin.website} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {coin.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  <ExternalLink size={12} />
                </a>
              </span>
            </div>
          )}
          {coin.whitepaperUrl && (
            <div className="st-info-row">
              <span className="st-info-label">Whitepaper</span>
              <span className="st-info-value">
                <a href={coin.whitepaperUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--green)' }}>
                  <FileText size={13} /> View Whitepaper
                  <ExternalLink size={12} />
                </a>
              </span>
            </div>
          )}
        </div>

        {/* ── Issuer card (Stride data) ── */}
        {issuer && (
          <div className="st-card clip-lg" style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Building2 size={16} style={{ color: 'var(--green)' }} />
              <h6 style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Issuer Profile</h6>
              {issuer.isVerified && (
                <span className="st-badge" style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: 'var(--green)', fontSize: '0.6875rem' }}>Verified</span>
              )}
            </div>

            <h5 style={{ fontFamily: 'var(--font2)', marginBottom: 4 }}>
              {issuer.slug ? (
                <Link to={`/issuers/${issuer.slug}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                  {issuer.name}
                </Link>
              ) : issuer.name}
            </h5>
            {issuer.officialName && issuer.officialName !== issuer.name && (
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '0 0 8px' }}>{issuer.officialName}</p>
            )}
            {issuer.formerNames && (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 12px', fontStyle: 'italic' }}>
                Formerly: {issuer.formerNames}
              </p>
            )}

            {issuer.description && (
              <p style={{ fontSize: '0.8125rem', lineHeight: 1.6, color: 'var(--text)', marginBottom: 16 }}>
                {issuer.description.length > 280 ? `${issuer.description.slice(0, 280)}…` : issuer.description}
              </p>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: '0.8125rem' }}>
              {issuer.countryCode && (
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Country</span>
                  <div style={{ marginTop: 2 }}>
                    <JurisdictionLink code={issuer.countryCode} label={issuer.country || issuer.countryCode} />
                  </div>
                </div>
              )}
              {issuer.auditor && (
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Auditor</span>
                  <div style={{ marginTop: 2 }}>{issuer.auditor}</div>
                </div>
              )}
              {issuer.assuranceFrequency && (
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Assurance</span>
                  <div style={{ marginTop: 2 }}>{issuer.assuranceFrequency}</div>
                </div>
              )}
              {issuer.lei && (
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>LEI</span>
                  <div style={{ marginTop: 2, fontFamily: 'var(--font2)', fontSize: '0.75rem' }}>{issuer.lei}</div>
                </div>
              )}
            </div>

            {issuer.website && (
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-light)' }}>
                <a href={issuer.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8125rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Globe size={13} />
                  {issuer.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  <ExternalLink size={11} />
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Blockchain Deployments (Stride) ── */}
      {blockchains && blockchains.length > 0 && (
        <div className="reveal" style={{ marginBottom: 32 }}>
          <h6 style={SECTION_LABEL}>
            Blockchain Deployments <span style={{ color: 'var(--text)', fontFamily: 'var(--font2)', fontWeight: 400 }}>({chainCount})</span>
          </h6>
          <div className="st-card clip-lg" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="st-table" style={{ width: '100%', margin: 0 }}>
              <thead>
                <tr>
                  <th style={{ padding: '10px 16px' }}>Blockchain</th>
                  <th style={{ padding: '10px 16px' }}>Contract Address</th>
                  <th style={{ padding: '10px 16px' }}>Deploy Date</th>
                </tr>
              </thead>
              <tbody>
                {blockchains.map((bc) => (
                  <tr key={bc.id}>
                    <td style={{ padding: '10px 16px', fontWeight: 500 }}>{bc.blockchainName}</td>
                    <td style={{ padding: '10px 16px', fontFamily: 'var(--font2)', fontSize: '0.8125rem' }}>
                      {bc.contractAddress ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <code style={{ background: 'var(--bg-light)', padding: '2px 6px', borderRadius: 4, fontSize: '0.75rem' }}>
                            {truncateAddress(bc.contractAddress)}
                          </code>
                          <CopyButton text={bc.contractAddress} />
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                      {bc.deployDate ? new Date(bc.deployDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Issuer Licenses (Stride) ── */}
      {licenses && licenses.length > 0 && (
        <div className="reveal" style={{ marginBottom: 32 }}>
          <h6 style={SECTION_LABEL}>
            <Shield size={13} style={{ marginRight: 4, verticalAlign: -2 }} />
            Issuer Licenses <span style={{ color: 'var(--text)', fontFamily: 'var(--font2)', fontWeight: 400 }}>({licenses.length})</span>
          </h6>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {licenses.map((lic) => (
              <div key={lic.id} className="st-card clip-lg" style={{ padding: '14px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <h6 style={{ fontSize: '0.8125rem', fontWeight: 600, margin: 0, flex: 1 }}>{lic.title}</h6>
                  {lic.canIssue && (
                    <span className="st-badge" style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: 'var(--green)', fontSize: '0.625rem', flexShrink: 0 }}>Can Issue</span>
                  )}
                </div>
                {lic.detail && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '6px 0 0', lineHeight: 1.5 }}>
                    {lic.detail.length > 150 ? `${lic.detail.slice(0, 150)}…` : lic.detail}
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

      {/* ── Supported Chains (original data, fallback if no blockchains) ── */}
      {coin.chains.length > 0 && (!blockchains || blockchains.length === 0) && (
        <div className="reveal" style={{ marginBottom: 28 }}>
          <h6 style={SECTION_LABEL}>Supported Chains</h6>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {coin.chains.map((c) => (
              <span key={c} className="st-badge" style={{ backgroundColor: 'var(--bg-light)', color: 'var(--text)', fontWeight: 500, fontSize: '0.75rem' }}>
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Jurisdiction status table ── */}
      {coin.majorJurisdictions.length > 0 && (
        <div className="reveal" style={{ marginBottom: 32 }}>
          <h6 style={SECTION_LABEL}>Regulatory Status by Jurisdiction</h6>
          <div className="st-card clip-lg" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="st-table" style={{ width: '100%', margin: 0 }}>
              <thead>
                <tr>
                  <th style={{ padding: '10px 16px' }}>Jurisdiction</th>
                  <th style={{ padding: '10px 16px' }}>Status</th>
                  <th style={{ padding: '10px 16px' }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {coin.majorJurisdictions.map((j) => (
                  <tr key={j.code}>
                    <td style={{ padding: '10px 16px', fontWeight: 500 }}>
                      <JurisdictionLink code={j.code} />
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <Badge label={j.status} colorMap={STABLECOIN_STATUS_COLORS} />
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                      {j.notes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </article>
  );
}
