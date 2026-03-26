# Plan 01: Missing Components — Build Spec

> **For:** Sasha (frontend) | **Status:** Ready for implementation
> **Base branch:** `main` | **Priority:** Desktop + Comfortable only
> **Pattern reference:** Follow existing components in `src/components/ui/`
> **Reviewed:** Cycles 1-3. Cycle 3 = simulation (built Report page + Entity Detail page from library). All gaps incorporated.

## Codebase Conventions

Before building, study these patterns from existing components:

- **File location:** `src/components/ui/{ComponentName}.tsx`
- **CSS classes:** `st-{component}` base, `st-{component}--{variant}` modifiers, `st-{component}__{element}` children (BEM-like)
- **CSS location:** All styles go in `src/styles/app.css` (search for existing `st-*` blocks to find the right section)
- **Props pattern:** Export interface `{Component}Props`, use `className?: string` on all components, use `filter(Boolean).join(' ')` for class composition
- **forwardRef:** Use on interactive elements (buttons, inputs). Not needed for display-only components.
- **Tokens only:** Zero hardcoded `#hex`, `px` font-sizes, or `rgba()`. Everything via `var(--color-*)`, `var(--type-*)`, `var(--space-*)`, `var(--radius-*)`, `var(--shadow-*)`
- **Smoke test:** Add a render test to `src/components/ui/__tests__/ui-smoke.test.tsx`
- **Demo:** Add a `<Section>` demo block to the atoms page (currently `src/pages/DesignSystemPage.tsx`, will become `DesignSystemAtomsPage.tsx`)

---

## Phase Structure

**Phase 1** (this document): Token foundation + 11 components (8 original + 3 layout primitives). Enables instant page assembly.

**Phase 2** (deferred, separate doc): Grid/Col, Tabs, Modal, Select, SimpleTable, TableOfContents, Figure, EmptyState, Tooltip, Toast, Pagination, useBreakpoint. None of these block page assembly — build when a real feature needs them.

---

## 0. Token Prerequisites

> **CRITICAL:** Complete these before building any component. They affect every component's rendering.

### 0a. Icon Size Reconciliation

Current tokens are not on the 4px grid and conflict with the Icon component spec. **Migrate in `app.css` `:root`:**

```css
/* BEFORE (current — line 97-100 of app.css) */
--icon-xs: 12px;
--icon-sm: 14px;  /* not on 4px grid */
--icon-md: 16px;
--icon-lg: 20px;

/* AFTER */
--icon-xs: 12px;
--icon-sm: 16px;   /* 14→16, aligns to 4px grid */
--icon-md: 20px;   /* 16→20 */
--icon-lg: 24px;   /* 20→24 */
--icon-xl: 32px;   /* new */
```

**Impact:** Grep for `var(--icon-sm)`, `var(--icon-md)`, `var(--icon-lg)` in `app.css` and all `.tsx` files. Audit each usage — the 2-4px size increase may need padding/margin adjustments on surrounding elements.

### 0b. Z-Index Tokens

Required by Plan 02 footer and future Modal/Tooltip components. Add to `:root`:

```css
--z-base: 0;
--z-sticky: 10;
--z-dropdown: 20;
--z-header: 50;
--z-toolbar: 99;
--z-footer: 100;
--z-tooltip: 999;
--z-overlay: 9000;
--z-modal: 9999;
```

After adding: grep for all hardcoded `z-index:` values in `app.css` and migrate the most critical ones (header, footer, tooltips) to tokens. Low-priority ones can be migrated incrementally.

### 0c. Focus Ring Token

The global `:focus-visible` rule at line 324 of `app.css` uses `var(--black)` which is invisible on dark themes. Fix:

```css
/* Replace line 324-327 */
:focus-visible {
  outline: none;
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-accent) 35%, transparent);
}
```

**Note:** Retrofitting `:focus-visible` across all 43 existing interactive components is Phase 2 work. For now, just fix the global rule. New components built in this plan should use the same direct focus shadow treatment.

### 0d. Line-Height Tokens

```css
--leading-tight: 1.2;    /* headings */
--leading-snug: 1.35;    /* subheadings, UI text */
--leading-normal: 1.5;   /* body text */
--leading-relaxed: 1.7;  /* prose, long-form reading */
```

### 0e. Fix `--shadow-soft` White Inset

Lines 85-86 of `app.css` contain hardcoded `#FFF inset` shadows that produce visible white lines on dark themes:

