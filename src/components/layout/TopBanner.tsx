import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

export default function TopBanner() {
  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateBannerHeight = () => {
      if (!bannerRef.current) return;
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
  }, []);

  return (
    <div ref={bannerRef} className="st-top-banner">
      <div className="st-top-banner-inner">
        <span className="st-top-banner-text">
          Early-bird pricing: <strong>€49 lifetime</strong> — limited spots.{` `}
          <Link to="/pricing">See offer &rarr;</Link>
        </span>
      </div>
    </div>
  );
}
