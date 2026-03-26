import {
  ArrowRight,
  CircleAlert,
  CircleCheckBig,
  Flag,
  Lightbulb,
  Square,
  SquareCheckBig,
  Star,
  Target,
  TriangleAlert,
} from 'lucide-react';

interface IconProps {
  size?: number;
  className?: string;
}

export function IconInsight({ size = 16, className }: IconProps) {
  return <Lightbulb size={size} className={className} aria-hidden="true" />;
}

export function IconCheck({ size = 16, className }: IconProps) {
  return <CircleCheckBig size={size} className={className} aria-hidden="true" />;
}

export function IconCheckbox({ size = 16, className }: IconProps) {
  return <SquareCheckBig size={size} className={className} aria-hidden="true" />;
}

export function IconCheckboxEmpty({ size = 16, className }: IconProps) {
  return <Square size={size} className={className} aria-hidden="true" />;
}

export function IconWarning({ size = 16, className }: IconProps) {
  return <TriangleAlert size={size} className={className} aria-hidden="true" />;
}

export function IconInfo({ size = 16, className }: IconProps) {
  return <CircleAlert size={size} className={className} aria-hidden="true" />;
}

export function IconStar({ size = 16, className }: IconProps) {
  return <Star size={size} className={className} aria-hidden="true" />;
}

export function IconArrowRight({ size = 16, className }: IconProps) {
  return <ArrowRight size={size} className={className} aria-hidden="true" />;
}

export function IconFlag({ size = 16, className }: IconProps) {
  return <Flag size={size} className={className} aria-hidden="true" />;
}

export function IconTarget({ size = 16, className }: IconProps) {
  return <Target size={size} className={className} aria-hidden="true" />;
}
