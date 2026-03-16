import type { ReactNode } from 'react';

export interface FormFieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export default function FormField({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={['st-form-field', error && 'has-error', className].filter(Boolean).join(' ')}>
      <label className="st-form-field__label" htmlFor={htmlFor}>
        {label}
        {required && <span className="st-form-field__required" aria-hidden="true">*</span>}
      </label>
      {children}
      {error && <p className="st-form-field__error" role="alert">{error}</p>}
      {!error && hint && <p className="st-form-field__hint">{hint}</p>}
    </div>
  );
}
