import type { ReactNode, CSSProperties, ElementType } from 'react';

export type TextSize = 'lg' | 'base' | 'sm' | 'caption' | 'micro';
export type TextColor = 'main' | 'secondary' | 'accent' | 'success' | 'danger' | 'warning' | 'info';

export interface TextProps {
  size?: TextSize;
  color?: TextColor;
  weight?: 400 | 500 | 600 | 700;
  as?: ElementType;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export default function Text({
  size = 'base',
  color = 'main',
  weight,
  as: Tag = 'p',
  children,
  className,
  style,
}: TextProps) {
  const classes = [
    'st-text',
    `st-text--${size}`,
    color !== 'main' && `st-text--${color}`,
    className,
  ].filter(Boolean).join(' ');

  const inlineStyle = weight ? { fontWeight: weight, ...style } : style;

  return <Tag className={classes} style={inlineStyle}>{children}</Tag>;
}
