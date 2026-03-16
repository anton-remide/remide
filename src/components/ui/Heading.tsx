import type { ReactNode, CSSProperties } from 'react';

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface HeadingProps {
  level?: HeadingLevel;
  as?: `h${HeadingLevel}`;
  display?: boolean;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  id?: string;
}

export default function Heading({
  level = 2,
  as,
  display,
  children,
  className,
  style,
  id,
}: HeadingProps) {
  const Tag = as || (`h${level}` as const);
  const classes = [
    'st-heading',
    display && 'st-heading--display',
    `st-heading--${level}`,
    className,
  ].filter(Boolean).join(' ');

  return <Tag id={id} className={classes} style={style}>{children}</Tag>;
}
