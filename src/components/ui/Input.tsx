import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  hint,
  icon,
  className,
  id,
  ...rest
}, ref) => {
  const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  return (
    <div className={['st-input-group', error && 'has-error', className].filter(Boolean).join(' ')}>
      {label && (
        <label htmlFor={inputId} className="st-input-label">{label}</label>
      )}
      <div className="st-input-wrapper">
        {icon && <span className="st-input-icon" aria-hidden="true">{icon}</span>}
        <input
          ref={ref}
          id={inputId}
          className={['st-input', icon && 'has-icon'].filter(Boolean).join(' ')}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          {...rest}
        />
      </div>
      {error && <p id={`${inputId}-error`} className="st-input-error" role="alert">{error}</p>}
      {!error && hint && <p id={`${inputId}-hint`} className="st-input-hint">{hint}</p>}
    </div>
  );
});

Input.displayName = 'Input';
export default Input;
