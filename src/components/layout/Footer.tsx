import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="st-footer">
      <div className="st-footer-bottom">
        <Link to="/" className="st-footer-brand" aria-label="RemiDe Home">
          <img src={`${import.meta.env.BASE_URL}logo-full.svg`} alt="RemiDe" height={20} className="st-footer-logo" />
        </Link>
        <nav className="st-footer-links" aria-label="Footer navigation">
          <Link to="/jurisdictions">Jurisdictions</Link>
          <Link to="/entities">Entities</Link>
          <Link to="/entities?tab=stablecoins">Stablecoins</Link>
        </nav>
        <div className="st-footer-copyright">
          &copy; {new Date().getFullYear()} RemiDe. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
