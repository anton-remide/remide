import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Supabase automatically exchanges the token from the URL hash
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          setError(sessionError.message);
          return;
        }

        if (!session) {
          setError('No session found. Please try signing in again.');
          return;
        }

        // Write extra profile fields from localStorage (set during signup)
        const metaStr = localStorage.getItem('remide_signup_meta');
        if (metaStr) {
          try {
            const meta = JSON.parse(metaStr);
            await supabase.from('profiles').update({
              first_name: meta.first_name || '',
              last_name: meta.last_name || '',
              business_email: meta.business_email || '',
              phone: meta.phone || '',
              role_title: meta.role_title || '',
              updated_at: new Date().toISOString(),
            }).eq('id', session.user.id);

            localStorage.removeItem('remide_signup_meta');
          } catch {
            // Non-critical — profile can be updated later
            console.warn('Failed to update profile metadata');
          }
        }

        // Redirect to welcome page (first-time) or product (returning)
        const welcomed = localStorage.getItem('remide_welcome_shown');
        navigate(welcomed ? '/jurisdictions' : '/welcome', { replace: true });
      } catch {
        setError('An unexpected error occurred during confirmation.');
      }
    };

    handleCallback();
  }, [navigate]);

  if (error) {
    return (
      <div className="st-page" style={{ paddingTop: 120, textAlign: 'center' }}>
        <h4 style={{ marginBottom: 12 }}>Confirmation Error</h4>
        <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>{error}</p>
        <button className="st-btn" onClick={() => navigate('/login')}>
          Go to Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="st-page" style={{ paddingTop: 120, textAlign: 'center' }}>
      <div className="st-loading-pulse" />
      <p style={{ color: 'var(--text-muted)', marginTop: 16 }}>Confirming your account...</p>
    </div>
  );
}
