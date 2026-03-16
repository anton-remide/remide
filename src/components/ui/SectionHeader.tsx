import type { ReactNode } from 'react';

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export default function SectionHeader({
  title,
  subtitle,
  badge,
  action,
  className,
}: SectionHeaderProps) {
  return (
    <div className={['st-section-header', className].filter(Boolean).join(' ')}>
      <div className="st-section-header__left">
        <div className="st-section-header__title-row">
          <h2 className="st-section-header__title">{title}</h2>
          {badge}
        </div>
        {subtitle && <p className="st-section-header__subtitle">{subtitle}</p>}
      </div>
      {action && <div className="st-section-header__action">{action}</div>}
    </div>
  );
}
