import type { ReactNode } from 'react';

export interface CTABlockProps {
  title: string;
  description?: string;
  children: ReactNode;
  variant?: 'default' | 'accent';
  className?: string;
}

export default function CTABlock({
  title,
  description,
  children,
  variant = 'default',
  className,
}: CTABlockProps) {
  return (
    <div className={[
      'st-cta-block',
      variant === 'accent' && 'st-cta-block--accent',
      className,
    ].filter(Boolean).join(' ')}>
      <div className="st-cta-block__content">
        <h3 className="st-cta-block__title">{title}</h3>
        {description && <p className="st-cta-block__desc">{description}</p>}
      </div>
      <div className="st-cta-block__action">
        {children}
      </div>
    </div>
  );
}
