import type { ComponentType, FormEvent } from 'react';
import { useState } from 'react';
import { Scale, BookOpen, Search, ArrowRight, Coins, Globe, Building2, Landmark } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getJurisdictions, getEntities, getStablecoins, getCbdcs } from '../data/dataLoader';
import { useReveal, useStaggerReveal, useCounter } from '../hooks/useAnimations';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import HeroWorldMapCanvas from '../components/ui/HeroWorldMapCanvas';

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  label: string;
  value: number;
}) {
  const counterRef = useCounter(value);
  return (
    <div className="st-landing-stat-card stagger-in">
      <div className="st-landing-stat-icon" aria-hidden="true">
        <Icon size={18} color="currentColor" strokeWidth={2} />
      </div>
      <span className="st-landing-stat-value"><span ref={counterRef}>0</span></span>
      <span className="st-landing-stat-label">{label}</span>
    </div>
  );
}

export default function LandingPage() {
  useDocumentMeta({
    title: 'Global Crypto Registry',
    description: 'Track cryptocurrency regulations, VASP licensing, stablecoins, CBDCs, and Travel Rule compliance across 206 countries worldwide.',
    path: '/',
    noSuffix: true,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'RemiDe',
      description: 'Global cryptocurrency regulatory intelligence platform tracking VASP licensing across 206 jurisdictions.',
      url: 'https://anton-remide.github.io/remide',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
    },
  });

  const navigate = useNavigate();
  const { data: jurisdictions, loading: jLoading, error, refetch } = useSupabaseQuery(getJurisdictions);
  const { data: entities, loading: eLoading } = useSupabaseQuery(getEntities);
  const { data: stablecoins, loading: sLoading } = useSupabaseQuery(getStablecoins);
  const { data: cbdcs, loading: cLoading } = useSupabaseQuery(getCbdcs);

  const loading = jLoading || eLoading || sLoading || cLoading;
  const totalEntities = entities?.length ?? 0;
  const totalStablecoins = stablecoins?.length ?? 0;
  const totalCbdcs = cbdcs?.length ?? 0;

  const revealRef = useReveal(loading);
  const statsRef = useStaggerReveal(loading);
  const featuresRef = useStaggerReveal(loading);
  const [subscribeEmail, setSubscribeEmail] = useState('');
  const [subscribeFocused, setSubscribeFocused] = useState(false);
  const [subscribeError, setSubscribeError] = useState<string | null>(null);
  const [subscribeSent, setSubscribeSent] = useState(false);

  const handleSubscribeSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (subscribeSent) return;

    const email = subscribeEmail.trim();
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!isValidEmail) {
      setSubscribeError('Please enter a valid email address.');
      return;
    }

    setSubscribeSent(true);
    setSubscribeError(null);
  };

  const stats = [
    { icon: Globe, label: 'Countries Tracked', value: jurisdictions?.length ?? 0 },
    { icon: Building2, label: 'Licensed Entities', value: totalEntities },
    { icon: Coins, label: 'Stablecoins Tracked', value: totalStablecoins },
    { icon: Landmark, label: 'CBDC Projects', value: totalCbdcs },
  ];

  const features = [
    { icon: Scale, title: 'Regulatory Regimes', desc: 'Instantly see how each jurisdiction classifies crypto — Licensing, Registration, Sandbox, or Ban — so you know where you can operate' },
    { icon: BookOpen, title: 'Travel Rule Tracking', desc: 'Know exactly which countries enforce FATF Travel Rule, which have legislated it, and which are still in progress — critical for compliance teams' },
    { icon: Search, title: 'Entity Directory', desc: `Search ${totalEntities}+ licensed VASPs, exchanges, custodians, and EMIs with direct links to regulators and license details` },
    { icon: Coins, title: 'Stablecoins & CBDCs', desc: 'Track regulatory status of major stablecoins across jurisdictions and follow 25+ central bank digital currency projects from research to launch' },
  ];

  if (loading) {
    return (
      <div className="st-landing-v2">
        <div className="st-landing-state" role="status" aria-label="Loading">
          <div className="st-loading-pulse" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="st-landing-v2">
        <div className="st-landing-state" role="alert" aria-label="Failed to load">
          <h4 className="st-landing-error-title">Failed to load data</h4>
          <p className="st-landing-error-text">{error}</p>
          <button className="st-btn" onClick={refetch}>Try Again</button>
        </div>
      </div>
    );
  }

  return (
    <div ref={revealRef} className="st-landing-v2">
      {/* Hero */}
      <section className="st-hero">
        <div className="st-hero-map-wrap">
          <HeroWorldMapCanvas />
        </div>
        <div className="st-hero-inner">
          <div className="st-hero-content">
            <h1 className="reveal st-landing-hero-title">
              <span>Stablecoin</span>
              <span>Intelligence</span>
              <span>Platform</span>
            </h1>
            <p className="reveal">
              Track stablecoin licensing frameworks, issuer compliance, and Travel Rule status across{' '}
              <strong>{jurisdictions?.length ?? 0} jurisdictions</strong>{' '}
              worldwide
            </p>
            <div className="st-hero-buttons reveal">
              <button className="st-btn" onClick={() => navigate('/jurisdictions')}>
                Explore Map
              </button>
              <button className="st-btn-outline" onClick={() => navigate('/entities')}>
                Browse Entities <ArrowRight size={16} className="st-landing-cta-icon" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section ref={statsRef} className="st-stats-section">
        <div className="st-landing-container">
          <div className="st-landing-stats-grid">
            {stats.map((s) => (
              <StatCard key={s.label} icon={s.icon} label={s.label} value={s.value} />
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section ref={featuresRef} className="st-landing-v2-features">
        <div className="st-landing-container">
          <div className="st-landing-section-header reveal">
            <h2>Global Registry Data Ecosystem</h2>
          </div>
          <div className="st-landing-features-grid">
            {features.map((f) => (
              <div key={f.title} className="st-feature-card clip-lg stagger-in">
                <div className="st-feature-header">
                  <div className="st-feature-icon" aria-hidden="true">
                    <f.icon size={20} color="currentColor" strokeWidth={2} />
                  </div>
                  <h6>{f.title}</h6>
                </div>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Subscribe */}
      <section className="st-landing-subscribe-section">
        <div className="st-landing-container">
          <div className="st-landing-subscribe reveal">
            <h3>RemiDe Tracker is a continuous work in progress. Stay updated.</h3>
            <form
              data-testid="landing-subscribe-form"
              className={`st-landing-subscribe-form${subscribeFocused ? ' is-focused' : ''}${subscribeError ? ' is-error' : ''}${subscribeSent ? ' is-sent' : ''}`}
              onSubmit={handleSubscribeSubmit}
              noValidate
            >
              <input
                type="email"
                value={subscribeEmail}
                onChange={(event) => {
                  setSubscribeEmail(event.target.value);
                  if (subscribeError) setSubscribeError(null);
                }}
                onFocus={() => setSubscribeFocused(true)}
                onBlur={() => setSubscribeFocused(false)}
                placeholder="Enter email"
                aria-label="Enter email"
                aria-invalid={subscribeError ? 'true' : 'false'}
                disabled={subscribeSent}
              />
              <button className="st-btn" type="submit" disabled={subscribeSent}>
                {subscribeSent ? 'Sent' : 'Get updates'}
              </button>
            </form>
            <p aria-live="polite" className={`st-landing-subscribe-status${subscribeError ? ' is-error' : ''}${subscribeSent ? ' is-sent' : ''}`}>
              {subscribeError || (subscribeSent ? 'Thanks! You are on the update list.' : '')}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
