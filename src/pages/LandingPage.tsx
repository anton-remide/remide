import { useState, useEffect } from 'react';
import { Scale, BookOpen, Search, ArrowRight, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getJurisdictions } from '../data/dataLoader';
import { useReveal, useStaggerReveal, useCounter } from '../hooks/useAnimations';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';

/* Minimal stat card — number + label, no icon */
function NumberStat({ label, value }: { label: string; value: number }) {
  const counterRef = useCounter(value);
  return (
    <div className="st-card clip-lg stagger-in" style={{ textAlign: 'center', padding: '24px 16px' }}>
      <div className="stat-value"><span ref={counterRef}>0</span></div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const { data: jurisdictions, loading, error, refetch } = useSupabaseQuery(getJurisdictions);

  const totalEntities = jurisdictions?.reduce((sum, j) => sum + j.entityCount, 0) ?? 0;
  const active = jurisdictions?.filter((j) => j.entityCount > 0).length ?? 0;
  const travelEnforced = jurisdictions?.filter((j) => j.travelRule === 'Enforced').length ?? 0;

  const revealRef = useReveal(loading);
  const statsRef = useStaggerReveal(loading);
  const featuresRef = useStaggerReveal(loading);

  // Hide scroll hint after scrolling past hero
  const [scrollHintHidden, setScrollHintHidden] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      setScrollHintHidden(window.scrollY > 120);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const stats = [
    { label: 'Countries Tracked', value: jurisdictions?.length ?? 0 },
    { label: 'Licensed Entities', value: totalEntities },
    { label: 'Active Jurisdictions', value: active },
    { label: 'Travel Rule Enforced', value: travelEnforced },
  ];

  const features = [
    { icon: Scale, title: 'Regulatory Regimes', desc: 'Instantly see how each jurisdiction classifies crypto — Licensing, Registration, Sandbox, or Ban — so you know where you can operate' },
    { icon: BookOpen, title: 'Travel Rule Tracking', desc: 'Know exactly which countries enforce FATF Travel Rule, which have legislated it, and which are still in progress — critical for compliance teams' },
    { icon: Search, title: 'Entity Directory', desc: `Search ${totalEntities}+ licensed VASPs, exchanges, custodians, and EMIs with direct links to regulators and license details` },
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
        <h4 style={{ marginBottom: 12 }}>Failed to load data</h4>
        <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: '0.875rem' }}>{error}</p>
        <button className="st-btn" onClick={refetch}>Try Again</button>
      </div>
    );
  }

  return (
    <div ref={revealRef}>
      {/* Hero */}
      <section className="st-hero">
        <div className="st-hero-inner">
          <h1 className="reveal" style={{ marginBottom: 24 }}>
            Global VASP & Crypto<br />Registry Tracker
          </h1>
          <p className="reveal" style={{ maxWidth: 520, margin: '0 auto 32px', color: 'var(--text-muted)', lineHeight: 1.6, fontSize: '1.0625rem' }}>
            Comprehensive database of licensed crypto asset service providers across{' '}
            <strong style={{ color: 'var(--black)' }}>{jurisdictions?.length ?? 0} jurisdictions</strong>{' '}
            worldwide
          </p>
          <div className="st-hero-buttons reveal">
            <button className="st-btn" onClick={() => navigate('/jurisdictions')}>
              Explore Map
            </button>
            <button className="st-btn-outline" onClick={() => navigate('/entities')}>
              Browse Entities <ArrowRight size={16} style={{ marginLeft: 4 }} />
            </button>
          </div>
        </div>
      </section>

      {/* Scroll Hint */}
      <button
        className={`st-scroll-hint${scrollHintHidden ? ' st-scroll-hint-hidden' : ''}`}
        onClick={() => window.scrollTo({ top: window.innerHeight * 0.7, behavior: 'smooth' })}
        aria-label="Scroll to explore"
      >
        <span>Scroll to explore</span>
        <ChevronDown size={16} className="st-scroll-hint-arrow" />
      </button>

      {/* Stats — numbers only, no icons */}
      <section ref={statsRef} className="st-stats-section">
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div className="row g-3">
            {stats.map((s) => (
              <div key={s.label} className="col-6 col-md-3">
                <NumberStat label={s.label} value={s.value} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section ref={featuresRef} style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px 80px' }}>
        <div className="reveal" style={{ textAlign: 'center', marginBottom: 40 }}>
          <h3>Everything you need to navigate global crypto regulation</h3>
        </div>
        <div className="row g-3">
          {features.map((f) => (
            <div key={f.title} className="col-12 col-md-4">
              <div className="st-feature-card clip-lg stagger-in">
                <div className="st-feature-icon">
                  <f.icon size={24} color="var(--black)" strokeWidth={2} />
                </div>
                <h6>{f.title}</h6>
                <p>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
