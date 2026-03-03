import { useParams, useNavigate } from 'react-router-dom';
import { useCallback } from 'react';
import { ExternalLink } from 'lucide-react';
import { getStablecoinById } from '../data/dataLoader';
import { STABLECOIN_TYPE_COLORS, STABLECOIN_STATUS_COLORS } from '../theme';
import { useReveal } from '../hooks/useAnimations';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { countryCodeToFlag } from '../utils/countryFlags';
import Breadcrumb from '../components/ui/Breadcrumb';
import Badge from '../components/ui/Badge';

export default function StablecoinDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const fetcher = useCallback(() => getStablecoinById(id ?? ''), [id]);
  const { data: coin, loading, error } = useSupabaseQuery(fetcher, [id]);
  const revealRef = useReveal(loading);

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
    <div ref={revealRef} className="st-page">
      <div className="reveal">
        <Breadcrumb crumbs={[
          { label: 'Home', to: '/' },
          { label: 'Stablecoins & CBDCs', to: '/stablecoins' },
          { label: `${coin.ticker} — ${coin.name}` },
        ]} />
      </div>

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
        </div>
      </div>

      {/* Notes */}
      {coin.notes && (
        <div className="reveal" style={{ marginBottom: 28 }}>
          <p style={{ color: 'var(--text)', lineHeight: 1.65, fontSize: '0.9375rem' }}>{coin.notes}</p>
        </div>
      )}

      {/* Info card */}
      <div className="reveal st-info-card clip-lg" style={{ marginBottom: 32 }}>
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
      </div>

      {/* Chains */}
      {coin.chains.length > 0 && (
        <div className="reveal" style={{ marginBottom: 28 }}>
          <h6 style={{ marginBottom: 12, color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Supported Chains</h6>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {coin.chains.map((c) => (
              <span key={c} className="st-badge" style={{ backgroundColor: 'var(--bg-light)', color: 'var(--text)', fontWeight: 500, fontSize: '0.75rem' }}>
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Jurisdiction status table */}
      {coin.majorJurisdictions.length > 0 && (
        <div className="reveal" style={{ marginBottom: 32 }}>
          <h6 style={{ marginBottom: 16, color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Regulatory Status by Jurisdiction</h6>
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
                      {countryCodeToFlag(j.code)} {j.code}
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
    </div>
  );
}
