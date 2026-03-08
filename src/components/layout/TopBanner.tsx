import { useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';

const DISMISS_KEY = 'remide_banner_dismissed';

export default function TopBanner() {
  const [dismissed, setDismissed] = useState(() =>
    sessionStorage.getItem(DISMISS_KEY) === '1'
  );

  if (dismissed) return null;

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  return (
    <div className="st-top-banner">
      <div className="st-top-banner-inner">
        <span className="st-top-banner-text">
          Early-bird pricing: <strong>$49 lifetime</strong> — limited spots.{' '}
          <Link to="/pricing">See offer &rarr;</Link>
        </span>
        <button
          className="st-top-banner-close"
          onClick={handleDismiss}
          aria-label="Dismiss banner"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
