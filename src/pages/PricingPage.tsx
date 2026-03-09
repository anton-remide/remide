import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Zap, Flame, ArrowRight, Check, X, Lock,
  Gift, Bell, TrendingUp, BarChart3,
} from 'lucide-react';
import { useReveal } from '../hooks/useAnimations';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useAuth } from '../hooks/useAuth';
import { usePaywall } from '../hooks/usePaywall';
import { redirectToCheckout } from '../lib/stripe';
import { trackEvent } from '../utils/analytics';

/* Countdown hook */
function useCountdown(targetDate: Date) {
  const [timeLeft, setTimeLeft] = useState(getTimeLeft(targetDate));
  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(getTimeLeft(targetDate)), 1_000);
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
    seconds: Math.floor((diff % 60_000) / 1_000),
  };
}

export default function PricingPage() {
  useDocumentMeta({
    title: 'Early Access Pricing',
    description: 'Get early access to the most comprehensive stablecoin regulatory intelligence platform. Lock in founder pricing at €49.',
    path: '/pricing',
  });

  const { user } = useAuth();
  const { isPaid, refresh: refreshTier } = usePaywall();
  const [searchParams] = useSearchParams();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  // Handle Stripe redirect back (?success=true or ?canceled=true)
  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      refreshTier();
      trackEvent('payment_completed');
    }
    if (searchParams.get('canceled') === 'true') {
      trackEvent('payment_canceled');
    }
  }, [searchParams, refreshTier]);

  useEffect(() => {
    trackEvent('pricing_page_view');
  }, []);

  const handleCheckout = async () => {
    setCheckoutError('');
    setCheckoutLoading(true);
    trackEvent('pricing_checkout_click');
    const { error } = await redirectToCheckout();
    if (error) {
      setCheckoutError(error);
      setCheckoutLoading(false);
    }
    // If no error, user is being redirected to Stripe — don't reset loading
  };

  const revealRef = useReveal();

  // Founder pricing deadline: Friday 13 March 2026, 23:59 CET (UTC+1)
  const deadline = new Date('2026-03-13T22:59:00Z');
  const countdown = useCountdown(deadline);

  const faqs = [
    { q: 'What happens after the beta period?', a: 'When we launch the full version (projected Q3 2026), early supporters will receive a significant discount on annual subscriptions. Your €49 beta access covers the entire beta period.' },
    { q: 'How often is the data updated?', a: 'We run automated parsers across 49+ regulatory registries weekly. Major regulatory changes are reflected within 48 hours.' },
    { q: 'Who is this for?', a: 'Compliance officers, legal counsel, regulatory affairs teams, and policy professionals working with stablecoins, digital assets, or cross-border payments.' },
    { q: 'Can I get a refund?', a: 'Yes. If you\'re not satisfied within 14 days, we\'ll refund your purchase — no questions asked.' },
  ];

  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div ref={revealRef} className="st-pricing-page">
      {/* Payment Success Banner */}
      {searchParams.get('success') === 'true' && (
        <div style={{
          background: '#16a34a', color: '#fff', textAlign: 'center',
          padding: '12px 20px', fontSize: '0.9375rem', fontWeight: 600,
        }}>
          <Check size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Payment successful! You now have full access to all features.
        </div>
      )}
      {searchParams.get('canceled') === 'true' && (
        <div style={{
          background: '#f59e0b', color: '#000', textAlign: 'center',
          padding: '12px 20px', fontSize: '0.9375rem',
        }}>
          Payment was canceled. You can try again anytime.
        </div>
      )}

      {/* Hero */}
      <section className="st-pricing-hero reveal">
        <div className="st-pricing-container">
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

      {/* Urgency Banner */}
      <section className="st-pricing-card-section">
        <div className="st-pricing-container">
          <div className="st-pricing-urgency-banner">
            <div className="st-urgency-inner">
              <div className="st-urgency-label">
                <Flame size={14} />
                <span>Founder pricing ends in</span>
              </div>
              <div className="st-urgency-countdown">
                <div className="st-urgency-unit">
                  <span className="st-urgency-num">{String(countdown.days).padStart(2, '0')}</span>
                  <span className="st-urgency-txt">days</span>
                </div>
                <span className="st-urgency-sep">:</span>
                <div className="st-urgency-unit">
                  <span className="st-urgency-num">{String(countdown.hours).padStart(2, '0')}</span>
                  <span className="st-urgency-txt">hrs</span>
                </div>
                <span className="st-urgency-sep">:</span>
                <div className="st-urgency-unit">
                  <span className="st-urgency-num">{String(countdown.minutes).padStart(2, '0')}</span>
                  <span className="st-urgency-txt">min</span>
                </div>
                <span className="st-urgency-sep">:</span>
                <div className="st-urgency-unit">
                  <span className="st-urgency-num">{String(countdown.seconds).padStart(2, '0')}</span>
                  <span className="st-urgency-txt">sec</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Card */}
      <section className="st-pricing-card-section">
        <div className="st-pricing-container">
          <div className="st-pricing-card clip-lg reveal">
            <div className="st-pricing-card-header">
              <div className="st-pricing-card-badge">
                <Flame size={14} />
                Founder Pricing
              </div>
              <div className="st-pricing-card-price">
                <span className="st-pricing-card-old-price">€1,200/yr</span>
                <div className="st-pricing-card-current-price">
                  <span className="st-pricing-price-amount">€49</span>
                  <span className="st-pricing-price-label">one-time beta access</span>
                </div>
              </div>
              <p className="st-pricing-card-savings">
                That's <strong>96% off</strong> the planned annual subscription.
                Early supporters lock in this rate permanently.
              </p>
            </div>

            <div className="st-pricing-card-cta-wrap">
              {checkoutError && (
                <div style={{ color: '#dc2626', fontSize: '0.8125rem', marginBottom: 8, textAlign: 'center' }}>{checkoutError}</div>
              )}
              {isPaid ? (
                <span className="st-pricing-card-cta" style={{ background: '#16a34a', cursor: 'default' }}>
                  <Check size={18} />
                  Full Access Unlocked
                </span>
              ) : user ? (
                <button
                  className="st-pricing-card-cta"
                  style={{ border: 'none', cursor: checkoutLoading ? 'wait' : 'pointer' }}
                  onClick={handleCheckout}
                  disabled={checkoutLoading}
                >
                  {checkoutLoading ? 'Redirecting to checkout...' : 'Get Full Access — €49'}
                  {!checkoutLoading && <ArrowRight size={18} />}
                </button>
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
                  <th className="st-pricing-col-highlight">Full Access <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 400 }}>€49</span></th>
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
            {isPaid ? (
              <span className="st-btn" style={{ background: '#16a34a', color: '#fff', cursor: 'default' }}>
                <Check size={14} /> Full Access
              </span>
            ) : user ? (
              <button
                className="st-btn"
                style={{ border: 'none', cursor: checkoutLoading ? 'wait' : 'pointer' }}
                onClick={handleCheckout}
                disabled={checkoutLoading}
              >
                {checkoutLoading ? 'Redirecting...' : 'Get Full Access — €49'}
                {!checkoutLoading && <ArrowRight size={16} />}
              </button>
            ) : (
              <Link to="/signup" className="st-btn" onClick={() => trackEvent('pricing_cta_click', { location: 'comparison' })}>
                Get Full Access — €49
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
            {user && !isPaid && (
              <button
                className="st-btn"
                style={{ marginTop: 8, border: 'none', cursor: checkoutLoading ? 'wait' : 'pointer' }}
                onClick={handleCheckout}
                disabled={checkoutLoading}
              >
                {checkoutLoading ? 'Redirecting...' : 'Upgrade to Full Access — €49'}
                <ArrowRight size={16} />
              </button>
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
          {isPaid ? (
            <span className="st-pricing-card-cta" style={{ maxWidth: 360, margin: '0 auto', background: '#16a34a', cursor: 'default' }}>
              <Check size={18} />
              Full Access Unlocked
            </span>
          ) : user ? (
            <button
              className="st-pricing-card-cta"
              style={{ maxWidth: 360, margin: '0 auto', border: 'none', cursor: checkoutLoading ? 'wait' : 'pointer' }}
              onClick={handleCheckout}
              disabled={checkoutLoading}
            >
              {checkoutLoading ? 'Redirecting to checkout...' : 'Get Full Access — €49'}
              {!checkoutLoading && <ArrowRight size={18} />}
            </button>
          ) : (
            <Link to="/signup" className="st-pricing-card-cta" style={{ maxWidth: 360, margin: '0 auto' }} onClick={() => trackEvent('pricing_cta_click', { location: 'footer' })}>
              Get Early Access — €49
              <ArrowRight size={18} />
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
