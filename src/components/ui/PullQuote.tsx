export interface PullQuoteProps {
  children: string;
  citation?: string;
  className?: string;
}

export default function PullQuote({ children, citation, className }: PullQuoteProps) {
  return (
    <blockquote className={['st-pull-quote', className].filter(Boolean).join(' ')}>
      <p className="st-pull-quote__text">{children}</p>
      {citation && <cite className="st-pull-quote__cite">{citation}</cite>}
    </blockquote>
  );
}
