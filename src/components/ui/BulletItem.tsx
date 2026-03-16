import type { ReactNode } from 'react';

export type BulletVariant = 'default' | 'success' | 'warning' | 'info' | 'danger' | 'muted';

export interface BulletItemProps {
  icon?: ReactNode;
  number?: number;
  variant?: BulletVariant;
  children: ReactNode;
  className?: string;
}

export default function BulletItem({ icon, number, variant, children, className }: BulletItemProps) {
  const classes = [
    'st-bullet-item',
    variant && variant !== 'default' ? `st-bullet-item--${variant}` : undefined,
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <span className="st-bullet-item__marker" aria-hidden="true">
        {icon || (number != null ? number : (
          <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
            <circle cx="4" cy="4" r="3" />
          </svg>
        ))}
      </span>
      <span className="st-bullet-item__text">{children}</span>
    </div>
  );
}
