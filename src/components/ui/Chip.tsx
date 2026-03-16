import type { ReactNode } from 'react';

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
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </span>
  );
}
