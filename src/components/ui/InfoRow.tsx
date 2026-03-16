import type { ReactNode } from 'react';

export interface InfoRowProps {
  label: string;
  value: ReactNode;
  className?: string;
}

export default function InfoRow({ label, value, className }: InfoRowProps) {
  return (
    <div className={['st-info-row', className].filter(Boolean).join(' ')}>
      <dt className="st-info-row__label">{label}</dt>
      <dd className="st-info-row__value">{value}</dd>
    </div>
  );
}
