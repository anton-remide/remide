import { useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';

const COOKIE_KEY = 'remide_cookies_accepted';
const DISMISS_KEY = 'remide_wip_dismissed';

export default function StickyBar() {
  const [cookiesAccepted, setCookiesAccepted] = useState(() =>
    localStorage.getItem(COOKIE_KEY) === '1'
  );
  const [wipDismissed, setWipDismissed] = useState(() =>
    sessionStorage.getItem(DISMISS_KEY) === '1'
  );

  // Nothing to show
  if (cookiesAccepted && wipDismissed) return null;

  const handleAcceptCookies = () => {
    localStorage.setItem(COOKIE_KEY, '1');
    setCookiesAccepted(true);
  };

  const handleDismissWip = () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setWipDismissed(true);
  };

  return (
    <div className="st-sticky-bar">
      {/* WIP disclaimer — always visible until dismissed per session */}
      {!wipDismissed && (
        <div className="st-sticky-bar-row">
          <span className="st-sticky-bar-text">
            🚧 RemiDe is in early access — new data sources added weekly.{' '}
            <Link to="/pricing">Get early-bird access</Link> before public launch.
          </span>
          <button
            className="st-sticky-bar-close"
            onClick={handleDismissWip}
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Cookie consent — persistent until accepted */}
      {!cookiesAccepted && (
        <div className="st-sticky-bar-row st-sticky-bar-cookies">
          <span className="st-sticky-bar-text">
            We use essential cookies to make this site work. No tracking, no ads.
          </span>
          <button className="st-sticky-bar-accept" onClick={handleAcceptCookies}>
            Got it
          </button>
        </div>
      )}
    </div>
  );
}
