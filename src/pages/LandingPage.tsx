import { Globe, Building2, Shield, CheckCircle, Scale, BookOpen, Search, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getJurisdictions } from '../data/dataLoader';
import { useReveal, useStaggerReveal } from '../hooks/useAnimations';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import StatCard from '../components/ui/StatCard';
import ContactForm from '../components/ui/ContactForm';
import WorldMap from '../components/map/WorldMap';

export default function LandingPage() {
  const navigate = useNavigate();
  const { data: jurisdictions, loading, error, refetch } = useSupabaseQuery(getJurisdictions);

  // Derive entity count from jurisdictions (public table) — no auth needed
  const totalEntities = jurisdictions?.reduce((sum, j) => sum + j.entityCount, 0) ?? 0;
  const active = jurisdictions?.filter((j) => j.entityCount > 0).length ?? 0;
  const travelEnforced = jurisdictions?.filter((j) => j.travelRule === 'Enforced').length ?? 0;

  const revealRef = useReveal(loading);
  const statsRef = useStaggerReveal(loading);
  const featuresRef = useStaggerReveal(loading);

  const stats = [
    { icon: Globe, label: 'Countries Tracked', value: jurisdictions?.length ?? 0 },
    { icon: Building2, label: 'Licensed Entities', value: totalEntities },
    { icon: Shield, label: 'Active Jurisdictions', value: active },
    { icon: CheckCircle, label: 'Travel Rule Enforced', value: travelEnforced },
  ];

  const features = [
    { icon: Scale, title: 'Regulatory Regimes', desc: 'Licensing, Registration, Sandbox, and Ban classifications for every country' },
    { icon: BookOpen, title: 'Travel Rule Tracking', desc: 'FATF Travel Rule implementation status — Enforced, Legislated, In Progress' },
    { icon: Search, title: 'Entity Directory', desc: `${totalEntities}+ licensed VASPs, exchanges, custodians, EMIs, and payment providers` },
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
          <div className="st-label reveal" style={{ marginBottom: 24 }}>
            Regulatory Intelligence Platform
          </div>
          <h1 className="reveal" style={{ marginBottom: 24 }}>
            Global VASP & Crypto<br />Registry Tracker
          </h1>
          <p className="reveal" style={{ maxWidth: 520, margin: '0 auto 48px', color: 'var(--text-muted)', lineHeight: 1.6, fontSize: '1.0625rem' }}>
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

      {/* Stats */}
      <section ref={statsRef} className="st-stats-section">
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div className="row g-3">
            {stats.map((s) => (
              <div key={s.label} className="col-6 col-md-3">
                <StatCard icon={s.icon} label={s.label} value={s.value} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Map Preview */}
      <section className="reveal" style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 24px 0' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div className="st-label" style={{ marginBottom: 16 }}>Global Coverage</div>
          <h3>
            Explore crypto regulation across {jurisdictions?.length ?? 0} jurisdictions
          </h3>
        </div>
        <div className="clip-lg" style={{ border: '1px solid rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <WorldMap
            jurisdictions={jurisdictions ?? []}
            selectedRegimes={[]}
            selectedTravelRules={[]}
            onCountryClick={(code) => navigate(`/jurisdictions/${code}`)}
            compact
          />
        </div>
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <button className="st-btn" onClick={() => navigate('/jurisdictions')}>
            View Full Map <ArrowRight size={16} style={{ marginLeft: 4 }} />
          </button>
        </div>
      </section>

      {/* Features */}
      <section ref={featuresRef} style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 24px' }}>
        <div className="reveal" style={{ textAlign: 'center', marginBottom: 48 }}>
          <div className="st-label" style={{ marginBottom: 16 }}>Features</div>
          <h3>Everything you need to navigate global crypto regulation</h3>
        </div>
        <div className="row g-3">
          {features.map((f) => (
            <div key={f.title} className="col-12 col-md-4">
              <div className="st-feature-card clip-lg stagger-in">
                <div className="st-feature-icon">
                  <f.icon size={22} color="var(--black)" strokeWidth={1.5} />
                </div>
                <h6>{f.title}</h6>
                <p>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Contact */}
      <section style={{ maxWidth: 640, margin: '0 auto', padding: '0 24px 80px' }}>
        <div className="reveal" style={{ textAlign: 'center', marginBottom: 40 }}>
          <div className="st-label" style={{ marginBottom: 16 }}>Contact</div>
          <h3>Questions about our data or partnership opportunities?</h3>
        </div>
        <div className="reveal">
          <ContactForm />
        </div>
      </section>
    </div>
  );
}
