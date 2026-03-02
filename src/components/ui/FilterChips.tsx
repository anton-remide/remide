interface Props<T extends string> {
  options: T[];
  selected: T[];
  onToggle: (value: T) => void;
  colorMap?: Record<string, string>;
}

export default function FilterChips<T extends string>({ options, selected, onToggle, colorMap }: Props<T>) {
  return (
    <div className="st-filter-chips">
      {options.map((opt) => {
        const active = selected.includes(opt);
        const color = colorMap?.[opt];
        return (
          <button
            key={opt}
            className={`st-filter-chip${active ? ' active' : ''}`}
            onClick={() => onToggle(opt)}
            style={active && color ? { backgroundColor: color, borderColor: color, color: '#fff' } : undefined}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