```css
/* BEFORE */
0 -2.15px 2.15px 0 #FFF inset,
0 2.15px 2.15px 0 #FFF inset;

/* AFTER — remove both inset lines entirely */
```

The inset effect is invisible on light themes and destructive on dark themes. Just remove them.

### 0f. Fix Beige Surface Hierarchy Collapse

`--color-surface` and `--color-surface-raised` are BOTH `#FFFFFF` on Beige (lines 16-17, 119-120). This collapses the 3-level depth system — cards inside modals are invisible.

```css
/* In [data-theme="beige"] block: */
--color-surface-raised: #FAF9F6;  /* was #FFFFFF — now has perceptible warmth step */
```

### 0g. Fix NearBlack WCAG AA Contrast Failure

`--color-text-secondary` on NearBlack is `#7C7C78` on `#1C1C1A` surface = 3.8:1 contrast ratio, below WCAG AA minimum of 4.5:1.

```css
/* In [data-theme="nearblack"] block: */
--color-text-secondary: #8A8A86;  /* was #7C7C78 — now ≈4.6:1 on #1C1C1A */
```

### 0h. NearBlack Border Enforcement (CSS)

**Hard rule:** On NearBlack, every surface-level element (card, table, input, dropdown) MUST have a visible border. Shadows alone (`rgba(0,0,0,...)` on near-black backgrounds) provide zero perceptible depth.

**Implementation:** Add this theme-scoped override block to `app.css` after the NearBlack token definitions:

```css
[data-theme="nearblack"] .st-content-card,
[data-theme="nearblack"] .st-callout,
[data-theme="nearblack"] .st-data-table,
[data-theme="nearblack"] .st-stat-card,
[data-theme="nearblack"] .st-author-card,
[data-theme="nearblack"] .st-testimonial-card,
[data-theme="nearblack"] .st-filter-chip,
[data-theme="nearblack"] .st-input,
[data-theme="nearblack"] .st-segmented,
[data-theme="nearblack"] .st-timeline::before {
  border-color: var(--color-border-strong);
}
```

> **Cycle 3 finding:** Simulation revealed that `--color-border` at `rgba(255,255,250, 0.06)` is invisible on NearBlack across ALL card types — ContentCard, DataTable, FilterChip, sidebar cards, Timeline vertical line. Rule 0h existed in documentation but zero components enforced it. This CSS block is the enforcement mechanism.

### 0i. `--content-max-width` — Keep at 1200px

The plan originally proposed 1280px, but this token is referenced in 5+ layout patterns across `app.css` (lines 94, 2745, 3347, 6035+). Changing it is a visual breaking change on every page. **Keep at 1200px.** If we decide to widen later, it requires a separate audit + visual regression pass.

---

## 1. Icon (`src/components/ui/Icon.tsx`)

Unified icon component that wraps both lucide-react icons and custom BulletIcons.

### Props

```typescript
import type { LucideIcon } from 'lucide-react';
import type { ReactNode, CSSProperties } from 'react';

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface IconProps {
  /** Lucide icon component, e.g. Search, ChevronDown */
  icon?: LucideIcon;
  /** Custom SVG ReactNode (for BulletIcons or one-off SVGs) */
  children?: ReactNode;
  size?: IconSize;
  color?: 'main' | 'secondary' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'inherit';
  className?: string;
  style?: CSSProperties;
  /** Accessible label; omit for decorative icons (adds aria-hidden) */
  label?: string;
}
```

### Size map

| Size | Token | px | Usage |
|------|-------|----|-------|
| `xs` | `--icon-xs` | 12 | Inline with caption text |
| `sm` | `--icon-sm` | 16 | Default — inline with body text, BulletItem markers |
| `md` | `--icon-md` | 20 | Buttons, nav items |
| `lg` | `--icon-lg` | 24 | Section headers, standalone |
| `xl` | `--icon-xl` | 32 | Hero, feature blocks |

> **Requires:** Token prerequisite 0a (icon size reconciliation) must be complete before building this component.

### CSS classes

```css
.st-icon { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
.st-icon--xs { width: var(--icon-xs); height: var(--icon-xs); }
.st-icon--sm { width: var(--icon-sm); height: var(--icon-sm); }
.st-icon--md { width: var(--icon-md); height: var(--icon-md); }
.st-icon--lg { width: var(--icon-lg); height: var(--icon-lg); }
.st-icon--xl { width: var(--icon-xl); height: var(--icon-xl); }
.st-icon--main { color: var(--color-text-main); }
.st-icon--secondary { color: var(--color-text-secondary); }
.st-icon--accent { color: var(--color-accent); }
.st-icon--success { color: var(--color-success); }
.st-icon--warning { color: var(--color-warning); }
.st-icon--danger { color: var(--color-danger); }
.st-icon--info { color: var(--color-info); }
```

