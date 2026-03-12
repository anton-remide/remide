import type { ComponentType, FormEvent, SVGProps } from 'react';
import { useState, useEffect } from 'react';
import { Scale, BookOpen, Search, ArrowRight, Coins, Zap, TrendingUp, Shield } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { getJurisdictions, getEntityCount, getStablecoins, getCbdcs } from '../data/dataLoader';
import { useReveal, useStaggerReveal, useCounter } from '../hooks/useAnimations';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { trackEvent } from '../utils/analytics';
import HeroWorldMapCanvas from '../components/ui/HeroWorldMapCanvas';

type StatIconComponent = ComponentType<SVGProps<SVGSVGElement>>;

function GlobeStatIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" {...props}>
      <path d="M8 14.6667C11.6819 14.6667 14.6667 11.6819 14.6667 8C14.6667 4.3181 11.6819 1.33333 8 1.33333C4.3181 1.33333 1.33333 4.3181 1.33333 8C1.33333 11.6819 4.3181 14.6667 8 14.6667Z" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 1.33333C6.28816 3.13077 5.33333 5.51783 5.33333 8C5.33333 10.4822 6.28816 12.8692 8 14.6667C9.71184 12.8692 10.6667 10.4822 10.6667 8C10.6667 5.51783 9.71184 3.13077 8 1.33333Z" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M1.33333 8H14.6667" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EntityStatIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" {...props}>
      <path d="M6.66667 8H9.33333" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.66667 5.33333H9.33333" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.33333 14V12C9.33333 11.6464 9.19286 11.3072 8.94281 11.0572C8.69276 10.8071 8.35362 10.6667 8 10.6667C7.64638 10.6667 7.30724 10.8071 7.05719 11.0572C6.80714 11.3072 6.66667 11.6464 6.66667 12V14" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 6.66667H2.66667C2.31304 6.66667 1.97391 6.80714 1.72386 7.05719C1.47381 7.30724 1.33333 7.64638 1.33333 8V12.6667C1.33333 13.0203 1.47381 13.3594 1.72386 13.6095C1.97391 13.8595 2.31304 14 2.66667 14H13.3333C13.687 14 14.0261 13.8595 14.2761 13.6095C14.5262 13.3594 14.6667 13.0203 14.6667 12.6667V6C14.6667 5.64638 14.5262 5.30724 14.2761 5.05719C14.0261 4.80714 13.687 4.66667 13.3333 4.66667H12" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 14V3.33333C4 2.97971 4.14048 2.64057 4.39052 2.39052C4.64057 2.14048 4.97971 2 5.33333 2H10.6667C11.0203 2 11.3594 2.14048 11.6095 2.39052C11.8595 2.64057 12 2.97971 12 3.33333V14" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StablecoinStatIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" {...props}>
      <path d="M9.16267 11.824C8.96254 12.4857 8.59431 13.0843 8.09391 13.5613C7.59352 14.0383 6.97803 14.3775 6.30748 14.5458C5.63693 14.714 4.93422 14.7056 4.26789 14.5214C3.60156 14.3371 2.99436 13.9833 2.50551 13.4945C2.01666 13.0056 1.66286 12.3984 1.47861 11.7321C1.29436 11.0658 1.28596 10.3631 1.45422 9.69252C1.62248 9.02197 1.96166 8.40648 2.43868 7.90609C2.9157 7.40569 3.51427 7.03746 4.176 6.83733" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 4H10.6667V6.66667" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.08933 9.84533L4.66667 9.512L6 11.8213" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.6667 9.33333C12.8758 9.33333 14.6667 7.54247 14.6667 5.33333C14.6667 3.12419 12.8758 1.33333 10.6667 1.33333C8.45753 1.33333 6.66667 3.12419 6.66667 5.33333C6.66667 7.54247 8.45753 9.33333 10.6667 9.33333Z" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CbdcStatIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" {...props}>
      <path d="M6.66667 12V7.33333" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.41333 1.46533C7.59626 1.37647 7.79709 1.33064 8.00046 1.33133C8.20383 1.33202 8.40435 1.37923 8.58667 1.46933L13.8307 4.034C14.148 4.18933 14.0373 4.66667 13.684 4.66667H2.316C1.96267 4.66667 1.85267 4.18933 2.16933 4.034L7.41333 1.46533Z" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.33333 12V7.33333" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 12V7.33333" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 14.6667H14" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 12V7.33333" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: StatIconComponent;
  label: string;
  value: number;
}) {
  const counterRef = useCounter(value);
  return (
    <div className="st-landing-stat-card stagger-in">
      <div className="st-landing-stat-row">
        <span className="st-landing-stat-value"><span ref={counterRef}>0</span></span>
        <div className="st-landing-stat-icon" aria-hidden="true">
          <Icon />
        </div>
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
    { icon: GlobeStatIcon, label: 'Jurisdictions Tracked', value: jurisdictions?.length ?? 0 },
    { icon: EntityStatIcon, label: 'Regulated Entities', value: totalEntities },
    { icon: StablecoinStatIcon, label: 'Stablecoins Monitored', value: totalStablecoins },
    { icon: CbdcStatIcon, label: 'CBDC Projects', value: totalCbdcs },
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
