import type { ReactNode } from 'react';
import { X } from 'lucide-react';

export interface ChipProps {
  children: ReactNode;
  selected?: boolean;
  onRemove?: () => void;
  onClick?: () => void;
  className?: string;
}

export default function Chip({ children, selected, onRemove, onClick, className }: ChipProps) {
  const classes = [
    'st-chip',
    selected && 'is-selected',
    onClick && 'is-clickable',
    className,
  ].filter(Boolean).join(' ');

  return (
    <span
      className={classes}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      aria-pressed={onClick ? selected : undefined}
    >
      <span className="st-chip__label">{children}</span>
      {onRemove && (
        <button
          className="st-chip__remove"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          aria-label="Remove"
          type="button"
        >
          <X size={12} aria-hidden="true" />
        </button>
      )}
    </span>
  );
}