### Implementation notes

- If `icon` prop is provided (lucide), render `<icon size={pxSize} />` inside the wrapper
- If `children` is provided, render children directly (for custom SVGs)
- If neither, render nothing
- If `label` is provided: `aria-label={label}` + `role="img"`. Otherwise: `aria-hidden="true"`
- Do NOT re-export all lucide icons. The consumer imports lucide icons themselves and passes them via the `icon` prop.

### Smoke test

```typescript
it('Icon renders with lucide icon', () => {
  const { Search } = require('lucide-react');
  render(<Icon icon={Search} size="md" />);
});

it('Icon renders with children', () => {
  render(<Icon size="sm"><svg><circle cx="8" cy="8" r="4" /></svg></Icon>);
});
```

---

## 2. Label (`src/components/ui/Label.tsx`)

Semantic `<label>` element with consistent typography.

### Props

```typescript
import type { LabelHTMLAttributes, ReactNode } from 'react';

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  children: ReactNode;
  required?: boolean;
  size?: 'default' | 'sm';
  disabled?: boolean;
}
```

### CSS classes

```css
.st-label {
  display: block;
  font-family: var(--font-body);
  font-size: var(--type-body-sm);
  font-weight: 600;
  color: var(--color-text-main);
  margin-bottom: var(--space-1);
  line-height: 1.4;
}
.st-label--sm {
  font-size: var(--type-caption);
}
.st-label--disabled {
  color: var(--color-text-secondary);
  opacity: 0.6;
}
.st-label__required {
  color: var(--color-danger);
  margin-left: var(--space-0-5);
}
```

### Implementation

```tsx
export default function Label({ children, required, size, disabled, className, ...rest }: LabelProps) {
  const classes = [
    'st-label',
    size === 'sm' && 'st-label--sm',
    disabled && 'st-label--disabled',
    className,
  ].filter(Boolean).join(' ');

  return (
    <label className={classes} {...rest}>
      {children}
      {required && <span className="st-label__required" aria-hidden="true">*</span>}
    </label>
  );
}
```

### Note

This replaces the inline `.st-field-label` CSS class that `LoginPage.tsx` and `SignupPage.tsx` currently use. Those pages can be migrated to use `<Label>` later (not in this scope).

---

## 3. StyledLink (`src/components/ui/StyledLink.tsx`)

Design-system link with token-based styling, supports internal (react-router) and external links.

### Props

```typescript
import type { ReactNode, AnchorHTMLAttributes } from 'react';

export type LinkVariant = 'default' | 'accent' | 'muted';

export interface StyledLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: string;
  children: ReactNode;
  variant?: LinkVariant;
  external?: boolean;
  /** Show arrow icon after text for external links */
  showExternal?: boolean;
  className?: string;
}
```

### CSS classes

```css
.st-link {
  font-family: var(--font-body);
  color: var(--color-text-main);
  text-decoration: underline;
  text-decoration-color: var(--color-border-strong);
  text-underline-offset: 3px;
  transition: color 150ms ease, text-decoration-color 150ms ease;
  cursor: pointer;
}
.st-link:hover {
  color: var(--color-accent);
  text-decoration-color: var(--color-accent);
}
.st-link--accent {
  color: var(--color-accent);
  text-decoration-color: transparent;
}
.st-link--accent:hover {
  text-decoration-color: var(--color-accent);
}
.st-link--muted {
  color: var(--color-text-secondary);
  text-decoration: none;
}
.st-link--muted:hover {
  color: var(--color-text-main);
}
.st-link__external-icon {
  display: inline-block;
  margin-left: var(--space-0-5);
  opacity: 0.5;
  vertical-align: middle;
}
```

### Implementation notes

- If `external` is true (or `to` starts with `http`): render `<a href={to} target="_blank" rel="noopener noreferrer">`
- Otherwise: render `<Link to={to}>` from `react-router-dom`
- If `showExternal` and it's external: append a small arrow-up-right icon (lucide `ExternalLink` at 12px)

---

## 4. Avatar (`src/components/ui/Avatar.tsx`)

### Props

