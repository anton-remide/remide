import { forwardRef, type InputHTMLAttributes } from 'react';

export interface ToggleProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  size?: 'default' | 'sm';
}

const Toggle = forwardRef<HTMLInputElement, ToggleProps>(({
  label,
  size = 'default',
  className,
  id,
  ...rest
}, ref) => {
  const toggleId = id || (label ? `toggle-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
  const classes = [
    'st-toggle',
    size === 'sm' && 'st-toggle--sm',
    className,
  ].filter(Boolean).join(' ');

  return (
    <label className={classes} htmlFor={toggleId}>
      <input ref={ref} type="checkbox" id={toggleId} className="st-toggle__input" {...rest} />
      <span className="st-toggle__track" aria-hidden="true">
        <span className="st-toggle__thumb" />
      </span>
      {label && <span className="st-toggle__label">{label}</span>}
    </label>
  );
});

Toggle.displayName = 'Toggle';
export default Toggle;
