import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { usePaywall } from '../../hooks/usePaywall';
import { isBackendEnabled } from '../../lib/supabase';

export default function TopBanner() {
  const bannerRef = useRef<HTMLDivElement>(null);
  const { isPaid } = usePaywall();

  useEffect(() => {
    const updateBannerHeight = () => {
      if (!bannerRef.current) {
        // Banner hidden — reset CSS var
        document.documentElement.style.setProperty('--top-banner-height', '0px');
        return;
      }
      const height = Math.ceil(bannerRef.current.getBoundingClientRect().height);
      document.documentElement.style.setProperty('--top-banner-height', `${height}px`);
    };

    updateBannerHeight();

    if (!bannerRef.current) return;
    const resizeObserver = new ResizeObserver(updateBannerHeight);
    resizeObserver.observe(bannerRef.current);
    window.addEventListener('resize', updateBannerHeight);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateBannerHeight);
      document.documentElement.style.removeProperty('--top-banner-height');
    };
  }, [isPaid]);

  // Paid users don't see the promo banner
  if (isPaid) return null;

  return (
    <div ref={bannerRef} className="st-top-banner">
      <div className="st-top-banner-inner">
        <span className="st-top-banner-text">
          {!isBackendEnabled ? (
            <>
              Preview mode: remote data and authentication are disabled, but routes and UI pages stay available.
            </>
          ) : (
            <>
              Early-bird pricing: <strong>€49 lifetime</strong> — limited spots.{` `}
              <Link to="/pricing">See offer &rarr;</Link>
            </>
          )}
        </span>
      </div>
    </div>
  );
}
