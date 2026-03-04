import { useParams, useNavigate, Link } from 'react-router-dom';
import { useCallback } from 'react';
import { ExternalLink, CheckCircle, XCircle } from 'lucide-react';
import { getCbdcById } from '../data/dataLoader';
import { CBDC_STATUS_COLORS } from '../theme';
import { useReveal } from '../hooks/useAnimations';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { countryCodeToFlag } from '../utils/countryFlags';
import Breadcrumb from '../components/ui/Breadcrumb';
import Badge from '../components/ui/Badge';

function BoolIndicator({ value, label }: { value: boolean; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {value ? (
        <CheckCircle size={14} style={{ color: '#2B7A4B' }} />
      ) : (
        <XCircle size={14} style={{ color: '#94A3B8' }} />
      )}
      <span style={{ fontSize: '0.875rem', color: value ? 'var(--text)' : 'var(--text-muted)' }}>
        {label}
      </span>
    </div>
  );
}

export default function CbdcDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const fetcher = useCallback(() => getCbdcById(id ?? ''), [id]);
  const { data: cbdc, loading, error } = useSupabaseQuery(fetcher, [id]);
  const revealRef = useReveal(loading);

  useDocumentMeta({
    title: cbdc ? `${cbdc.name} — CBDC Profile` : 'CBDC',
    description: cbdc
      ? `${cbdc.name}: ${cbdc.status} central bank digital currency from ${cbdc.country}. Technology: ${cbdc.technology}.`
      : 'Loading CBDC details...',
    path: id ? `/cbdcs/${id}` : undefined,
  });

  if (loading) {
    return (
      <div className="st-page" style={{ paddingTop: 120, textAlign: 'center' }}>
        <div className="st-loading-pulse" />
      </div>
    );
  }

  if (error || !cbdc) {
    return (
      <div className="st-page" style={{ paddingTop: 120, textAlign: 'center' }}>
        <h4 style={{ marginBottom: 12 }}>{error || 'CBDC not found'}</h4>
        <button className="st-btn" onClick={() => navigate('/stablecoins')}>Back to Stablecoins & CBDCs</button>
      </div>
    );
  }

  return (
    <div ref={revealRef} className="st-page">
      <div className="reveal">
        <Breadcrumb crumbs={[
          { label: 'Home', to: '/' },
          { label: 'Stablecoins & CBDCs', to: '/stablecoins' },
          { label: cbdc.name },
        ]} />
      </div>

      <div className="reveal" style={{ marginTop: 24, marginBottom: 32 }}>
        <h2 style={{ fontFamily: 'var(--font2)', marginBottom: 8 }}>
          {countryCodeToFlag(cbdc.countryCode)} {cbdc.name}
        </h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Badge label={cbdc.status} colorMap={CBDC_STATUS_COLORS} />
          <span className="st-badge" style={{ backgroundColor: 'var(--bg-light)', color: 'var(--text)', fontWeight: 600, fontFamily: 'var(--font2)' }}>
            {cbdc.currency}
          </span>
          <span className="st-badge" style={{ backgroundColor: 'var(--bg-light)', color: 'var(--text)' }}>
            {cbdc.retailOrWholesale}
          </span>
        </div>
      </div>

      {/* Notes */}
      {cbdc.notes && (
        <div className="reveal" style={{ marginBottom: 28 }}>
          <p style={{ color: 'var(--text)', lineHeight: 1.65, fontSize: '0.9375rem' }}>{cbdc.notes}</p>
        </div>
      )}

      {/* Info card */}
      <div className="reveal st-info-card clip-lg" style={{ marginBottom: 32 }}>
        <div className="st-info-row">
          <span className="st-info-label">Country</span>
          <span className="st-info-value">
            <Link to={`/jurisdictions/${cbdc.countryCode}`}>
              {countryCodeToFlag(cbdc.countryCode)} {cbdc.country}
            </Link>
          </span>
        </div>
        <div className="st-info-row">
          <span className="st-info-label">Central Bank</span>
          <span className="st-info-value">{cbdc.centralBank}</span>
        </div>
        <div className="st-info-row">
          <span className="st-info-label">Phase</span>
          <span className="st-info-value">{cbdc.phase}</span>
        </div>
        <div className="st-info-row">
          <span className="st-info-label">Launch Date</span>
          <span className="st-info-value">
            {cbdc.launchDate ? new Date(cbdc.launchDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Not announced'}
          </span>
        </div>
        <div className="st-info-row">
          <span className="st-info-label">Technology</span>
          <span className="st-info-value">{cbdc.technology}</span>
        </div>
        <div className="st-info-row">
          <span className="st-info-label">Privacy Model</span>
          <span className="st-info-value">{cbdc.privacyModel}</span>
        </div>
      </div>

      {/* Feature indicators */}
      <div className="reveal" style={{ marginBottom: 28 }}>
        <h6 style={{ marginBottom: 16, color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Features</h6>
        <div className="st-card clip-lg" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            <BoolIndicator value={cbdc.crossBorder} label="Cross-Border" />
            <BoolIndicator value={cbdc.programmable} label="Programmable" />
            <BoolIndicator value={cbdc.offlineCapable} label="Offline Capable" />
            <BoolIndicator value={cbdc.interestBearing} label="Interest Bearing" />
          </div>
        </div>
      </div>

      {/* Cross-border projects */}
      {cbdc.crossBorderProjects.length > 0 && (
        <div className="reveal" style={{ marginBottom: 28 }}>
          <h6 style={{ marginBottom: 12, color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Cross-Border Projects</h6>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {cbdc.crossBorderProjects.map((p) => (
              <span key={p} className="st-badge" style={{ backgroundColor: 'var(--bg-light)', color: 'var(--text)', fontWeight: 500, fontSize: '0.75rem' }}>
                {p}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Sources */}
      {cbdc.sources.length > 0 && (
        <div className="reveal" style={{ marginBottom: 32 }}>
          <h6 style={{ marginBottom: 12, color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Sources</h6>
          <div className="st-card clip-lg" style={{ padding: 0, overflow: 'hidden' }}>
            {cbdc.sources.map((s) => (
              <a
                key={s.url}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="st-related-link"
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {s.name}
                <ExternalLink size={12} style={{ opacity: 0.5 }} />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
