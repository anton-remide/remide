import { Link, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

export interface NavItemProps {
  to: string;
  label: string;
  icon?: ReactNode;
  badge?: ReactNode;
  exact?: boolean;
  className?: string;
}

export default function NavItem({ to, label, icon, badge, exact, className }: NavItemProps) {
  const { pathname } = useLocation();
  const isActive = exact ? pathname === to : pathname.startsWith(to);

  return (
    <Link
      to={to}
      className={[
        'st-nav-item',
        isActive && 'is-active',
        className,
      ].filter(Boolean).join(' ')}
      aria-current={isActive ? 'page' : undefined}
    >
      {icon && <span className="st-nav-item__icon" aria-hidden="true">{icon}</span>}
      <span className="st-nav-item__label">{label}</span>
      {badge && <span className="st-nav-item__badge">{badge}</span>}
    </Link>
  );
}
