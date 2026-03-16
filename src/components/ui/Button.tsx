import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'outline';
export type ButtonSize = 'default' | 'sm';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'primary',
  size = 'default',
  icon,
  loading,
  children,
  className,
  disabled,
  ...rest
}, ref) => {
  const base = variant === 'outline' ? 'st-btn-outline' : 'st-btn';
  const classes = [
    base,
    size === 'sm' && 'st-btn-sm',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button
      ref={ref}
      className={classes}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <span className="st-btn-spinner" aria-hidden="true" />}
      {icon && !loading && <span className="st-btn-icon" aria-hidden="true">{icon}</span>}
      {children}
    </button>
  );
});

Button.displayName = 'Button';
export default Button;
