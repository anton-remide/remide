import type { ReactNode } from 'react';

export interface FilterOption {
  id: string;
  label: ReactNode;
}

export interface FilterChipGroupProps {
  options: FilterOption[];
  selected: Set<string>;
  onChange: (selected: Set<string>) => void;
  className?: string;
}

export default function FilterChipGroup({ options, selected, onChange, className }: FilterChipGroupProps) {
  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    onChange(next);
  };

  return (
    <div className={['st-filter-chip-group', className].filter(Boolean).join(' ')} role="group">
      {options.map(opt => (
        <button
          key={opt.id}
          className={['st-filter-chip', selected.has(opt.id) && 'is-active'].filter(Boolean).join(' ')}
          onClick={() => toggle(opt.id)}
          aria-pressed={selected.has(opt.id)}
          type="button"
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
