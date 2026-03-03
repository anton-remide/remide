import { useParams, useNavigate, Link } from 'react-router-dom';
import { useCallback, useMemo } from 'react';
import { ExternalLink, Linkedin } from 'lucide-react';
import { getEntityById, getEntitiesByCountry, getJurisdictionByCode } from '../data/dataLoader';
import { STATUS_COLORS, REGIME_CHIP_COLORS, TRAVEL_RULE_COLORS } from '../theme';
import { useReveal } from '../hooks/useAnimations';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { countryCodeToFlag } from '../utils/countryFlags';
import Breadcrumb from '../components/ui/Breadcrumb';
import Badge from '../components/ui/Badge';

export default function EntityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const entityFetcher = useCallback(() => getEntityById(id ?? ''), [id]);
  const { data: entity, loading, error } = useSupabaseQuery(entityFetcher, [id]);
  const revealRef = useReveal(loading);

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
    <div ref={revealRef} className="st-page">
      <div className="reveal">
        <Breadcrumb crumbs={[
          { label: 'Home', to: '/' },
          { label: 'Entities', to: '/entities' },
          { label: entity.name },
        ]} />
      </div>

      <div className="reveal" style={{ marginTop: 24, marginBottom: 32 }}>
        <h2 style={{ fontFamily: 'var(--font2)', marginBottom: 12 }}>{entity.name}</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Badge label={entity.status} colorMap={STATUS_COLORS} />
          {jurisdiction && (
            <>
              <Badge label={jurisdiction.regime} colorMap={REGIME_CHIP_COLORS} />
              <Badge label={jurisdiction.travelRule} colorMap={TRAVEL_RULE_COLORS} />
            </>
          )}
        </div>
      </div>

      {/* Description */}
      {entity.description && (
        <div className="reveal" style={{ marginBottom: 28 }}>
          <p style={{ color: 'var(--text)', lineHeight: 1.65, fontSize: '0.9375rem' }}>{entity.description}</p>
        </div>
      )}

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
        <div className="st-info-row">
          <span className="st-info-label">License Number</span>
          <span className="st-info-value">{entity.licenseNumber || '—'}</span>
        </div>
        {entity.website && (
          <div className="st-info-row">
            <span className="st-info-label">Website</span>
            <span className="st-info-value">
              <a href={entity.website} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {entity.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                <ExternalLink size={12} />
              </a>
            </span>
          </div>
        )}
        {entity.registryUrl && (
          <div className="st-info-row">
            <span className="st-info-label">Registry</span>
            <span className="st-info-value">
              <a href={entity.registryUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                Verify license
                <ExternalLink size={12} />
              </a>
            </span>
          </div>
        )}
        {entity.linkedinUrl && (
          <div className="st-info-row">
            <span className="st-info-label">LinkedIn</span>
            <span className="st-info-value">
              <a href={entity.linkedinUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Linkedin size={14} />
                Company page
                <ExternalLink size={12} />
              </a>
            </span>
          </div>
        )}
      </div>

      {entity.activities.length > 0 && (
        <div className="reveal" style={{ marginBottom: 28 }}>
          <h6 style={{ marginBottom: 12, color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Activities</h6>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {entity.activities.map((a) => (
              <span key={a} className="st-badge" style={{ backgroundColor: 'var(--bg-light)', color: 'var(--text)', fontWeight: 500, height: 26, fontSize: '0.75rem' }}>
                {a}
              </span>
            ))}
          </div>
        </div>
      )}

      {entity.entityTypes.length > 0 && (
        <div className="reveal" style={{ marginBottom: 32 }}>
          <h6 style={{ marginBottom: 12, color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Entity Types</h6>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {entity.entityTypes.map((t) => (
              <span key={t} className="st-badge" style={{ backgroundColor: 'var(--bg-light)', color: 'var(--text)', fontWeight: 500, height: 26, fontSize: '0.75rem' }}>
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {related.length > 0 && (
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
      )}
    </div>
  );
}
