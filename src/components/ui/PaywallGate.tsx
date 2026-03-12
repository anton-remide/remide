import { Link, useLocation } from 'react-router-dom';
import { Lock, ArrowRight, Shield, UserPlus } from 'lucide-react';
import { trackEvent } from '../../utils/analytics';

interface PaywallGateProps {
  children: React.ReactNode;
  /** Whether the content is locked (blurred) */
  locked: boolean;
  /** Personalised heading, e.g. "Unlock Full Entity Profile" */
  title: string;
  /** How many items are hidden */
  count?: number;
  /** Noun for the count, e.g. "data fields" */
  noun?: string;
  /** 'signup' for anonymous → /signup, 'upgrade' for registered → /pricing */
  variant?: 'signup' | 'upgrade';
  /** Override CTA button text */
  ctaText?: string;
  /** Override CTA destination */
  ctaTo?: string;
  /** Optional extra CSS class */
  className?: string;
}

/**
 * Wraps REAL content and gates it behind a blur + overlay CTA.
 *
 * Unlike PaywallOverlay (which shows fake grey bars), PaywallGate shows
 * the actual content blurred — creating better FOMO and conversion.
 *
 * When unlocked: renders children normally.
 * When locked: blurs children + shows floating CTA card on top.
 */
export default function PaywallGate({
  children,
  locked,
  title,
  count,
  noun,
  variant = 'upgrade',
  ctaText,
  ctaTo,
  className,
}: PaywallGateProps) {
  const location = useLocation();

  if (!locked) return <>{children}</>;

  const isSignup = variant === 'signup';
  const resolvedTo = ctaTo ?? (isSignup ? '/signup' : '/pricing');
  const resolvedText = ctaText ?? (isSignup ? 'Register Free' : 'Get Full Access — €49');

  const handleClick = () => {
    trackEvent('paywall_cta_click', {
      title,
      page: location.pathname,
      variant,
      section: 'gate',
    });
  };

  return (
    <div className={`st-paywall-gate ${className ?? ''}`}>
      {/* Real content — blurred (inert prevents focus but keeps in a11y tree) */}
      <div className="st-paywall-gate__content" inert={true}>
        {children}
      </div>

      {/* Gradient fade overlay */}
      <div className="st-paywall-gate__fade" />

      {/* CTA card — centered over blurred content */}
      <div className="st-paywall-gate__card">
        <div className="st-paywall-gate__icon">
          {isSignup ? <UserPlus size={20} /> : <Lock size={20} />}
        </div>
        <h4 className="st-paywall-gate__title">{title}</h4>
        {count !== undefined && count > 0 && noun && (
          <p className="st-paywall-gate__teaser">
            {count.toLocaleString()} {noun} available{isSignup ? ' after registration' : ' with full access'}
          </p>
        )}
        <Link
          to={resolvedTo}
          state={{ from: location.pathname }}
          className="st-btn st-paywall-gate__cta"
          onClick={handleClick}
        >
          {resolvedText}
          <ArrowRight size={16} />
        </Link>
        {isSignup ? (
          <p className="st-paywall-gate__sub">
            <UserPlus size={11} style={{ verticalAlign: -1, marginRight: 3 }} />
            Free account — no credit card needed
          </p>
        ) : (
          <p className="st-paywall-gate__sub">
            <Shield size={11} style={{ verticalAlign: -1, marginRight: 3 }} />
            14-day money-back guarantee
          </p>
        )}
      </div>
    </div>
  );
}
