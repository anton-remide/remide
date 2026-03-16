import type { ReactNode, CSSProperties } from 'react';
import { Link } from 'react-router-dom';

export interface ContentCardProps {
  title: string;
  description?: string;
  href?: string;
  to?: string;
  badge?: ReactNode;
  icon?: ReactNode;
  meta?: ReactNode;
  image?: string;
  imageAlt?: string;
  onClick?: () => void;
  className?: string;
  style?: CSSProperties;
}

export default function ContentCard({
  title,
  description,
  href,
  to,
  badge,
  icon,
  meta,
  image,
  imageAlt,
  onClick,
  className,
  style,
}: ContentCardProps) {
  const classes = ['st-content-card', className].filter(Boolean).join(' ');

  const inner = (
    <>
      {image && (
        <div className="st-content-card__image">
          <img src={image} alt={imageAlt ?? title} loading="lazy" />
        </div>
      )}
      <div className="st-content-card__body">
        <div className="st-content-card__header">
          {icon && <span className="st-content-card__icon" aria-hidden="true">{icon}</span>}
          <h3 className="st-content-card__title">{title}</h3>
        </div>
        {description && (
          <p className="st-content-card__desc">{description}</p>
        )}
        <div className="st-content-card__footer">
          {meta && <span className="st-content-card__meta">{meta}</span>}
          {badge && <div className="st-content-card__badge">{badge}</div>}
        </div>
      </div>
    </>
  );

  if (to) {
    return <Link to={to} className={classes} style={style}>{inner}</Link>;
  }

  if (href) {
    return <a href={href} className={classes} style={style} target="_blank" rel="noopener noreferrer">{inner}</a>;
  }

  if (onClick) {
    return <div className={classes} style={style} onClick={onClick} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && onClick()}>{inner}</div>;
  }

  return <div className={classes} style={style}>{inner}</div>;
}