```typescript
import type { CSSProperties } from 'react';

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';
export type AvatarShape = 'circle' | 'rounded';

export interface AvatarProps {
  /** Image URL */
  src?: string;
  /** Full name — used for initials fallback and alt text */
  name: string;
  size?: AvatarSize;
  shape?: AvatarShape;
  className?: string;
  style?: CSSProperties;
}
```

### Size map

| Size | px  | Font size | Usage |
|------|-----|-----------|-------|
| `sm` | 28  | `--type-micro` | Inline, table rows |
| `md` | 40  | `--type-body-sm` | Default — cards, testimonials |
| `lg` | 56  | `--type-body-lg` | Author cards |
| `xl` | 80  | `--type-heading-3` | Profile headers |

### CSS classes

```css
.st-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--color-accent-subtle);
  color: var(--color-accent);
  font-family: var(--font-body);
  font-weight: 600;
  text-transform: uppercase;
  user-select: none;
}
.st-avatar--circle { border-radius: 50%; }
.st-avatar--rounded { border-radius: var(--radius-md); }
.st-avatar--sm { width: 28px; height: 28px; font-size: var(--type-micro); }
.st-avatar--md { width: 40px; height: 40px; font-size: var(--type-body-sm); }
.st-avatar--lg { width: 56px; height: 56px; font-size: var(--type-body-lg); }
.st-avatar--xl { width: 80px; height: 80px; font-size: var(--type-heading-3); }
.st-avatar__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
```

### Implementation notes

- If `src` is provided: render `<img>` with `alt={name}` and `loading="lazy"`
- If no `src`: extract initials from `name` (first letter of first + last word), render as text
- Default: `size="md"`, `shape="circle"`

---

## 5. Image (`src/components/ui/Image.tsx`)

Theme-aware image wrapper with lazy loading and aspect ratio support.

### Props

```typescript
import type { ImgHTMLAttributes } from 'react';

export interface ImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'loading'> {
  /** Aspect ratio string, e.g. "16/9", "4/3", "1/1" */
  aspectRatio?: string;
  rounded?: boolean;
  /** Theme-aware border */
  bordered?: boolean;
  className?: string;
}
```

### CSS classes

```css
.st-image {
  display: block;
  overflow: hidden;
  background: var(--color-surface);
}
.st-image--rounded {
  border-radius: var(--radius-lg);
}
.st-image--bordered {
  border: 1px solid var(--color-border);
}
.st-image__img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
```

### Implementation notes

- Always set `loading="lazy"` on the `<img>`
- If `aspectRatio` is set: apply `style={{ aspectRatio }}` on the wrapper div
- The `<img>` fills the wrapper via `object-fit: cover`
- Future: `lightbox` prop (not implemented now — just accept and ignore the prop)

---

## 6. BulletSection (`src/components/ui/BulletSection.tsx`)

Wrapper organism that groups BulletItems under a heading with consistent spacing.

### Props

```typescript
import type { ReactNode } from 'react';

export type BulletSectionVariant = 'findings' | 'checklist' | 'status' | 'default';

export interface BulletSectionProps {
  title: string;
  variant?: BulletSectionVariant;
  children: ReactNode;
  className?: string;
}
```

### CSS classes

```css
.st-bullet-section {
  display: flex;
  flex-direction: column;
}
.st-bullet-section__title {
  font-family: var(--font-body);
  font-size: var(--type-body-sm);
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--space-2);
}
.st-bullet-section .st-bullet-item {
  /* inherits spacing from BulletItem */
}
```

### Implementation notes

- Renders a `<div>` with title `<h4>` + `{children}` (which should be `<BulletItem>` components)
- The `variant` prop exists for future use (e.g., auto-applying icons to child BulletItems) — for now, just pass it as a data attribute or class modifier
- Pattern: see how the DesignSystemPage currently renders BulletItem groups manually (lines 962-998) — BulletSection replaces that boilerplate

---

## 7. AuthForm (`src/components/ui/AuthForm.tsx`)

Reusable auth form organism built from library atoms (Input, Label, Button).

### Props

```typescript
export type AuthFormMode = 'login' | 'signup' | 'forgot';

export interface AuthFormProps {
  mode: AuthFormMode;
  onSubmit: (data: { email: string; password?: string; name?: string }) => void | Promise<void>;
  error?: string;
  loading?: boolean;
  className?: string;
}
```

### Field configuration by mode

| Mode | Fields | Submit label |
|------|--------|-------------|
| `login` | Email + Password | "Sign In" |
| `signup` | Name + Email + Password | "Create Account" |
| `forgot` | Email | "Send Reset Link" |

