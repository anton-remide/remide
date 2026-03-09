import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Shield, UserPlus, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { usePaywall } from '../../hooks/usePaywall';
import { trackEvent } from '../../utils/analytics';

/**
 * Sticky bottom CTA bar for non-paid users on detail pages.
 * Slides up after 1.5s scroll delay, dismissible for the session.
 *
 * Anonymous → "Register Free — See All Data"
 * Registered → "Get Full Access — €49"
 * Paid → not rendered
 */
export default function FloatingPaywallCTA() {
  const { isAnonymous, isPaid, hasFullAccess } = usePaywall();
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (hasFullAccess || dismissed) return;

    const timer = setTimeout(() => setVisible(true), 1500);
    return () => clearTimeout(timer);
  }, [hasFullAccess, dismissed]);

  // Reset dismissed state on page change
  useEffect(() => {
    setDismissed(false);
    setVisible(false);
  }, [location.pathname]);

  if (isPaid || dismissed || !visible) return null;

  const isSignup = isAnonymous;
  const to = isSignup ? '/signup' : '/pricing';
  const text = isSignup ? 'Register Free — See All Data' : 'Get Full Access — €49';

  const handleClick = () => {
    trackEvent('paywall_cta_click', {
      page: location.pathname,
      variant: isSignup ? 'signup' : 'upgrade',
      section: 'floating_bar',
    });
  };

  const handleDismiss = () => {
    setDismissed(true);
    trackEvent('paywall_cta_dismiss', {
      page: location.pathname,
      variant: isSignup ? 'signup' : 'upgrade',
    });
  };

  return (
    <div className="st-floating-cta">
      <div className="st-floating-cta__inner">
        <div className="st-floating-cta__text">
          {isSignup ? (
            <>
              <UserPlus size={16} />
              <span>Free registration unlocks full entity profiles</span>
            </>
          ) : (
            <>
              <Shield size={16} />
              <span>Unlock premium data, license numbers & related entities</span>
            </>
          )}
        </div>
        <Link
          to={to}
          state={{ from: location.pathname }}
          className="st-btn st-floating-cta__btn"
          onClick={handleClick}
        >
          {text}
          <ArrowRight size={14} />
        </Link>
        <button
          className="st-floating-cta__dismiss"
          onClick={handleDismiss}
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
