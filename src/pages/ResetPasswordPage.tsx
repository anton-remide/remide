import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useReveal } from '../hooks/useAnimations';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { trackEvent } from '../utils/analytics';
import { CheckCircle } from 'lucide-react';

export default function ResetPasswordPage() {
  useDocumentMeta({
    title: 'Set New Password',
    description: 'Set a new password for your RemiDe account.',
    path: '/reset-password',
  });
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const revealRef = useReveal();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    const { error: err } = await updatePassword(password);
    setLoading(false);

    if (err) {
      setError(err);
    } else {
      setSuccess(true);
      trackEvent('password_reset_completed');
      // Redirect to product after 2s
      setTimeout(() => navigate('/jurisdictions', { replace: true }), 2000);
    }
  };

  return (
    <div ref={revealRef} className="st-page" style={{ paddingBottom: 80 }}>
      <div className="reveal" style={{ maxWidth: 440, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h2 style={{ fontFamily: 'var(--font2)', marginBottom: 8 }}>
            {success ? 'Password Updated' : 'Set New Password'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem' }}>
            {success
              ? 'You\'re all set — redirecting you now...'
              : 'Choose a new password for your account'}
          </p>
        </div>

        {success ? (
          <div className="st-auth-form clip-lg" style={{ textAlign: 'center', padding: '40px 32px' }}>
            <CheckCircle size={40} style={{ color: 'var(--color-success)', marginBottom: 16 }} />
            <h4 style={{ marginBottom: 8 }}>All done!</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.6 }}>
              Your password has been updated. Redirecting...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="st-auth-form clip-lg">
            {error && (
              <div className="st-auth-error">{error}</div>
            )}

            <div className="st-field">
              <label className="st-field-label" htmlFor="password">New Password</label>
              <input
                id="password"
                type="password"
                className="st-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="new-password"
                minLength={8}
                autoFocus
              />
            </div>

            <div className="st-field">
              <label className="st-field-label" htmlFor="confirm">Confirm Password</label>
              <input
                id="confirm"
                type="password"
                className="st-input"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="new-password"
                minLength={8}
              />
            </div>

            <button type="submit" className="st-btn" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
              {loading ? 'Updating...' : 'Update Password'}
            </button>

            <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              <Link to="/login" style={{ color: 'var(--black)', fontWeight: 600 }}>
                Back to Sign In
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