### CSS classes

Reuses existing `st-auth-form` from `app.css` (already defined at line ~2466). New modifiers:

```css
.st-auth-form__error {
  /* same as existing st-auth-error */
  background: var(--color-danger-subtle);
  color: var(--color-danger);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  font-size: var(--type-body-sm);
  margin-bottom: var(--space-3);
}
.st-auth-form__footer {
  margin-top: var(--space-4);
  text-align: center;
  font-size: var(--type-body-sm);
  color: var(--color-text-secondary);
}
```

### Implementation notes

- Uses `<Label>`, `<Input>`, `<Button>` from the library
- Does NOT handle routing, redirects, or auth logic — that stays in page components
- The existing `LoginPage.tsx` (line 74) uses inline `<form className="st-auth-form">` — this component extracts that pattern
- Renders `<form>` with `onSubmit`, calls `props.onSubmit()` with field values
- Shows `props.error` if provided
- Button shows loading state via `props.loading`

---

## 8. TestimonialCarousel (`src/components/ui/TestimonialCarousel.tsx`)

Carousel that rotates through TestimonialCards.

### Props

```typescript
import type { TestimonialCardProps } from './TestimonialCard';

export interface TestimonialCarouselProps {
  items: TestimonialCardProps[];
  /** Auto-advance interval in ms. 0 = no auto. Default: 5000 */
  autoPlay?: number;
  className?: string;
}
```

### CSS classes

```css
.st-testimonial-carousel {
  position: relative;
  overflow: hidden;
}
.st-testimonial-carousel__track {
  display: flex;
  transition: transform 400ms ease;
}
.st-testimonial-carousel__slide {
  flex: 0 0 100%;
  min-width: 0;
}
.st-testimonial-carousel__dots {
  display: flex;
  justify-content: center;
  gap: var(--space-2);
  margin-top: var(--space-4);
}
.st-testimonial-carousel__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-border-strong);
  border: none;
  padding: 0;
  cursor: pointer;
  transition: background 200ms ease;
}
.st-testimonial-carousel__dot.is-active {
  background: var(--color-accent);
}
.st-testimonial-carousel__nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 50%;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: color 150ms ease, border-color 150ms ease;
  z-index: 2;
}
.st-testimonial-carousel__nav:hover {
  color: var(--color-text-main);
  border-color: var(--color-border-strong);
}
.st-testimonial-carousel__nav--prev { left: var(--space-2); }
.st-testimonial-carousel__nav--next { right: var(--space-2); }
```

### Implementation notes

- State: `activeIndex` (controlled by dots, arrows, and auto-play timer)
- Track slides via `transform: translateX(-${activeIndex * 100}%)`
- Auto-play: `useEffect` with `setInterval`, pauses on hover (`onMouseEnter`/`onMouseLeave`)
- Prev/next arrows: use `ChevronLeft`/`ChevronRight` from lucide-react
- Each slide renders `<TestimonialCard {...item} />`
- Dots: one per item, click to jump

---

## 9. Container (`src/components/ui/Container.tsx`)

Pure max-width constraint wrapper. Use in non-section contexts (header inner content, footer, standalone).

> For section-level containment, use `Section` with its `maxWidth` prop instead — see component 11.

### Props

```typescript
import type { ReactNode, CSSProperties } from 'react';

export type ContainerVariant = 'default' | 'wide' | 'prose' | 'narrow';

export interface ContainerProps {
  variant?: ContainerVariant;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}
```

### Variant map

| Variant | Max-width | Usage |
|---------|-----------|-------|
| `default` | `var(--content-max-width)` (1200px) | Standard page content |
| `wide` | `100%` | Full-width sections (header, footer inner) |
| `prose` | `720px` | Article/report body text |
| `narrow` | `640px` | Auth forms, dialogs |

### CSS classes

```css
.st-container {
  width: 100%;
  margin-inline: auto;
  padding-inline: var(--grid-margin, var(--space-8));
}
.st-container--default { max-width: var(--content-max-width); }
.st-container--wide { max-width: 100%; }
.st-container--prose { max-width: 720px; }
.st-container--narrow { max-width: 640px; }
```

### Implementation notes

- Renders `<div>` with the appropriate class
- Default variant: `default`
- `padding-inline` provides the gutter between content and viewport edge

---

## 10. Stack (`src/components/ui/Stack.tsx`)

Flex layout primitive for arranging children with consistent spacing.

### Props

