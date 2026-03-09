import { Link } from 'react-router-dom';

export default function TopBanner() {
  return (
    <div className="st-top-banner">
      <div className="st-top-banner-inner">
        <span className="st-top-banner-text">
          Early-bird pricing: <strong>$49 lifetime</strong> — limited spots.{' '}
          <Link to="/pricing">See offer &rarr;</Link>
        </span>
      </div>
    </div>
  );
}
