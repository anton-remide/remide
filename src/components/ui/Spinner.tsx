import { LoaderCircle } from 'lucide-react';

export interface SpinnerProps {
  size?: number;
  className?: string;
}

export default function Spinner({ size = 20, className }: SpinnerProps) {
  return (
    <LoaderCircle
      className={['st-spinner', className].filter(Boolean).join(' ')}
      size={size}
      aria-label="Loading"
      role="status"
    />
  );
}
