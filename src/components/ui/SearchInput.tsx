import { useRef, useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
}

export default function SearchInput({ value, onChange, placeholder = 'Search...', debounceMs = 200 }: Props) {
  const [local, setLocal] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => { setLocal(value); }, [value]);

  const handleChange = (val: string) => {
    setLocal(val);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange(val), debounceMs);
  };

  const clear = () => {
    setLocal('');
    onChange('');
  };

  return (
    <div className="st-search">
      <Search size={16} className="st-search-icon" />
      <input
        type="text"
        value={local}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
      />
      {local && (
        <button className="st-search-clear" onClick={clear} aria-label="Clear search">
          <X size={14} />
        </button>
      )}
    </div>
  );
}
