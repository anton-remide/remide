import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  ArrowRight, Zap, CheckCircle2, Clock, Star,
  BarChart3, Users, BookOpen,
} from 'lucide-react';

/* Countdown hook — calculates days/hours/minutes until a target date */
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

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Founder pricing deadline: Friday 13 March 2026, 23:59 CET (UTC+1)
  const [deadline] = useState(() => {
    return new Date('2026-03-13T22:59:00Z');
  });
  const countdown = useCountdown(deadline);

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

        {/* Conversion overlay — AppSumo-style early-access offer */}
        <div className="st-auth-overlay">
          <div className="st-paywall clip-lg">
            {/* Urgency bar */}
            <div className="st-paywall-urgency">
              <Clock size={14} />
              <span>Early-bird pricing ends in <strong>{countdown.days}d {countdown.hours}h {countdown.minutes}m</strong></span>
            </div>

            {/* Header */}
            <div className="st-paywall-header">
              <div className="st-paywall-badge">
                <Zap size={14} />
                Beta Access
              </div>
              <h2 className="st-paywall-title">
                Unlock the Full<br />Intelligence Platform
              </h2>
              <p className="st-paywall-subtitle">
                The only regulatory tracker purpose-built for stablecoin compliance teams.
                Join early and lock in founder pricing.
              </p>
            </div>

            {/* Pricing */}
            <div className="st-paywall-pricing">
              <div className="st-paywall-price-row">
                <span className="st-paywall-price-old">€1,200/yr</span>
                <span className="st-paywall-price-current">€49</span>
                <span className="st-paywall-price-period">one-time beta access</span>
              </div>
              <div className="st-paywall-savings">
                <Star size={14} />
                <span>Save €1,151 — early supporters only</span>
              </div>
            </div>

            {/* What you get */}
            <ul className="st-paywall-features">
              <li>
                <CheckCircle2 size={16} />
                <div>
                  <strong>14,000+ Licensed Entities</strong>
                  <span>VASPs, EMIs, banks across 206 jurisdictions — searchable, filterable</span>
                </div>
              </li>
              <li>
                <CheckCircle2 size={16} />
                <div>
                  <strong>Stablecoin Regulation Intelligence</strong>
                  <span>Licensing frameworks, backing rules, and compliance status per country</span>
                </div>
              </li>
              <li>
                <CheckCircle2 size={16} />
                <div>
                  <strong>Issuer Profiles & Corporate Structure</strong>
                  <span>44 issuers with subsidiaries, licenses, LEI, and audit data</span>
                </div>
              </li>
              <li>
                <CheckCircle2 size={16} />
                <div>
                  <strong>CBDC Project Tracker</strong>
                  <span>24 central bank digital currency projects — from research to launch</span>
                </div>
              </li>
              <li>
                <CheckCircle2 size={16} />
                <div>
                  <strong>Travel Rule Implementation Map</strong>
                  <span>FATF compliance status across every tracked jurisdiction</span>
                </div>
              </li>
              <li>
                <CheckCircle2 size={16} />
                <div>
                  <strong>Continuous Updates</strong>
                  <span>New data sources, parsers, and regulatory changes added weekly</span>
                </div>
              </li>
            </ul>

            {/* CTA */}
            <Link
              to="/pricing"
              state={{ from: location.pathname }}
              className="st-paywall-cta"
            >
              Get Early Access — €49
              <ArrowRight size={16} />
            </Link>

            {/* Social proof */}
            <div className="st-paywall-proof">
              <div className="st-paywall-proof-stats">
                <span><BarChart3 size={13} /> 206 jurisdictions</span>
                <span><Users size={13} /> 14,000+ entities</span>
                <span><BookOpen size={13} /> 70+ stablecoins</span>
              </div>
            </div>

            {/* Already have access */}
            <p className="st-paywall-signin">
              Already have access?{' '}
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
