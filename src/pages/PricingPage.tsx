import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Zap, Clock, Star, ArrowRight, Check, X, Lock,
  Gift, Bell, TrendingUp, BarChart3,
} from 'lucide-react';
import { useReveal } from '../hooks/useAnimations';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useAuth } from '../hooks/useAuth';
import { trackEvent } from '../utils/analytics';

/* Countdown hook */
function useCountdown(targetDate: Date) {
  const [timeLeft, setTimeLeft] = useState(getTimeLeft(targetDate));
  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(getTimeLeft(targetDate)), 60_000);
    return () => clearInterval(timer);
  }, [targetDate]);
  return timeLeft;
}

function getTimeLeft(target: Date) {
  const diff = Math.max(0, target.getTime() - Date.now());
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
  };
}

export default function PricingPage() {
  useDocumentMeta({
    title: 'Early Access Pricing',
    description: 'Get early access to the most comprehensive stablecoin regulatory intelligence platform. Lock in founder pricing at $49.',
    path: '/pricing',
  });

  const { user } = useAuth();

  useEffect(() => {
    trackEvent('pricing_page_view');
  }, []);

  const revealRef = useReveal();

  // Early-bird deadline: 14 days from first visit (session-cached)
  const [deadline] = useState(() => {
    const stored = sessionStorage.getItem('remide_eb_deadline');
    if (stored) return new Date(stored);
    const d = new Date();
    d.setDate(d.getDate() + 14);
    sessionStorage.setItem('remide_eb_deadline', d.toISOString());
    return d;
  });
  const countdown = useCountdown(deadline);

  const faqs = [
    { q: 'What happens after the beta period?', a: 'When we launch the full version (projected Q3 2026), early supporters will receive a significant discount on annual subscriptions. Your $49 beta access covers the entire beta period.' },
    { q: 'How often is the data updated?', a: 'We run automated parsers across 49+ regulatory registries weekly. Major regulatory changes are reflected within 48 hours.' },
    { q: 'Who is this for?', a: 'Compliance officers, legal counsel, regulatory affairs teams, and policy professionals working with stablecoins, digital assets, or cross-border payments.' },
    { q: 'Can I get a refund?', a: 'Yes. If you\'re not satisfied within 14 days, we\'ll refund your purchase — no questions asked.' },
  ];

  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div ref={revealRef} className="st-pricing-page">
      {/* Urgency Banner */}
      <div className="st-pricing-urgency-banner">
        <Clock size={16} />
        <span>
          Early-bird pricing closes in{' '}
          <strong>{countdown.days} days, {countdown.hours} hours, {countdown.minutes} minutes</strong>
        </span>
      </div>

      {/* Hero */}
      <section className="st-pricing-hero reveal">
        <div className="st-pricing-container">
          <div className="st-pricing-hero-badge">
            <Zap size={14} />
            Limited Beta Access
          </div>
          <h1 className="st-pricing-hero-title">
            The Regulatory Intelligence<br />
            Platform Built for Stablecoin<br />
            Compliance Teams
          </h1>
          <p className="st-pricing-hero-desc">
            Stop spending hundreds of hours manually tracking crypto regulations.
            Get comprehensive, structured data on stablecoin licensing frameworks,
            entity registries, and Travel Rule compliance — all in one place.
          </p>
        </div>
      </section>

      {/* Pricing Card */}
      <section className="st-pricing-card-section">
        <div className="st-pricing-container">
          <div className="st-pricing-card clip-lg reveal">
            <div className="st-pricing-card-header">
              <div className="st-pricing-card-badge">
                <Star size={14} />
                Founder Pricing
              </div>
              <div className="st-pricing-card-price">
                <span className="st-pricing-card-old-price">$1,200/yr</span>
                <div className="st-pricing-card-current-price">
                  <span className="st-pricing-price-amount">$49</span>
                  <span className="st-pricing-price-label">one-time beta access</span>
                </div>
              </div>
              <p className="st-pricing-card-savings">
                That's <strong>96% off</strong> the planned annual subscription.
                Early supporters lock in this rate permanently.
              </p>
            </div>

            <div className="st-pricing-card-cta-wrap">
              {user ? (
                <span className="st-pricing-card-cta" style={{ opacity: 0.6, cursor: 'default' }}>
                  Checkout Coming Soon
                </span>
              ) : (
                <Link to="/signup" className="st-pricing-card-cta" onClick={() => trackEvent('pricing_cta_click', { location: 'card' })}>
                  Get Early Access Now
                  <ArrowRight size={18} />
                </Link>
              )}
              <p className="st-pricing-card-guarantee">
                <Lock size={14} />
                14-day money-back guarantee — no questions asked
              </p>
            </div>

            {/* Stats row */}
            <div className="st-pricing-stats-row">
              <div className="st-pricing-stat">
                <strong>206</strong>
                <span>Jurisdictions</span>
              </div>
              <div className="st-pricing-stat">
                <strong>14,000+</strong>
                <span>Entities</span>
              </div>
              <div className="st-pricing-stat">
                <strong>70+</strong>
                <span>Stablecoins</span>
              </div>
              <div className="st-pricing-stat">
                <strong>49</strong>
                <span>Data Sources</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Three-Tier Comparison */}
      <section className="st-pricing-comparison">
        <div className="st-pricing-container">
          <h2 className="st-pricing-section-title reveal">Choose Your Access Level</h2>
          <p className="st-pricing-section-desc reveal">
            Start free. Upgrade when you need deeper insights.
          </p>
          <div className="st-pricing-comparison-table clip-lg reveal">
            <table>
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Anonymous</th>
                  <th>Registered <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 400, color: 'var(--text-muted)' }}>Free</span></th>
                  <th className="st-pricing-col-highlight">Full Access <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 400 }}>$49</span></th>
                </tr>
              </thead>
              <tbody>
                {([
                  { feature: 'Interactive regulatory map', anon: true, reg: true, paid: true },
                  { feature: 'Jurisdiction overview (regime, Travel Rule)', anon: true, reg: true, paid: true },
                  { feature: 'Entity name & status (blurred)', anon: 'partial' as const, reg: true, paid: true },
                  { feature: 'Stablecoin basic info', anon: 'partial' as const, reg: true, paid: true },
                  { feature: 'Jurisdiction stablecoin laws & events', anon: false, reg: true, paid: true },
                  { feature: 'Entity activities & types', anon: false, reg: true, paid: true },
                  { feature: 'CBDC features & cross-border projects', anon: false, reg: true, paid: true },
                  { feature: 'Stablecoin blockchain deployments', anon: false, reg: true, paid: true },
                  { feature: 'Issuers — stablecoins issued list', anon: false, reg: true, paid: true },
                  { feature: 'Entity license numbers & registry links', anon: false, reg: false, paid: true },
                  { feature: 'Contract addresses (copy-ready)', anon: false, reg: false, paid: true },
                  { feature: 'Issuer corporate structure & subsidiaries', anon: false, reg: false, paid: true },
                  { feature: 'Issuer global licenses & LEI codes', anon: false, reg: false, paid: true },
                  { feature: 'Related entities per jurisdiction', anon: false, reg: false, paid: true },
                  { feature: 'Full entity table (14,000+ rows)', anon: false, reg: false, paid: true },
                ] as { feature: string; anon: boolean | 'partial'; reg: boolean; paid: boolean }[]).map((row) => (
                  <tr key={row.feature}>
                    <td>{row.feature}</td>
                    <td className="st-pricing-check-cell">
                      {row.anon === 'partial' ? <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Blurred</span> : row.anon ? <Check size={16} className="st-pricing-check-yes" /> : <X size={16} className="st-pricing-check-no" />}
                    </td>
                    <td className="st-pricing-check-cell">
                      {row.reg ? <Check size={16} className="st-pricing-check-yes" /> : <X size={16} className="st-pricing-check-no" />}
                    </td>
                    <td className="st-pricing-check-cell st-pricing-col-highlight">
                      {row.paid ? <Check size={16} className="st-pricing-check-yes" /> : <X size={16} className="st-pricing-check-no" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="reveal" style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24, flexWrap: 'wrap' }}>
            {user ? (
              <span className="st-btn" style={{ background: 'var(--bg-light)', color: 'var(--text-muted)', cursor: 'default' }}>
                <Check size={14} /> Registered
              </span>
            ) : (
              <Link to="/signup" className="st-btn" style={{ background: 'var(--bg-light)', color: 'var(--black)' }} onClick={() => trackEvent('pricing_register_click')}>
                Register Free
              </Link>
            )}
            {user ? (
              <span className="st-btn" style={{ opacity: 0.6, cursor: 'default' }}>
                Checkout Coming Soon
              </span>
            ) : (
              <Link to="/signup" className="st-btn" onClick={() => trackEvent('pricing_cta_click', { location: 'comparison' })}>
                Get Full Access — $49
                <ArrowRight size={16} />
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Early Founding Users */}
      <section className="st-pricing-early-section">
        <div className="st-pricing-container">
          <div className="st-pricing-early-card clip-lg reveal">
            <div className="st-pricing-early-icon">
              <Gift size={24} />
            </div>
            <h2 className="st-pricing-section-title">Early Founding Users</h2>
            <p className="st-pricing-section-desc" style={{ marginBottom: 24 }}>
              Register now and get free access to all upcoming features as they launch:
            </p>
            <div className="st-pricing-early-grid">
              {([
                { icon: Bell, title: 'Regulatory Alerts', desc: 'Real-time notifications when regulations change in jurisdictions you follow' },
                { icon: Zap, title: 'Entity & License Updates', desc: 'Instant alerts when new entities are licensed or existing ones change status' },
                { icon: BarChart3, title: 'Market Statistics', desc: 'Stablecoin market analytics, issuance trends, and regulatory adoption data' },
                { icon: TrendingUp, title: 'Personal Trends', desc: 'Custom watchlists, saved searches, and personalized compliance dashboards' },
              ] as const).map(({ icon: Icon, title, desc }) => (
                <div key={title} className="st-pricing-early-item">
                  <Icon size={20} className="st-pricing-early-item-icon" />
                  <div>
                    <strong>{title}</strong>
                    <p>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            {user ? (
              <span className="st-btn" style={{ marginTop: 24, background: 'var(--bg-light)', color: 'var(--text-muted)', cursor: 'default' }}>
                <Check size={14} /> You're an Early User
              </span>
            ) : (
              <Link to="/signup" className="st-btn" style={{ marginTop: 24 }} onClick={() => trackEvent('pricing_cta_click', { location: 'early_users' })}>
                Register Now — It's Free
                <ArrowRight size={16} />
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="st-pricing-faq">
        <div className="st-pricing-container">
          <h2 className="st-pricing-section-title reveal">Frequently Asked Questions</h2>
          <div className="st-pricing-faq-list reveal">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className={`st-pricing-faq-item clip-lg${openFaq === i ? ' is-open' : ''}`}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenFaq(openFaq === i ? null : i); } }}
                role="button"
                tabIndex={0}
                aria-expanded={openFaq === i}
              >
                <div className="st-pricing-faq-q">
                  <span>{faq.q}</span>
                  <ArrowRight size={16} className="st-pricing-faq-chevron" />
                </div>
                {openFaq === i && (
                  <div className="st-pricing-faq-a">
                    <p>{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="st-pricing-final-cta">
        <div className="st-pricing-container reveal">
          <h2>Ready to get started?</h2>
          <p>
            Join during beta and lock in founder pricing.
            Full platform access, all future updates, 14-day money-back guarantee.
          </p>
          {user ? (
            <span className="st-pricing-card-cta" style={{ maxWidth: 360, margin: '0 auto', opacity: 0.6, cursor: 'default' }}>
              Checkout Coming Soon
            </span>
          ) : (
            <Link to="/signup" className="st-pricing-card-cta" style={{ maxWidth: 360, margin: '0 auto' }} onClick={() => trackEvent('pricing_cta_click', { location: 'footer' })}>
              Get Early Access — $49
              <ArrowRight size={18} />
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
