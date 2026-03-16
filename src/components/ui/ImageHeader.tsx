import type { ReactNode } from 'react';

export interface ImageHeaderProps {
  title: string;
  subtitle?: string;
  image?: string;
  badge?: ReactNode;
  className?: string;
}

export default function ImageHeader({ title, subtitle, image, badge, className }: ImageHeaderProps) {
  return (
    <div
      className={['st-image-header', className].filter(Boolean).join(' ')}
      style={image ? { backgroundImage: `url(${image})` } : undefined}
    >
      <div className="st-image-header__overlay" />
      <div className="st-image-header__content">
        {badge && <div className="st-image-header__badge">{badge}</div>}
        <h1 className="st-image-header__title">{title}</h1>
        {subtitle && <p className="st-image-header__subtitle">{subtitle}</p>}
      </div>
    </div>
  );
}
