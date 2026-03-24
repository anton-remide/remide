import { Link } from 'react-router-dom';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

export default function NotFoundPage() {
  useDocumentMeta({
    title: 'Page Not Found — RemiDe',
    description: 'The page you are looking for does not exist or has been moved.',
  });

  return (
    <div className="st-page" style={{ paddingTop: 120, textAlign: 'center' }}>
      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '4rem', marginBottom: 8, color: 'var(--text-muted)' }}>404</h1>
      <h4 style={{ marginBottom: 12, fontFamily: 'var(--font-heading)' }}>Page Not Found</h4>
      <p style={{ color: 'var(--text-muted)', marginBottom: 24, maxWidth: 420, marginInline: 'auto', lineHeight: 1.6 }}>
        The page you are looking for doesn't exist or has been moved.
      </p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link to="/" className="st-btn">Go Home</Link>
        <Link to="/jurisdictions" className="st-btn st-btn-outline">Jurisdictions</Link>
        <Link to="/entities" className="st-btn st-btn-outline">Entities</Link>
      </div>
    </div>
  );
}
