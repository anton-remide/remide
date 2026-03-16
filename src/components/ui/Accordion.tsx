import { useState, useCallback, useId, type ReactNode } from 'react';

export interface AccordionItemProps {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  badge?: ReactNode;
  className?: string;
}

export function AccordionItem({
  title,
  children,
  defaultOpen = false,
  badge,
  className,
}: AccordionItemProps) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  const contentId = `${id}-content`;
  const triggerId = `${id}-trigger`;

  const toggle = useCallback(() => setOpen(prev => !prev), []);

  return (
    <div className={['st-accordion-item', open && 'is-open', className].filter(Boolean).join(' ')}>
      <button
        id={triggerId}
        className="st-accordion-item__trigger"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={contentId}
        type="button"
      >
        <span className="st-accordion-item__title">{title}</span>
        {badge && <span className="st-accordion-item__badge">{badge}</span>}
        <svg
          className="st-accordion-item__chevron"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div
        id={contentId}
        role="region"
        aria-labelledby={triggerId}
        className="st-accordion-item__content"
        hidden={!open}
      >
        <div className="st-accordion-item__body">
          {children}
        </div>
      </div>
    </div>
  );
}

export interface AccordionProps {
  children: ReactNode;
  className?: string;
}

export default function Accordion({ children, className }: AccordionProps) {
  return (
    <div className={['st-accordion', className].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}
