import { forwardRef, type FormEvent, type InputHTMLAttributes } from 'react';

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
      <svg className="st-search-bar__icon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
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
