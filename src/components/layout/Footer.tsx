import { Link, useLocation } from 'react-router-dom';

export default function Footer() {
  const { pathname } = useLocation();
  const isDesignSystem = pathname.startsWith('/ui');

  if (isDesignSystem) {
    return null;
  }

  return (
    <footer className="st-footer">
      <div className="st-footer-inner">
        <div className="st-footer-left">
          <div className="st-footer-copyright">&copy; 2026 RemiDe. All rights reserved.</div>
        </div>

        <div className="st-footer-links">
          <Link to="/jurisdictions">Jurisdictions</Link>
          <Link to="/entities">Entities</Link>
        </div>
      </div>
    </footer>
  );
}
