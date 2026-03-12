import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useReveal } from '../hooks/useAnimations';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { trackEvent } from '../utils/analytics';
import { ArrowLeft, Mail } from 'lucide-react';

export default function ForgotPasswordPage() {
  useDocumentMeta({
    title: 'Forgot Password',
    description: 'Reset your RemiDe account password.',
    path: '/forgot-password',
  });
  const { resetPassword } = useAuth();
  const revealRef = useReveal();

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: err } = await resetPassword(email);
    setLoading(false);

    if (err) {
      setError(err);
    } else {
      setSent(true);
      trackEvent('password_reset_requested');
    }
  };

  return (
    <div ref={revealRef} className="st-page" style={{ paddingBottom: 80 }}>
      <div className="reveal" style={{ maxWidth: 440, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h2 style={{ fontFamily: 'var(--font2)', marginBottom: 8 }}>Reset Password</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem' }}>
            {sent
              ? 'Check your inbox for the reset link'
              : 'Enter your email and we\'ll send a reset link'}
          </p>
        </div>

        {sent ? (
          <div className="st-auth-form clip-lg" style={{ textAlign: 'center', padding: '40px 32px' }}>
            <Mail size={40} style={{ color: 'var(--accent)', marginBottom: 16 }} />
            <h4 style={{ marginBottom: 8 }}>Email Sent</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: 24 }}>
              We sent a password reset link to <strong>{email}</strong>.
              Check your inbox and click the link to set a new password.
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginBottom: 24 }}>
              Didn't receive it? Check your spam folder or{' '}
              <button
                type="button"
                onClick={() => { setSent(false); setError(''); }}
                style={{
                  background: 'none', border: 'none', padding: 0,
                  color: 'var(--black)', fontWeight: 600, cursor: 'pointer',
                  textDecoration: 'underline', fontSize: 'inherit',
                }}
              >
                try again
              </button>
            </p>
            <Link
              to="/login"
              className="st-btn"
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <ArrowLeft size={15} />
              Back to Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="st-auth-form clip-lg">
            {error && (
              <div className="st-auth-error">{error}</div>
            )}

            <div className="st-field">
              <label className="st-field-label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                className="st-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                autoComplete="email"
                autoFocus
              />
            </div>

            <button type="submit" className="st-btn" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>

            <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              <Link to="/login" style={{ color: 'var(--black)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <ArrowLeft size={14} />
                Back to Sign In
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
