export interface SpinnerProps {
  size?: number;
  className?: string;
}

export default function Spinner({ size = 20, className }: SpinnerProps) {
  return (
    <svg
      className={['st-spinner', className].filter(Boolean).join(' ')}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      aria-label="Loading"
      role="status"
    >
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" opacity="0.2" />
      <path
        d="M10 2a8 8 0 0 1 8 8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
