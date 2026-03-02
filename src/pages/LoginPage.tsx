import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useReveal } from '../hooks/useAnimations';

export default function LoginPage() {
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const revealRef = useReveal();

  const from = (location.state as { from?: string })?.from || '/';

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate(from, { replace: true });
    }
  }, [user, navigate, from]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: err } = await signIn(email, password);
    setLoading(false);

    if (err) {
      setError(err);
    } else {
      navigate(from, { replace: true });
    }
  };

  return (
    <div ref={revealRef} className="st-page" style={{ paddingTop: 80, paddingBottom: 80 }}>
      <div className="reveal" style={{ maxWidth: 440, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h2 style={{ fontFamily: 'var(--font2)', marginBottom: 8 }}>Sign In</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem' }}>
            Access entity data, jurisdiction details, and more
          </p>
        </div>

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
            />
          </div>

          <div className="st-field">
            <label className="st-field-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="st-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              minLength={8}
            />
          </div>

          <button type="submit" className="st-btn" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Don't have an account?{' '}
            <Link to="/signup" style={{ color: 'var(--black)', fontWeight: 600 }}>Create one</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