```typescript
import type { ReactNode, CSSProperties } from 'react';

export type StackDirection = 'column' | 'row';
export type StackGap = 0 | 1 | 2 | 3 | 4 | 6 | 8 | 10 | 12 | 16;
export type StackAlign = 'start' | 'center' | 'end' | 'stretch' | 'baseline';
export type StackJustify = 'start' | 'center' | 'end' | 'between' | 'around';

export interface StackProps {
  gap?: StackGap;
  direction?: StackDirection;
  wrap?: boolean;
  align?: StackAlign;
  justify?: StackJustify;
  children: ReactNode;
  as?: 'div' | 'ul' | 'ol' | 'nav';
  className?: string;
  style?: CSSProperties;
}
```

### CSS classes

```css
.st-stack {
  display: flex;
}
.st-stack--column { flex-direction: column; }
.st-stack--row { flex-direction: row; }
.st-stack--wrap { flex-wrap: wrap; }
.st-stack--align-start { align-items: flex-start; }
.st-stack--align-center { align-items: center; }
.st-stack--align-end { align-items: flex-end; }
.st-stack--align-stretch { align-items: stretch; }
.st-stack--align-baseline { align-items: baseline; }
.st-stack--justify-start { justify-content: flex-start; }
.st-stack--justify-center { justify-content: center; }
.st-stack--justify-end { justify-content: flex-end; }
.st-stack--justify-between { justify-content: space-between; }
.st-stack--justify-around { justify-content: space-around; }
```

### Implementation notes

- Gap is applied via `style={{ gap: 'var(--space-{n})' }}` using the numeric `gap` prop mapped to the spacing token
- Default: `direction="column"`, `gap={4}`, `align="stretch"`
- Renders `<div>` by default, `as` prop allows semantic element override
- **Layout-agnostic spacing:** Stack does NOT respond to mode toggles. Gap is always what you set.

---

## 11. Section (`src/components/ui/Section.tsx`)

Semantic section wrapper that handles containment, vertical spacing, and scroll anchoring. This is the primary building block for page layout.

> Section absorbs Container's role for section-level contexts. Use `Container` only when you need max-width outside a section (header, footer).

### Props

```typescript
import type { ReactNode, CSSProperties } from 'react';

export type SectionSpacing = 'flush' | 'tight' | 'default' | 'loose';
export type SectionMaxWidth = 'default' | 'wide' | 'prose' | 'narrow' | 'full';
export type SectionSurface = 'base' | 'raised' | 'inverse';

export interface SectionProps {
  id?: string;
  title?: string;
  spacing?: SectionSpacing;
  maxWidth?: SectionMaxWidth;
  /** Break out of parent container for full-viewport background */
  bleed?: boolean;
  /** Surface level — controls bg color and scopes token resolution.
   *  'inverse' applies data-theme="nearblack" so all child tokens
   *  resolve against the dark palette (fixes dark hero on light pages). */
  surface?: SectionSurface;
  /** Override internal padding when spacing="flush" but you need internal room */
  paddingBlock?: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}
```

### Spacing presets

| Preset | Top padding | Bottom padding | Usage |
|--------|------------|----------------|-------|
| `flush` | 0 | 0 | Hero sections, sections with own background padding |
| `tight` | `var(--space-8)` (32px) | `var(--space-8)` | Related content within same topic |
| `default` | `var(--space-16)` (64px) | `var(--space-16)` | Standard section-to-section |
| `loose` | `var(--space-24)` (96px) | `var(--space-24)` | Page top, major topic shifts |

### CSS classes

```css
.st-section {
  width: 100%;
  margin-inline: auto;
  padding-inline: var(--grid-margin, var(--space-8));
  scroll-margin-top: calc(var(--header-current-height, 64px) + var(--top-banner-height, 0px) + 70px);
}
.st-section--default-width { max-width: var(--content-max-width); }
.st-section--wide-width { max-width: 100%; }
.st-section--prose-width { max-width: 720px; }
.st-section--narrow-width { max-width: 640px; }
.st-section--full-width { max-width: none; padding-inline: 0; }

.st-section--flush { padding-top: 0; padding-bottom: 0; }
.st-section--tight { padding-top: var(--space-8); padding-bottom: var(--space-8); }
.st-section--default { padding-top: var(--space-16); padding-bottom: var(--space-16); }
.st-section--loose { padding-top: var(--space-24); padding-bottom: var(--space-24); }

.st-section--bleed {
  width: 100vw;
  margin-left: calc(-50vw + 50%);
  max-width: none;
}
.st-section--bleed > .st-section__inner {
  max-width: var(--content-max-width);
  margin-inline: auto;
  padding-inline: var(--grid-margin, var(--space-8));
}

/* Surface variants */
.st-section--surface-base { background: var(--color-bg); }
.st-section--surface-raised { background: var(--color-surface); }
/* 'inverse' is handled via data-theme="nearblack" attribute, not a CSS class */
```

