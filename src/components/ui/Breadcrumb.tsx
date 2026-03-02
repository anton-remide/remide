import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

interface Crumb {
  label: string;
  to?: string;
}

interface Props {
  crumbs: Crumb[];
}

export default function Breadcrumb({ crumbs }: Props) {
  return (
    <nav className="st-breadcrumb">
      {crumbs.map((crumb, i) => (
        <span key={i}>
          {i > 0 && <ChevronRight size={14} style={{ margin: '0 6px', opacity: 0.4, verticalAlign: 'middle' }} />}
          {crumb.to ? (
            <Link to={crumb.to}>{crumb.label}</Link>
          ) : (
            <span className="current">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
