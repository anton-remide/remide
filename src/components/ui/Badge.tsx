import type { CSSProperties, ReactNode } from 'react';

export type BadgeVariant =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'accent';

export type BadgeSize = 'default' | 'sm';

interface BaseProps {
  children?: ReactNode;
  size?: BadgeSize;
  className?: string;
  style?: CSSProperties;
}

interface VariantProps extends BaseProps {
  variant: BadgeVariant;
  label?: string;
  colorMap?: never;
}

interface ColorMapProps extends BaseProps {
  label: string;
  colorMap: Record<string, { bg: string; text: string }>;
  variant?: never;
}

interface LabelOnlyProps extends BaseProps {
  label: string;
  colorMap?: undefined;
  variant?: BadgeVariant;
}

type Props = VariantProps | ColorMapProps | LabelOnlyProps;

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  success: 'st-badge--success',
  warning: 'st-badge--warning',
  danger: 'st-badge--danger',
  info: 'st-badge--info',
  neutral: 'st-badge--neutral',
  accent: 'st-badge--accent',
};

export default function Badge(props: Props) {
  const { size, className, style, children } = props;

  const label = 'label' in props ? props.label : undefined;
  const content = children ?? label;

  let inlineStyle: CSSProperties | undefined = style;
  let variantClass = '';

  if ('colorMap' in props && props.colorMap) {
    const c = props.colorMap[props.label] ?? { bg: 'var(--color-neutral-subtle)', text: 'var(--color-neutral)' };
    inlineStyle = { backgroundColor: c.bg, color: c.text, ...style };
  } else if (props.variant) {
    variantClass = VARIANT_CLASSES[props.variant];
  }

  const classes = [
    'st-badge',
    variantClass,
    size === 'sm' && 'st-badge--sm',
    className,
  ].filter(Boolean).join(' ');

  return (
    <span className={classes} style={inlineStyle}>
      {content}
    </span>
  );
}
