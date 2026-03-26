import { forwardRef, type FormEvent, type InputHTMLAttributes } from 'react';
import { Search } from 'lucide-react';

export interface SearchBarProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onSubmit'> {
  onSearch?: (query: string) => void;
  loading?: boolean;
}

const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(({
  onSearch,
  loading,
  className,
  ...rest
}, ref) => {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const input = form.querySelector('input') as HTMLInputElement;
    onSearch?.(input.value);
  };

  return (
    <form
      className={['st-search-bar', className].filter(Boolean).join(' ')}
      onSubmit={handleSubmit}
      role="search"
    >
      <Search className="st-search-bar__icon" size={16} aria-hidden="true" />
      <input
        ref={ref}
        className="st-search-bar__input"
        type="search"
        aria-label="Search"
        {...rest}
      />
      {loading && (
        <span className="st-search-bar__spinner" aria-hidden="true" />
      )}
    </form>
  );
});

SearchBar.displayName = 'SearchBar';
export default SearchBar;
