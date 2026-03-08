import { Link, useLocation } from 'react-router-dom';
import { Lock, ArrowRight, Shield, UserPlus } from 'lucide-react';
import { trackEvent } from '../../utils/analytics';

interface PaywallOverlayProps {
  /** Personalised heading, e.g. "Unlock UAE Stablecoin Laws" */
  title: string;
  /** How many items are hidden, e.g. 47 */
  count?: number;
  /** Noun for the count, e.g. "regulated entities" */
  noun?: string;
  /** Override CTA button text */
  ctaText?: string;
  /** Override CTA destination (default: /pricing) */
  ctaTo?: string;
  /**
   * 'signup' — anonymous user, CTA → /signup ("Register Free")
   * 'upgrade' — registered user, CTA → /pricing ("Get Full Access — $49")
   */
  variant?: 'signup' | 'upgrade';
}

/**
 * Section-level paywall overlay.
 * Shows a blurred placeholder + personalised CTA.
 * Designed to sit inline — NOT a full-screen modal.
 *
 * Three-tier aware: `variant="signup"` for anonymous, `variant="upgrade"` for registered.
 */
export default function PaywallOverlay({
  title,
  count,
  noun,
  ctaText,
  ctaTo,
  variant = 'upgrade',
}: PaywallOverlayProps) {
  const location = useLocation();

  const isSignup = variant === 'signup';
  const resolvedTo = ctaTo ?? (isSignup ? '/signup' : '/pricing');
  const resolvedText = ctaText ?? (isSignup ? 'Register Free' : 'Get Full Access — $49');

  const handleClick = () => {
    trackEvent('paywall_cta_click', {
      title,
      page: location.pathname,
      variant,
    });
  };

  return (
    <div className="st-section-paywall">
      {/* Blurred fake content behind */}
      <div className="st-section-paywall-blur" aria-hidden="true">
        <div className="st-section-paywall-fake-row" />
        <div className="st-section-paywall-fake-row short" />
        <div className="st-section-paywall-fake-row" />
        <div className="st-section-paywall-fake-row short" />
        <div className="st-section-paywall-fake-row" />
      </div>

      {/* CTA card */}
      <div className="st-section-paywall-card">
        <div className="st-section-paywall-icon">
          {isSignup ? <UserPlus size={20} /> : <Lock size={20} />}
        </div>
        <h4 className="st-section-paywall-title">{title}</h4>
        {count !== undefined && count > 0 && noun && (
          <p className="st-section-paywall-teaser">
            {count.toLocaleString()} {noun} available{isSignup ? ' after registration' : ' with full access'}
          </p>
        )}
        <Link
          to={resolvedTo}
          state={{ from: location.pathname }}
          className="st-btn st-section-paywall-cta"
          onClick={handleClick}
        >
          {resolvedText}
          <ArrowRight size={16} />
        </Link>
        {isSignup ? (
          <p className="st-section-paywall-sub">
            <UserPlus size={11} style={{ verticalAlign: -1, marginRight: 3 }} />
            Free account — no credit card needed
          </p>
        ) : (
          <p className="st-section-paywall-sub">
            <Shield size={11} style={{ verticalAlign: -1, marginRight: 3 }} />
            14-day money-back guarantee
          </p>
        )}
      </div>
    </div>
  );
}