### Implementation notes

- Renders `<section>` element with `id` prop for anchor links
- If `title` is provided, renders an `<h2>` with class `st-section__title` (heading role, uppercase)
- If `bleed` is true, the section stretches to viewport width. Content is constrained inside `.st-section__inner` div
- Default: `spacing="default"`, `maxWidth="default"`, `bleed={false}`, `surface` unset (transparent)
- If `surface="inverse"`, set `data-theme="nearblack"` on the `<section>` element. This scopes all child token resolution to the NearBlack palette — Heading, CalloutStat, AuthorCard, etc. will automatically get light text on dark background. This is how Stripe/Radix handle forced-dark sections.
- If `surface="raised"`, set `background: var(--color-surface)` and add `border: 1px solid var(--color-border)` (NearBlack needs visible boundary).
- If `paddingBlock` is provided, use it as `padding-block` on the wrapper even when `spacing="flush"`. This handles the hero pattern: full-bleed + flush external spacing + internal vertical padding.
- `title` prop renders `<Heading level={2}>` internally. If you need a different level, omit `title` and render your own `<Heading>` as a child.
- `bleed` + `maxWidth="full"` conflict: `bleed` ALWAYS creates a constrained `.st-section__inner`. If you want viewport-width content inside a bleed, use `maxWidth="wide"` (100% with padding-inline). `maxWidth="full"` removes padding-inline and is incompatible with `bleed`. Emit `console.warn` in dev mode if both are set.
- **Layout-agnostic spacing:** Section spacing does NOT change with mode toggles. It's a layout coordinate, not a content property.
- The `scroll-margin-top` accounts for the site header + DS header. This value is set via CSS, not inline style.

---

## Smoke Tests

Add to `src/components/ui/__tests__/ui-smoke.test.tsx`:

```typescript
// New imports at top of file
import Icon from '../Icon';
import Label from '../Label';
import StyledLink from '../StyledLink';
import Avatar from '../Avatar';
import Image from '../Image';
import BulletSection from '../BulletSection';
import AuthForm from '../AuthForm';
import TestimonialCarousel from '../TestimonialCarousel';

// New tests inside describe('UI smoke tests', ...)
it('Icon renders', () => {
  render(<Icon size="md"><svg><circle cx="8" cy="8" r="4" /></svg></Icon>);
});

it('Label renders', () => {
  render(<Label htmlFor="test">Test Label</Label>);
});

it('StyledLink renders', () => {
  render(<R><StyledLink to="/test">Test</StyledLink></R>);
});

it('Avatar renders with name', () => {
  render(<Avatar name="Anton Titov" />);
});

it('Avatar renders with src', () => {
  render(<Avatar name="Anton Titov" src="/photo.png" />);
});

it('Image renders', () => {
  render(<Image src="/test.png" alt="Test" />);
});

it('BulletSection renders', () => {
  render(<BulletSection title="Findings"><div>Item</div></BulletSection>);
});

it('AuthForm renders login mode', () => {
  render(<R><AuthForm mode="login" onSubmit={() => {}} /></R>);
});

it('AuthForm renders signup mode', () => {
  render(<R><AuthForm mode="signup" onSubmit={() => {}} /></R>);
});

it('TestimonialCarousel renders', () => {
  render(<TestimonialCarousel items={[
    { quote: 'Great', authorName: 'Test', authorRole: 'Dev' }
  ]} />);
});

it('Container renders', () => {
  render(<Container variant="prose">Content</Container>);
});

it('Stack renders', () => {
  render(<Stack gap={4} direction="row"><div>A</div><div>B</div></Stack>);
});

it('Section renders with id', () => {
  render(<Section id="test" title="Test Section">Content</Section>);
});

it('Section renders with bleed', () => {
  render(<Section bleed spacing="flush">Full width content</Section>);
});
```

Note: `R` is the `MemoryRouter` wrapper already defined at top of the test file.

---

## Phase 2 — Deferred Components

The following were identified during review but do NOT block page assembly. Build them when a real feature or page requires them:

