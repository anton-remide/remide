import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, ArrowRight, Lock, Star, Shield } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useReveal } from '../hooks/useAnimations';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { trackEvent } from '../utils/analytics';

const freeFeatures = [
  'Interactive regulatory map',
  'Jurisdiction profiles & Travel Rule',
  'Stablecoin laws & events',
  'Entity names, activities & types',
  'CBDC tracking',
  'Issuer profiles',
];

const paidFeatures = [
  'License numbers & registry links',
  'Contract addresses (copy-ready)',
  'Issuer corporate structure & subsidiaries',
  'Global licenses & LEI codes',
  'Full entity table (14,000+ rows)',
];


export default function SignupPage() {
  useDocumentMeta({
    title: 'Create Account — RemiDe',
    description: 'Create your RemiDe account to access stablecoin regulatory intelligence, licensed entity data, and compliance insights across 206 jurisdictions.',
    path: '/signup',
  });
  const { signUp, user } = useAuth();
  const navigate = useNavigate();
  const revealRef = useReveal();

  useEffect(() => {
    trackEvent('signup_page_view');
  }, []);

  useEffect(() => {
    if (user) {
      const welcomed = localStorage.getItem('remide_welcome_shown');
      navigate(welcomed ? '/pricing' : '/welcome', { replace: true });
    }
  }, [user, navigate]);

  const [form, setForm] = useState({
    password: '',
    firstName: '',
    lastName: '',
    businessEmail: '',
    phone: '',
    roleTitle: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const metadata = {
      first_name: form.firstName,
      last_name: form.lastName,
      business_email: form.businessEmail,
      phone: form.phone,
      role_title: form.roleTitle,
    };

    localStorage.setItem('remide_signup_meta', JSON.stringify(metadata));

    const { error: err } = await signUp(form.businessEmail, form.password, metadata);
    setLoading(false);

    if (err) {
      setError(err);
    } else {
      trackEvent('signup_completed', { email: form.businessEmail });
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <div ref={revealRef} className="st-page" style={{ paddingTop: 120, paddingBottom: 80 }}>
        <div className="reveal" style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 24 }}>📧</div>
          <h3 style={{ fontFamily: 'var(--font2)', marginBottom: 12 }}>Check your email</h3>
          <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, fontSize: '0.9375rem' }}>
            We've sent a confirmation link to <strong style={{ color: 'var(--black)' }}>{form.businessEmail}</strong>.
            Click the link to activate your account and get access to the full platform.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={revealRef} className="st-page" style={{ paddingBottom: 40 }}>
      <div className="reveal st-signup-layout">
        {/* Left: Hero tagline + Value cards */}
        <div className="st-signup-offers">
          {/* Hero tagline — inside left column */}
          <div className="st-signup-hero">
            <h2 style={{ fontFamily: 'var(--font2)', margin: '0 0 8px', fontSize: '1.5rem', lineHeight: 1.25 }}>
              Stablecoin Regulatory Intelligence
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem', margin: 0, lineHeight: 1.5 }}>
              Track licensing frameworks, entity registries, and compliance status across <strong style={{ color: 'var(--black)' }}>207 jurisdictions</strong>. Built for compliance teams.
            </p>
          </div>

          {/* 1. Free — Instant Unlock */}
          <div className="st-signup-offer-card st-signup-offer-free">
            <h4 className="st-signup-offer-title">
              <Check size={16} style={{ color: '#16a34a' }} />
              Instant Unlock with Registration
            </h4>
            <ul className="st-signup-offer-list">
              {freeFeatures.map((f) => (
                <li key={f}><Check size={13} />{f}</li>
              ))}
            </ul>
          </div>

          {/* 2. Paid — €49 special offer */}
          <div className="st-signup-offer-card st-signup-offer-paid">
            <div className="st-signup-offer-badge">
              <Star size={12} />
              Beta Pricing
            </div>
            <h4 className="st-signup-offer-title">
              <Lock size={16} style={{ color: 'var(--accent)' }} />
              Full Access — €49
            </h4>
            <p className="st-signup-offer-desc">
              <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)', fontSize: '0.75rem' }}>€1,200/yr</span>{' '}
              <strong style={{ color: 'var(--accent)' }}>96% off</strong>{' '}
              <span style={{ fontSize: '0.75rem' }}>· one-time · forever</span>
            </p>
            <p className="st-signup-offer-includes">Everything in Free, plus:</p>
            <ul className="st-signup-offer-list">
              {paidFeatures.map((f) => (
                <li key={f}><Check size={13} />{f}</li>
              ))}
            </ul>
            <Link
              to="/pricing"
              className="st-btn st-btn-sm"
              style={{ width: '100%', marginTop: 12 }}
              onClick={() => trackEvent('signup_pricing_click')}
            >
              See Full Comparison
              <ArrowRight size={14} />
            </Link>
            <p className="st-signup-offer-guarantee">
              <Shield size={11} />
              14-day money-back guarantee
            </p>
          </div>

        </div>

        {/* Right: Form */}
        <div className="st-signup-form-wrap">
          <form onSubmit={handleSubmit} className="st-auth-form st-auth-form-compact clip-lg">
            <h3 style={{ fontFamily: 'var(--font2)', margin: '0 0 4px' }}>
              Create Free Account
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', margin: '0 0 16px', lineHeight: 1.4 }}>
              Instant access — no credit card required
            </p>

            {error && (
              <div className="st-auth-error">{error}</div>
            )}

            <div className="st-form-grid st-form-grid--2 st-form-grid--1-mobile">
              <div>
                <div className="st-field">
                  <label className="st-field-label" htmlFor="firstName">First Name</label>
                  <input id="firstName" type="text" className="st-input" value={form.firstName} onChange={set('firstName')} placeholder="Jane" required />
                </div>
              </div>
              <div>
                <div className="st-field">
                  <label className="st-field-label" htmlFor="lastName">Last Name</label>
                  <input id="lastName" type="text" className="st-input" value={form.lastName} onChange={set('lastName')} placeholder="Doe" required />
                </div>
              </div>
            </div>

            <div className="st-field">
              <label className="st-field-label" htmlFor="businessEmail">Business Email</label>
              <input id="businessEmail" type="email" className="st-input" value={form.businessEmail} onChange={set('businessEmail')} placeholder="jane@company.com" required autoComplete="email" />
            </div>

            <div className="st-form-grid st-form-grid--2 st-form-grid--1-mobile">
              <div>
                <div className="st-field">
                  <label className="st-field-label" htmlFor="phone">Phone</label>
                  <input id="phone" type="tel" className="st-input" value={form.phone} onChange={set('phone')} placeholder="+1 555 0123" required />
                </div>
              </div>
              <div>
                <div className="st-field">
                  <label className="st-field-label" htmlFor="roleTitle">Role</label>
                  <input id="roleTitle" type="text" className="st-input" value={form.roleTitle} onChange={set('roleTitle')} placeholder="Compliance Officer" required />
                </div>
              </div>
            </div>

            <div className="st-field">
              <label className="st-field-label" htmlFor="signupPassword">Password</label>
              <input id="signupPassword" type="password" className="st-input" value={form.password} onChange={set('password')} placeholder="Min 8 characters" required autoComplete="new-password" minLength={8} />
            </div>

            <button type="submit" className="st-btn" style={{ width: '100%', marginTop: 4 }} disabled={loading}>
              {loading ? 'Creating account...' : 'Create Free Account'}
            </button>

            <div className="st-signup-form-trust">
              <span><Shield size={11} /> No credit card</span>
              <span><Check size={11} /> Instant access</span>
            </div>

            <p style={{ textAlign: 'center', marginTop: 12, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Already have an account?{' '}
              <Link to="/login" style={{ color: 'var(--black)', fontWeight: 600 }}>Sign in</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
