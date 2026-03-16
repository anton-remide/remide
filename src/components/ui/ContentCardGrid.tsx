import type { ReactNode } from 'react';

export interface ContentCardGridProps {
  children: ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}

export default function ContentCardGrid({ children, columns = 3, className }: ContentCardGridProps) {
  return (
    <div
      className={['st-content-card-grid', `st-content-card-grid--${columns}`, className].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  );
}
