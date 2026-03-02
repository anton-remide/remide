import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="st-footer">
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <Link to="/" className="st-footer-brand">RemiDe</Link>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          &copy; {new Date().getFullYear()} RemiDe. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
