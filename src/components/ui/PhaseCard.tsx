import type { ReactNode } from 'react';

export interface PhaseCardProps {
  number: number;
  title: string;
  description?: string;
  status?: 'upcoming' | 'active' | 'completed';
  children?: ReactNode;
  className?: string;
}

export default function PhaseCard({ number, title, description, status = 'upcoming', children, className }: PhaseCardProps) {
  return (
    <div className={[
      'st-phase-card',
      `st-phase-card--${status}`,
      className,
    ].filter(Boolean).join(' ')}>
      <div className="st-phase-card__number">{number}</div>
      <div className="st-phase-card__body">
        <h4 className="st-phase-card__title">{title}</h4>
        {description && <p className="st-phase-card__desc">{description}</p>}
        {children}
      </div>
    </div>
  );
}
