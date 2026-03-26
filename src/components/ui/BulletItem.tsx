import type { ReactNode } from 'react';
import { Circle } from 'lucide-react';

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
          <Circle size={8} fill="currentColor" stroke="none" />
        ))}
      </span>
      <span className="st-bullet-item__text">{children}</span>
    </div>
  );
}
