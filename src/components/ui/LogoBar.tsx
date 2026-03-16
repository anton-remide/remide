export interface LogoItem {
  src: string;
  alt: string;
  href?: string;
}

export interface LogoBarProps {
  logos: LogoItem[];
  label?: string;
  className?: string;
}

export default function LogoBar({ logos, label, className }: LogoBarProps) {
  return (
    <div className={['st-logo-bar', className].filter(Boolean).join(' ')}>
      {label && <p className="st-logo-bar__label">{label}</p>}
      <div className="st-logo-bar__track">
        {logos.map((logo, i) => {
          const img = <img key={i} src={logo.src} alt={logo.alt} className="st-logo-bar__logo" />;
          return logo.href ? (
            <a key={i} href={logo.href} target="_blank" rel="noopener noreferrer">{img}</a>
          ) : img;
        })}
      </div>
    </div>
  );
}
