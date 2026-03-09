import { useParams, useNavigate, Link } from 'react-router-dom';
import { useCallback, useMemo, useEffect } from 'react';
import { ExternalLink, Linkedin, Twitter, Lock } from 'lucide-react';
import { getEntityById, getEntitiesByCountry, getJurisdictionByCode } from '../data/dataLoader';
import { STATUS_COLORS, REGIME_CHIP_COLORS, TRAVEL_RULE_COLORS } from '../theme';
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

export default function EntityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAnonymous, hasAccess, hasFullAccess } = usePaywall();

  const entityFetcher = useCallback(() => getEntityById(id ?? ''), [id]);
  const { data: entity, loading, error } = useSupabaseQuery(entityFetcher, [id]);
  const revealRef = useReveal(loading);

  useDocumentMeta({
    title: entity ? `${entity.name} — ${entity.status} VASP` : 'Entity',
    description: entity
      ? (entity.description || `${entity.name} is a ${entity.status} crypto service provider in ${entity.country}. License: ${entity.licenseNumber ?? 'N/A'}.`)
      : 'Loading entity details...',
    path: id ? `/entities/${id}` : undefined,
    jsonLd: entity ? {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: entity.name,
      description: entity.description || `${entity.name} — ${entity.status} crypto service provider in ${entity.country}`,
      url: entity.website || `https://anton-remide.github.io/remide/entities/${id}`,
      address: { '@type': 'PostalAddress', addressCountry: entity.countryCode },
    } : undefined,
  });

  useEffect(() => {
    if (id) {
      trackEvent('entity_detail_view', { id });
      if (!hasFullAccess) {
        trackEvent('paywall_shown', { page: `/entities/${id}`, type: 'entity', tier: isAnonymous ? 'anonymous' : 'registered' });
      }
    }
  }, [id, isAnonymous, hasFullAccess]);

  // Fetch related data once we have the entity
  const jurisdictionFetcher = useCallback(
    () => entity ? getJurisdictionByCode(entity.countryCode) : Promise.resolve(null),
    [entity],
  );
  const relatedFetcher = useCallback(
    () => entity ? getEntitiesByCountry(entity.countryCode) : Promise.resolve([]),
    [entity],
  );

  const { data: jurisdiction } = useSupabaseQuery(jurisdictionFetcher, [entity?.countryCode]);
  const { data: allRelated } = useSupabaseQuery(relatedFetcher, [entity?.countryCode]);

  const related = useMemo(
    () => (allRelated ?? []).filter((e) => e.id !== entity?.id).slice(0, 10),
    [allRelated, entity?.id],
  );

  // Count premium items for CTA messaging
  const premiumCount = useMemo(() => {
    let count = 0;
    if (entity?.licenseNumber) count++;
    if (entity?.website) count++;
    if (entity?.registryUrl) count++;
    if (entity?.linkedinUrl) count++;
    if (entity?.twitterUrl) count++;
    count += related.length;
    return count;
  }, [entity, related]);

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
        <h4 style={{ marginBottom: 12 }}>Failed to load entity</h4>
        <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: '0.875rem' }}>{error}</p>
        <button className="st-btn" onClick={() => navigate('/entities')}>Back to Entities</button>
      </div>
    );
  }

  if (!entity) {
    return (
      <div className="st-page" style={{ paddingTop: 48, textAlign: 'center' }}>
        <h4>Entity not found</h4>
        <button className="st-btn" style={{ marginTop: 16 }} onClick={() => navigate('/entities')}>
          Back to Entities
        </button>
      </div>
    );
  }

  return (
    <article ref={revealRef} className="st-page">
      <div className="reveal">
        <Breadcrumb crumbs={[
          { label: 'Home', to: '/' },
          { label: 'Entities', to: '/entities' },
          { label: entity.name },
        ]} />
      </div>

      {/* ── Header — always visible for SEO + preview ── */}
      <div className="reveal" style={{ marginTop: 24, marginBottom: 32 }}>
        <h2 style={{ fontFamily: 'var(--font2)', marginBottom: 12 }}>
          {entity.name}
          {entity.dnsStatus === 'dead' && <span role="img" aria-label="Website is offline" title="Website is dead" style={{ marginLeft: 8, fontSize: '0.75em' }}>💀</span>}
        </h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Badge label={entity.status} colorMap={STATUS_COLORS} />
          {jurisdiction && (
            <>
              <Badge label={jurisdiction.regime} colorMap={REGIME_CHIP_COLORS} />
              <Badge label={jurisdiction.travelRule} colorMap={TRAVEL_RULE_COLORS} />
            </>
          )}
          {entity.dnsStatus === 'dead' && (
            <Badge label="Dead Website" colorMap={{ 'Dead Website': { bg: '#fee2e2', text: '#991b1b' } }} />
          )}
        </div>
      </div>

      {/* ── Description — always visible ── */}
      {entity.description && (
        <div className="reveal" style={{ marginBottom: 28 }}>
          <p style={{ color: 'var(--text)', lineHeight: 1.65, fontSize: '0.9375rem' }}>{entity.description}</p>
        </div>
      )}

      {/* ── Info card — basic fields always visible, premium fields shown but gated ── */}
      <div className="reveal st-info-card clip-lg" style={{ marginBottom: 32 }}>
        <div className="st-info-row">
          <span className="st-info-label">Country</span>
          <span className="st-info-value">
            <Link to={`/jurisdictions/${entity.countryCode}`}>
              {countryCodeToFlag(entity.countryCode)} {entity.country}
            </Link>
          </span>
        </div>
        <div className="st-info-row">
          <span className="st-info-label">Regulator</span>
          <span className="st-info-value">{entity.regulator || '—'}</span>
        </div>
        <div className="st-info-row">
          <span className="st-info-label">License Type</span>
          <span className="st-info-value">{entity.licenseType || '—'}</span>
        </div>
        {/* License Number — blurred teaser for non-paid, real for paid */}
        <div className="st-info-row">
          <span className="st-info-label">License Number</span>
          {hasFullAccess ? (
            <span className="st-info-value">{entity.licenseNumber || '—'}</span>
          ) : (
            <span className="st-info-value st-blur-value" style={{ opacity: 0.6 }}>
              {entity.licenseNumber || 'LIC-2024-XXXX'}
            </span>
          )}
        </div>
        {/* Website — show blurred for non-paid */}
        {entity.website && /^https?:\/\//.test(entity.website) && (
          <div className="st-info-row">
            <span className="st-info-label">Website</span>
            {hasFullAccess ? (
              <span className="st-info-value">
                <a href={entity.website} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {entity.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  <ExternalLink size={12} />
                </a>
              </span>
            ) : (
              <span className="st-info-value st-blur-value" style={{ opacity: 0.6 }}>
                {entity.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
              </span>
            )}
          </div>
        )}
        {/* Registry — show blurred for non-paid */}
        {entity.registryUrl && (
          <div className="st-info-row">
            <span className="st-info-label">Registry</span>
            {hasFullAccess ? (
              <span className="st-info-value">
                <a href={entity.registryUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  Verify license
                  <ExternalLink size={12} />
                </a>
              </span>
            ) : (
              <span className="st-info-value st-blur-value" style={{ opacity: 0.6 }}>
                Verify license
              </span>
            )}
          </div>
        )}
        {/* LinkedIn — show blurred for non-paid */}
        {entity.linkedinUrl && (
          <div className="st-info-row">
            <span className="st-info-label">LinkedIn</span>
            {hasFullAccess ? (
              <span className="st-info-value">
                <a href={entity.linkedinUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Linkedin size={14} />
                  Company page
                  <ExternalLink size={12} />
                </a>
              </span>
            ) : (
              <span className="st-info-value st-blur-value" style={{ opacity: 0.6 }}>
                <Linkedin size={14} /> Company page
              </span>
            )}
          </div>
        )}
        {/* Twitter — show blurred for non-paid */}
        {entity.twitterUrl && (
          <div className="st-info-row">
            <span className="st-info-label">Twitter / X</span>
            {hasFullAccess ? (
              <span className="st-info-value">
                <a href={entity.twitterUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Twitter size={14} />
                  @{entity.twitterUrl.replace(/^https?:\/\/(www\.)?(twitter\.com|x\.com)\//, '')}
                  <ExternalLink size={12} />
                </a>
              </span>
            ) : (
              <span className="st-info-value st-blur-value" style={{ opacity: 0.6 }}>
                <Twitter size={14} /> @{entity.twitterUrl.replace(/^https?:\/\/(www\.)?(twitter\.com|x\.com)\//, '').slice(0, 3)}...
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Activities — visible for registered+, blurred for anonymous ── */}
      {entity.activities.length > 0 && (
        hasAccess ? (
          <div className="reveal" style={{ marginBottom: 28 }}>
            <h6 className="st-section-label" style={{ marginBottom: 12 }}>Activities</h6>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {entity.activities.map((a) => (
                <span key={a} className="st-badge" style={{ backgroundColor: 'var(--bg-light)', color: 'var(--text)', fontWeight: 500, height: 26, fontSize: '0.75rem' }}>
                  {a}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="reveal" style={{ marginBottom: 28 }}>
            <h6 className="st-section-label" style={{ marginBottom: 12 }}>Activities</h6>
            <div className="st-blur-value" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {entity.activities.map((a) => (
                <span key={a} className="st-badge" style={{ backgroundColor: 'var(--bg-light)', color: 'var(--text)', fontWeight: 500, height: 26, fontSize: '0.75rem' }}>
                  {a}
                </span>
              ))}
            </div>
          </div>
        )
      )}

      {/* ── Entity Types — visible for registered+, blurred for anonymous ── */}
      {entity.entityTypes.length > 0 && (
        hasAccess ? (
          <div className="reveal" style={{ marginBottom: 32 }}>
            <h6 className="st-section-label" style={{ marginBottom: 12 }}>Entity Types</h6>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {entity.entityTypes.map((t) => (
                <span key={t} className="st-badge" style={{ backgroundColor: 'var(--bg-light)', color: 'var(--text)', fontWeight: 500, height: 26, fontSize: '0.75rem' }}>
                  {t}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="reveal" style={{ marginBottom: 32 }}>
            <h6 className="st-section-label" style={{ marginBottom: 12 }}>Entity Types</h6>
            <div className="st-blur-value" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {entity.entityTypes.map((t) => (
                <span key={t} className="st-badge" style={{ backgroundColor: 'var(--bg-light)', color: 'var(--text)', fontWeight: 500, height: 26, fontSize: '0.75rem' }}>
                  {t}
                </span>
              ))}
            </div>
          </div>
        )
      )}

      {/* ── Premium divider — for non-paid users ── */}
      {!hasFullAccess && (
        <div className="st-premium-divider">
          <span className="st-premium-badge"><Lock size={10} /> Full Access</span>
        </div>
      )}

      {/* ── Related Entities — shown blurred via PaywallGate for non-paid ── */}
      {related.length > 0 && (
        <PaywallGate
          locked={!hasFullAccess}
          title={isAnonymous ? `Unlock ${entity.name} Full Profile` : `Unlock ${entity.name} Premium Data`}
          count={premiumCount}
          noun="premium data fields"
          variant={isAnonymous ? 'signup' : 'upgrade'}
        >
          <div className="reveal" style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
              <h6>
                Other entities in {entity.country}
                {jurisdiction && <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.8125rem' }}> · {jurisdiction.entityCount} total</span>}
              </h6>
              {jurisdiction && jurisdiction.entityCount > 11 && (
                <Link to={`/jurisdictions/${entity.countryCode}`} style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  View all →
                </Link>
              )}
            </div>
            <div className="st-card clip-lg" style={{ padding: 0, overflow: 'hidden' }}>
              {related.map((r) => (
                <Link key={r.id} to={`/entities/${r.id}`} className="st-related-link">
                  {r.name}
                </Link>
              ))}
            </div>
          </div>
        </PaywallGate>
      )}

      {/* ── If no related entities and not paid, still show a gate with CTA ── */}
      {related.length === 0 && !hasFullAccess && (
        <PaywallGate
          locked={true}
          title={isAnonymous ? `Unlock ${entity.name} Full Profile` : `Unlock Premium Data`}
          count={premiumCount}
          noun="premium data fields"
          variant={isAnonymous ? 'signup' : 'upgrade'}
        >
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
              <div style={{ height: 14, background: 'var(--border)', borderRadius: 4, width: '80%' }} />
              <div style={{ height: 14, background: 'var(--border)', borderRadius: 4, width: '60%' }} />
              <div style={{ height: 14, background: 'var(--border)', borderRadius: 4, width: '70%' }} />
            </div>
          </div>
        </PaywallGate>
      )}

      {/* ── Floating bottom CTA for non-paid users ── */}
      <FloatingPaywallCTA />
    </article>
  );
}
