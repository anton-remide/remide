import type { ReactNode } from 'react';

export interface CalloutProps {
  label?: string;
  children: ReactNode;
  variant?: 'default' | 'accent' | 'warning' | 'info' | 'success';
  className?: string;
}

export default function Callout({
  label,
  children,
  variant = 'default',
  className,
}: CalloutProps) {
  const classes = [
    'st-callout',
    variant !== 'default' && `st-callout--${variant}`,
    className,
  ].filter(Boolean).join(' ');

  return (
    <aside className={classes}>
      {label && <div className="st-callout__label">{label}</div>}
      <div className="st-callout__body">{children}</div>
    </aside>
  );
}

export interface CalloutStatGridProps {
  children: ReactNode;
  columns?: 2 | 3;
  className?: string;
}

export function CalloutStatGrid({ children, columns = 2, className }: CalloutStatGridProps) {
  return (
    <div
      className={['st-callout-stat-grid', className].filter(Boolean).join(' ')}
      style={{ '--callout-stat-cols': columns } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

export interface CalloutStatProps {
  value: string;
  label: string;
  description?: string;
}

export function CalloutStat({ value, label, description }: CalloutStatProps) {
  return (
    <div className="st-callout-stat">
      <div className="st-callout-stat__value">{value}</div>
      <div className="st-callout-stat__label">{label}</div>
      {description && <p className="st-callout-stat__desc">{description}</p>}
    </div>
  );
}
