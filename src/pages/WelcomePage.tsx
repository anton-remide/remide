import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Lock, ArrowRight, Star, Shield, Globe, Building2, Coins } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { usePaywall } from '../hooks/usePaywall';
import { useReveal } from '../hooks/useAnimations';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { trackEvent } from '../utils/analytics';

const freeUnlocked = [
  { icon: Globe, text: 'Interactive regulatory map — 207 jurisdictions' },
  { icon: Building2, text: 'Entity names, activities & types — 14,000+ rows' },
  { icon: Coins, text: 'Stablecoin profiles, CBDCs, issuer data' },
];

const paidTeaser = [
  'License numbers & registry links',
  'Contract addresses (copy-ready)',
  'Issuer corporate structure & subsidiaries',
  'Global licenses & LEI codes',
  'Full entity data export',
];

export default function WelcomePage() {
  const { user } = useAuth();
  const { isPaid, loading: paywallLoading } = usePaywall();
  const navigate = useNavigate();
  const revealRef = useReveal();

  useDocumentMeta({
    title: 'Welcome — RemiDe',
    description: 'Welcome to RemiDe. Explore stablecoin regulatory intelligence across 207 jurisdictions.',
    path: '/welcome',
  });

  useEffect(() => {
    // If not logged in, send to signup
    if (!user) {
      navigate('/signup', { replace: true });
      return;
    }
    // Wait for paywall tier to resolve before deciding
    if (paywallLoading) return;
    // Paid users skip welcome — straight to product
    if (isPaid) {
      localStorage.setItem('remide_welcome_shown', '1');
      navigate('/jurisdictions', { replace: true });
      return;
    }
    trackEvent('welcome_page_view');
    localStorage.setItem('remide_welcome_shown', '1');
  }, [user, isPaid, paywallLoading, navigate]);

  // Show nothing while loading tier or if redirecting
  if (!user || paywallLoading || isPaid) return null;

  const firstName = user.user_metadata?.first_name || '';

  return (
    <div ref={revealRef} className="st-page" style={{ paddingBottom: 80 }}>
      <div className="reveal" style={{ maxWidth: 640, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
          <h2 style={{ fontFamily: 'var(--font2)', marginBottom: 8 }}>
            {firstName ? `Welcome, ${firstName}!` : 'Welcome to RemiDe!'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem', lineHeight: 1.6, maxWidth: 480, margin: '0 auto' }}>
            Your free account is active. Here's what you can explore right now.
          </p>
        </div>

        {/* What's unlocked */}
        <div className="st-card clip-lg reveal" style={{ padding: '24px 28px', marginBottom: 20 }}>
          <h6 className="st-section-label" style={{ marginBottom: 16, color: 'var(--color-success)' }}>
            <Check size={14} style={{ marginRight: 4 }} />
            Unlocked with your free account
          </h6>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {freeUnlocked.map(({ icon: Icon, text }) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: 'var(--bg-light)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Icon size={18} style={{ color: 'var(--text)' }} />
                </div>
                <span style={{ fontSize: '0.9375rem', color: 'var(--text)' }}>{text}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 20, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link to="/jurisdictions" className="st-btn st-btn-sm" style={{ flex: 1 }}>
              <Globe size={14} />
              Explore Map
            </Link>
            <Link to="/entities" className="st-btn st-btn-sm st-btn-outline" style={{ flex: 1 }}>
              <Building2 size={14} />
              Browse Entities
            </Link>
          </div>
        </div>

        {/* Upgrade CTA */}
        <div className="st-card clip-lg reveal" style={{
          padding: '28px',
          marginBottom: 24,
          background: 'linear-gradient(135deg, var(--color-surface), var(--color-bg))',
          border: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Star size={16} style={{ color: 'var(--accent)' }} />
            <span style={{ fontFamily: 'var(--font2)', fontWeight: 700, fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Full Access — Beta Pricing
            </span>
          </div>

          <h3 style={{ fontFamily: 'var(--font2)', margin: '0 0 6px', fontSize: '1.25rem' }}>
            Unlock everything for €49
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', margin: '0 0 16px', lineHeight: 1.5 }}>
            <span style={{ textDecoration: 'line-through' }}>€1,200/yr</span>{' '}
            <strong style={{ color: 'var(--accent)' }}>96% off</strong> — one-time, lifetime access.
          </p>

          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {paidTeaser.map((f) => (
              <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                <Lock size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                {f}
              </li>
            ))}
          </ul>

          <Link
            to="/pricing"
            className="st-btn"
            style={{ width: '100%' }}
            onClick={() => trackEvent('welcome_upgrade_click')}
          >
            View Pricing
            <ArrowRight size={16} />
          </Link>

          <p style={{ textAlign: 'center', marginTop: 10, fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <Shield size={11} />
            14-day money-back guarantee
          </p>
        </div>

        {/* Skip link */}
        <div style={{ textAlign: 'center' }}>
          <Link
            to="/"
            style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', textDecoration: 'underline' }}
            onClick={() => trackEvent('welcome_skip_click')}
          >
            Skip — go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
