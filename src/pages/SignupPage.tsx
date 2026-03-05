import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useReveal } from '../hooks/useAnimations';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

export default function SignupPage() {
  useDocumentMeta({
    title: 'Sign Up — Free Access',
    description: 'Create a free RemiDe account to access detailed crypto regulation data, jurisdiction reports, and entity profiles.',
    path: '/signup',
  });
  const { signUp, user } = useAuth();
  const navigate = useNavigate();
  const revealRef = useReveal();

  // If user gets auto-confirmed (email confirmation disabled), redirect
  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const [form, setForm] = useState({
    email: '',
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

    // Store extra fields in user_metadata + localStorage for callback
    const metadata = {
      first_name: form.firstName,
      last_name: form.lastName,
      business_email: form.businessEmail,
      phone: form.phone,
      role_title: form.roleTitle,
    };

    // Also persist to localStorage so AuthCallback can write to profiles
    localStorage.setItem('remide_signup_meta', JSON.stringify(metadata));

    const { error: err } = await signUp(form.email, form.password, metadata);
    setLoading(false);

    if (err) {
      setError(err);
    } else {
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
            We've sent a confirmation link to <strong style={{ color: 'var(--black)' }}>{form.email}</strong>.
            Click the link to activate your account and get access to the full platform.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={revealRef} className="st-page" style={{ paddingTop: 80, paddingBottom: 40 }}>
      <div className="reveal" style={{ maxWidth: 480, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <h2 style={{ fontFamily: 'var(--font2)', marginBottom: 8 }}>Create Account</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem' }}>
            Get full access to entity data and jurisdiction details
          </p>
        </div>

        <form onSubmit={handleSubmit} className="st-auth-form clip-lg">
          {error && (
            <div className="st-auth-error">{error}</div>
          )}

          <div className="row g-3">
            <div className="col-6">
              <div className="st-field">
                <label className="st-field-label" htmlFor="firstName">First Name</label>
                <input
                  id="firstName"
                  type="text"
                  className="st-input"
                  value={form.firstName}
                  onChange={set('firstName')}
                  placeholder="Jane"
                  required
                />
              </div>
            </div>
            <div className="col-6">
              <div className="st-field">
                <label className="st-field-label" htmlFor="lastName">Last Name</label>
                <input
                  id="lastName"
                  type="text"
                  className="st-input"
                  value={form.lastName}
                  onChange={set('lastName')}
                  placeholder="Doe"
                  required
                />
              </div>
            </div>
          </div>

          <div className="st-field">
            <label className="st-field-label" htmlFor="signupEmail">Email</label>
            <input
              id="signupEmail"
              type="email"
              className="st-input"
              value={form.email}
              onChange={set('email')}
              placeholder="you@company.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="st-field">
            <label className="st-field-label" htmlFor="signupPassword">Password</label>
            <input
              id="signupPassword"
              type="password"
              className="st-input"
              value={form.password}
              onChange={set('password')}
              placeholder="Min 8 characters"
              required
              autoComplete="new-password"
              minLength={8}
            />
          </div>

          <div className="st-field">
            <label className="st-field-label" htmlFor="businessEmail">Business Email</label>
            <input
              id="businessEmail"
              type="email"
              className="st-input"
              value={form.businessEmail}
              onChange={set('businessEmail')}
              placeholder="jane@company.com"
              required
            />
          </div>

          <div className="row g-3">
            <div className="col-6">
              <div className="st-field">
                <label className="st-field-label" htmlFor="phone">Phone Number</label>
                <input
                  id="phone"
                  type="tel"
                  className="st-input"
                  value={form.phone}
                  onChange={set('phone')}
                  placeholder="+1 555 0123"
                  required
                />
              </div>
            </div>
            <div className="col-6">
              <div className="st-field">
                <label className="st-field-label" htmlFor="roleTitle">Role Title</label>
                <input
                  id="roleTitle"
                  type="text"
                  className="st-input"
                  value={form.roleTitle}
                  onChange={set('roleTitle')}
                  placeholder="Compliance Officer"
                  required
                />
              </div>
            </div>
          </div>

          <button type="submit" className="st-btn" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--black)', fontWeight: 600 }}>Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