| Component | Reason to defer |
|-----------|----------------|
| **Grid/Col** | Container + Stack + CSS grid classes cover real layouts. The 12-col component is for documenting the grid, not assembling pages. |
| **Tabs/TabList/Tab/TabPanel** | No current page needs in-page tabs. DS page tabs are route-based (NavLink). |
| **Modal** | No page currently requires a modal. Focus trap + scroll lock is complex to build correctly. |
| **Select** | Native `<select>` with `st-*` styling works. Custom Select (keyboard nav, combobox, portal) is a rabbit hole. |
| **SimpleTable** | HTML `<table>` with `st-table` classes exists. Component wrapper adds marginal value. |
| **TableOfContents** | DS sidebar already does this. IntersectionObserver scroll tracking is polish. |
| **Figure** | A `<figure>` tag with Image inside is trivial inline. Worth a component only at 5+ instances. |
| **EmptyState** | UX polish, not structural. |
| **Tooltip** | Requires positioning engine (Floating UI). Build when a feature needs it. |
| **Toast** | Needs portal, animation, queue, auto-dismiss. Zero current usage. |
| **Pagination** | Extraction from DataTable requires careful API surgery. Do when something else needs pagination. |
| **useBreakpoint** | JS hook only needed for conditional rendering, not restyling. Media queries suffice. |

**Also deferred:**
- CSS `@layer` introduction — cascade-reordering risk, separate work package
- Focus state retrofit across 43 existing components — token added now, retrofit is Phase 2
- KeyValueGrid (for entity detail info grids) — use CSS grid inline for now
- CountryFlag component — use flag emoji for now
- ProseWithSidebar layout (callout floating beside prose) — vertical stack for now

---

## Cycle 3 Findings: Existing Component Fixes

Simulation revealed that existing components need these small fixes for page assembly to work. These are NOT new components — they're patches to things that already exist.

### Button — Variant and Size Vocabulary Mismatch

Current implementation has `variant: 'primary' | 'outline'` and `size: 'default' | 'sm'`.
Report/Landing pages need `secondary`, `ghost`, `danger` variants and `lg` size.

**Add:**

```typescript
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
export type ButtonSize = 'sm' | 'default' | 'lg';
```

```css
/* secondary = outline with filled bg on hover */
.st-btn--secondary {
  background: transparent;
  color: var(--color-text-main);
  border: 1px solid var(--color-border-strong);
}
.st-btn--secondary:hover {
  background: var(--color-surface-raised);
}
/* ghost = no border, just text */
.st-btn--ghost {
  background: transparent;
  color: var(--color-text-secondary);
  border: 1px solid transparent;
}
.st-btn--ghost:hover {
  color: var(--color-text-main);
  background: var(--color-surface-raised);
}
/* danger = red for destructive actions */
.st-btn--danger {
  background: var(--color-danger);
  color: var(--color-bg);
  border: 1px solid var(--color-danger);
}
/* lg = prominent CTA */
.st-btn--lg {
  padding: var(--space-3) var(--space-8);
  font-size: var(--type-body-lg);
}
```

### ContentCard — Multi-Badge Gap

Multiple badges in a Fragment render without gap. One-line CSS fix:

```css
.st-content-card__badge {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}
```

### Callout — Add `tip` Variant

```css
.st-callout--tip {
  border-left-color: var(--color-accent);
  background: var(--color-accent-subtle);
}
```

Type update: `variant?: 'default' | 'accent' | 'warning' | 'info' | 'success' | 'tip'`

### DataTable — Add `hideSearch` and `hidePagination` Props

Report pages use DataTable for static data display where search/pagination controls are noise.

```typescript
interface DataTableProps {
  // ...existing
  hideSearch?: boolean;
  hidePagination?: boolean;
}
```

Default: `false` (backwards compatible).

### BigStatRow — Font Override

BigStatRow forces the heading role on all values, but LEI fragments and country names aren't numeric data. Add:

```typescript
interface BigStatRowProps {
  // ...existing
  valueFont?: 'display' | 'body';  // default: 'display' (heading role)
}
```

### AuthorCard / TestimonialCard — Compose Avatar

Once Avatar component ships, refactor these to use `<Avatar>` internally instead of raw `<img>`. This gives initials fallback when no image is provided. Non-breaking — same visual output with images.

### Button — Add `leftIcon` Prop (optional)

```typescript
interface ButtonProps {
  // ...existing
  leftIcon?: ReactNode;
}
```

Renders icon before children with `gap: var(--space-2)` and uses Icon component sizing.
