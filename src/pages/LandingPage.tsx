import type { ComponentType, FormEvent } from 'react';
import { useState, useEffect } from 'react';
import { Scale, BookOpen, Search, ArrowRight, Coins, Globe, Building2, Landmark, Zap, TrendingUp, Shield } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { getJurisdictions, getEntityCount, getStablecoins, getCbdcs } from '../data/dataLoader';
import { useReveal, useStaggerReveal, useCounter } from '../hooks/useAnimations';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { trackEvent } from '../utils/analytics';
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
      <div className="st-landing-stat-row">
        <div className="st-landing-stat-icon" aria-hidden="true">
          <Icon size={16} color="currentColor" strokeWidth={2} />
        </div>
        <span className="st-landing-stat-value"><span ref={counterRef}>0</span></span>
      </div>
      <span className="st-landing-stat-label">{label}</span>
    </div>
  );
}

export default function LandingPage() {
  useDocumentMeta({
    title: 'Stablecoin Intelligence Platform — RemiDe',
    description: 'Track stablecoin regulation, VASP licensing, issuer compliance, and Travel Rule status across 206 jurisdictions. Purpose-built for compliance teams.',
    path: '/',
    noSuffix: true,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'RemiDe',
      description: 'Stablecoin regulatory intelligence platform tracking licensing frameworks, entity registries, and Travel Rule compliance across 206 jurisdictions.',
      url: 'https://anton-remide.github.io/remide',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
    },
  });

  useEffect(() => {
    trackEvent('landing_page_view');
  }, []);

  const navigate = useNavigate();
  const { data: jurisdictions, loading: jLoading, error, refetch } = useSupabaseQuery(getJurisdictions);
  const { data: entityCount, loading: eLoading } = useSupabaseQuery(getEntityCount);
  const { data: stablecoins, loading: sLoading } = useSupabaseQuery(getStablecoins);
  const { data: cbdcs, loading: cLoading } = useSupabaseQuery(getCbdcs);

  const loading = jLoading || eLoading || sLoading || cLoading;
  const totalEntities = entityCount ?? 0;
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

    trackEvent('newsletter_subscribe', { email });
    setSubscribeSent(true);
    setSubscribeError(null);
  };

  const stats = [
    { icon: Globe, label: 'Jurisdictions Tracked', value: jurisdictions?.length ?? 0 },
    { icon: Building2, label: 'Regulated Entities', value: totalEntities },
    { icon: Coins, label: 'Stablecoins Monitored', value: totalStablecoins },
    { icon: Landmark, label: 'CBDC Projects', value: totalCbdcs },
  ];

  const features = [
    {
      icon: Scale,
      title: 'Regulatory Regime Classification',
      desc: 'Instantly assess how each jurisdiction classifies crypto assets — Licensing, Registration, Sandbox, or Ban. Essential for market entry decisions.',
    },
    {
      icon: BookOpen,
      title: 'Travel Rule Compliance Map',
      desc: 'Track FATF Travel Rule implementation status globally. Know which countries enforce, which have legislated, and which are still in progress.',
    },
    {
      icon: Search,
      title: 'Entity Registry Intelligence',
      desc: `Search ${totalEntities.toLocaleString()}+ regulated entities — VASPs, EMIs, payment institutions, banks — with direct regulator links and license details.`,
    },
    {
      icon: Coins,
      title: 'Stablecoin Regulation Tracker',
      desc: 'Per-jurisdiction stablecoin frameworks, backing rules, issuer licensing requirements, and regulatory milestones — all in structured, queryable format.',
    },
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
              <span>Stablecoin Intelligence</span>
            </h1>
            {/* Audience split */}
            <div className="st-audience-grid st-audience-grid--hero reveal">
              <div className="st-audience-card clip-lg">
                <div className="st-audience-header">
                  <div className="st-audience-icon">
                    <TrendingUp size={22} />
                  </div>
                  <h3>Business Development</h3>
                </div>
                <p>
                  A live database of regulated entities across 206 jurisdictions.
                  Spot market trends and identify expansion opportunities before
                  competitors as new licenses are issued.
                </p>
                <ul className="st-audience-bullets">
                  <li>Entity contact database</li>
                  <li>Market entry trends</li>
                  <li>Competitor intelligence</li>
                </ul>
              </div>
              <div className="st-audience-card clip-lg">
                <div className="st-audience-header">
                  <div className="st-audience-icon">
                    <Shield size={22} />
                  </div>
                  <h3>Compliance &amp; Legal</h3>
                </div>
                <p>
                  Every licensing framework, stablecoin law, and regulatory
                  change — structured and continuously updated from 49+
                  official sources. Built for audit-ready workflows.
                </p>
                <ul className="st-audience-bullets">
                  <li>License framework tracker</li>
                  <li>Regulatory trend alerts</li>
                  <li>Compliance audit support</li>
                </ul>
              </div>
            </div>

            <div className="st-hero-buttons reveal">
              <button className="st-btn-outline" onClick={() => { trackEvent('landing_cta_click', { cta: 'browse_entities' }); navigate('/entities'); }}>
                Browse {totalEntities.toLocaleString()}+ Entities <ArrowRight size={16} className="st-landing-cta-icon" />
              </button>
              <button className="st-btn" onClick={() => { trackEvent('landing_cta_click', { cta: 'explore_map' }); navigate('/jurisdictions'); }}>
                Explore Regulatory Map
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
            <h2>Regulatory Intelligence at Scale</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem', maxWidth: 540, margin: '8px auto 0', lineHeight: 1.6 }}>
              Structured data from 49+ regulatory registries, continuously updated. Built for compliance professionals who need accuracy and coverage.
            </p>
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

      {/* Early Access Banner */}
      <section className="st-landing-early-access">
        <div className="st-landing-container">
          <div className="st-landing-early-access-card clip-lg reveal">
            <div className="st-landing-ea-content">
              <div className="st-landing-ea-badge">
                <Zap size={14} />
                Beta Access Available
              </div>
              <h2>Get full platform access at early-bird pricing</h2>
              <p>
                Lock in founder pricing before public launch. One payment covers the entire beta period — including all future data sources and features.
              </p>
              <div className="st-landing-ea-price">
                <span className="st-landing-ea-old">€1,200/yr</span>
                <span className="st-landing-ea-current">€49</span>
                <span className="st-landing-ea-label">one-time</span>
              </div>
              <Link to="/pricing#pricing-card" className="st-btn" onClick={() => trackEvent('landing_cta_click', { cta: 'view_pricing' })}>
                View Pricing Details
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>

	      {/* Subscribe */}
	      <section className="st-landing-subscribe-section">
	        <div className="st-landing-container">
	          <div className="st-landing-subscribe clip-lg reveal">
	            <h2>Stay informed on regulatory developments</h2>
	            <p className="st-landing-subscribe-lede">
	              Weekly updates on new data sources, regulatory changes, and platform improvements.
	            </p>
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
                placeholder="Enter your work email"
                aria-label="Enter your work email"
                aria-invalid={subscribeError ? 'true' : 'false'}
                disabled={subscribeSent}
              />
              <button className="st-btn" type="submit" disabled={subscribeSent}>
                {subscribeSent ? 'Subscribed' : 'Get Updates'}
              </button>
            </form>
            <p aria-live="polite" className={`st-landing-subscribe-status${subscribeError ? ' is-error' : ''}${subscribeSent ? ' is-sent' : ''}`}>
              {subscribeError || (subscribeSent ? 'You\'re on the list. We\'ll keep you posted.' : '')}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
