interface DividerProps {
  label?: string;
  className?: string;
}

export default function Divider({ label, className }: DividerProps) {
  if (label) {
    return (
      <div className={['st-divider st-divider--labeled', className].filter(Boolean).join(' ')} role="separator">
        <span className="st-divider__label">{label}</span>
      </div>
    );
  }
  return <hr className={['st-divider', className].filter(Boolean).join(' ')} role="separator" />;
}
