import type { ReactNode } from 'react';

export interface ProseBlockProps {
  children: ReactNode;
  className?: string;
}

export default function ProseBlock({ children, className }: ProseBlockProps) {
  return (
    <div className={['st-prose', className].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}
