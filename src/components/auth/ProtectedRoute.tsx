import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Shield, Database, Globe, FileCheck, ArrowRight } from 'lucide-react';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="st-page" style={{ paddingTop: 120, textAlign: 'center' }}>
        <div className="st-loading-pulse" />
      </div>
    );
  }

  if (!user) {
    return (
      <>
        {/* Blurred page content in background */}
        <div className="st-auth-blur" aria-hidden="true">
          {children}
        </div>

        {/* Registration overlay */}
        <div className="st-auth-overlay">
          <div className="st-auth-popup clip-lg">
            <div className="st-auth-popup-icon">
              <Shield size={32} />
            </div>
            <h2 className="st-auth-popup-title">Sign up for free access</h2>
            <p className="st-auth-popup-desc">
              Create a free account to unlock the full platform
            </p>

            <ul className="st-auth-popup-benefits">
              <li>
                <Database size={16} />
                <span>Full entity directory with 608+ licensed VASPs</span>
              </li>
              <li>
                <Globe size={16} />
                <span>Detailed jurisdiction profiles & regulator info</span>
              </li>
              <li>
                <FileCheck size={16} />
                <span>License type tracking & compliance status</span>
              </li>
              <li>
                <ArrowRight size={16} />
                <span>Travel rule implementation status worldwide</span>
              </li>
            </ul>

            <Link
              to="/signup"
              state={{ from: location.pathname }}
              className="st-auth-popup-cta"
            >
              Create Free Account
            </Link>

            <p className="st-auth-popup-signin">
              Already have an account?{' '}
              <Link to="/login" state={{ from: location.pathname }}>
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </>
    );
  }

  return <>{children}</>;
}
