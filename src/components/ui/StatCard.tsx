import type { ReactNode } from 'react';

export interface StatCardProps {
  value: ReactNode;
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
  active?: boolean;
  className?: string;
}

export default function StatCard({
  value,
  label,
  icon,
  onClick,
  active,
  className,
}: StatCardProps) {
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      className={[
        'st-stat-card',
        active && 'is-active',
        onClick && 'is-interactive',
        className,
      ].filter(Boolean).join(' ')}
      onClick={onClick}
      type={onClick ? 'button' : undefined}
      aria-pressed={onClick ? active : undefined}
    >
      <div className="st-stat-card__top">
        <span className="st-stat-card__value">{value}</span>
        {icon && <span className="st-stat-card__icon" aria-hidden="true">{icon}</span>}
      </div>
      <span className="st-stat-card__label">{label}</span>
    </Tag>
  );
}
