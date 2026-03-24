# Plan 02: Page Architecture — Multi-Page Design System

> **For:** Sasha (frontend) | **Status:** Ready for implementation
> **Depends on:** Plan 01 token prerequisites (0b z-index tokens) must be done first. Component work can be parallel.
> **Reviewed:** Cycles 1-3. Updated post-Cycle 3 with per-component reference pages (Tailwind-style individual routes).

## Current State

Everything lives in a single file:
- `src/pages/DesignSystemPage.tsx` (~1315 lines)
- Route: `/ui` and `/ui/*` in `App.tsx` (lines 71-72)
- Theme controls in a sticky toolbar at the top
- Left sidebar with anchor links to sections

## Target State

Routed sub-pages with a shared layout shell and per-component reference pages:

```
/ui                      → redirects to /ui/atoms
/ui/atoms                → Component catalog (index grid with search/filter)
/ui/atoms/:componentId   → Per-component reference page (props, variants, code)
/ui/composition          → Layout patterns & spacing rules (Plan 03)
/ui/templates            → Section-level page recipes (Plan 03)
```

---

## New File Structure

```
src/pages/
  design-system/
    DesignSystemLayout.tsx          ← Shared shell: header + sidebar + sticky footer
    DesignSystemAtomsIndex.tsx      ← Component catalog grid (search, filter, cards)
    DesignSystemAtomPage.tsx        ← Per-component reference (dynamic route)
    DesignSystemCompositionPage.tsx  ← New (Plan 03)
    DesignSystemTemplatesPage.tsx   ← New (stub for now)
    component-registry.ts           ← Metadata for all components (props, classes, status)
```

---

## Step 1: Create `DesignSystemLayout.tsx`

This is the shared wrapper for all /ui/* pages. It provides:
1. **Header bar** — branding + tab navigation
2. **Sidebar** — section anchors (different per page, passed as prop)
3. **Content area** — renders child route via `<Outlet />`
4. **Sticky footer** — theme + viewport controls

### Structure

```tsx
import { Outlet, NavLink, Navigate } from 'react-router-dom';
import { useState } from 'react';
import { useTheme, THEMES } from '../../context/ThemeProvider';
import type { Theme } from '../../context/ThemeProvider';

const THEME_LABELS: Record<Theme, string> = {
  beige: 'Beige',
  darkgray: 'Dark Gray',
  nearblack: 'Near Black',
};

const TAB_LINKS = [
  { to: '/ui/atoms', label: 'Components' },
  { to: '/ui/composition', label: 'Composition' },
  { to: '/ui/templates', label: 'Templates' },
];

export default function DesignSystemLayout() {
  const { theme, setTheme } = useTheme();
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop');

  return (
    <div style={{ /* same wrapper styles as current */ }}>

      {/* ── Header ── */}
      <div className="st-ds-header">
        <span className="st-ds-header__brand">RemiDe UI</span>
        <nav className="st-ds-header__tabs">
          {TAB_LINKS.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                ['st-ds-header__tab', isActive && 'is-active'].filter(Boolean).join(' ')
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* ── Main area: sidebar + content ── */}
      <div className="st-ds-main">
        {/* Sidebar is rendered by each child page via context or prop */}
        <Outlet context={{ viewport }} />
      </div>

      {/* ── Sticky Footer ── */}
      <div className="st-ds-footer">
        {/* Theme */}
        <div className="st-ds-footer__group">
          <span className="st-ds-footer__label">Theme</span>
          {THEMES.map(t => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={['st-ds-footer__btn', theme === t && 'is-active'].filter(Boolean).join(' ')}
            >
              {THEME_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Viewport */}
        <div className="st-ds-footer__group">
          <span className="st-ds-footer__label">Viewport</span>
          {(['desktop', 'mobile'] as const).map(v => (
            <button
              key={v}
              onClick={() => setViewport(v)}
              className={['st-ds-footer__btn', viewport === v && 'is-active'].filter(Boolean).join(' ')}
              disabled={v === 'mobile'}  // placeholder — mobile not yet implemented
            >
              {v}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

### CSS for Layout Shell

Add to `app.css`:

```css
/* ── Design System Layout ── */

.st-ds-header {
  position: sticky;
  top: calc(var(--header-current-height, 64px) + var(--top-banner-height, 0px));
  z-index: 99;
  display: flex;
  align-items: center;
  gap: var(--space-6);
  padding: var(--space-2) var(--space-8);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border-strong);
  backdrop-filter: blur(12px);
}

.st-ds-header__brand {
  font-family: var(--font-heading);
  font-size: 18px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: -0.02em;
  flex-shrink: 0;
  color: var(--color-text-main);
}

.st-ds-header__tabs {
  display: flex;
  gap: var(--space-1);
}

.st-ds-header__tab {
  padding: var(--space-2) var(--space-4);
  font-family: var(--font-body);
  font-size: var(--type-body-sm);
  font-weight: 500;
  color: var(--color-text-secondary);
  text-decoration: none;
  border-bottom: 2px solid transparent;
  transition: color 150ms ease, border-color 150ms ease;
}

.st-ds-header__tab:hover {
  color: var(--color-text-main);
}

.st-ds-header__tab.is-active {
  color: var(--color-accent);
  border-bottom-color: var(--color-accent);
  font-weight: 600;
}

.st-ds-main {
  display: flex;
  min-height: calc(100vh - 52px - 44px);
}

/* ── Sticky Footer ── */

.st-ds-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: var(--z-footer);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-8);
  padding: var(--space-2) var(--space-6);
  background: var(--color-surface);
  border-top: 1px solid var(--color-border-strong);
  backdrop-filter: blur(12px);
  height: 44px;
}

.st-ds-footer__group {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.st-ds-footer__label {
  font-size: var(--type-micro);
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-right: var(--space-1);
}

.st-ds-footer__btn {
  padding: var(--space-1) var(--space-3);
  font-size: var(--type-micro);
  font-family: var(--font-body);
  font-weight: 500;
  background: transparent;
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  cursor: pointer;
  transition: background 150ms, color 150ms;
}

.st-ds-footer__btn:hover:not(:disabled) {
  color: var(--color-text-main);
}

.st-ds-footer__btn.is-active {
  background: var(--color-accent);
  color: var(--color-bg);  /* was #fff — must use token for NearBlack correctness */
  border-color: var(--color-accent);
  font-weight: 700;
}

.st-ds-footer__btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
```

---

## Step 2: Component Registry (`component-registry.ts`)

A single data file that drives both the index page and each per-component page. Every component registers its metadata here.

```typescript
// src/pages/design-system/component-registry.ts

export type ComponentCategory = 'atom' | 'molecule' | 'organism' | 'layout';
export type ComponentStatus = 'stable' | 'new' | 'experimental' | 'deprecated';

export interface PropDef {
  name: string;
  type: string;
  default?: string;
  required?: boolean;
  description: string;
}

export interface ComponentMeta {
  id: string;                       // URL slug: 'button', 'badge', 'section'
  name: string;                     // Display: 'Button', 'Badge', 'Section'
  description: string;              // One-liner for the catalog card
  category: ComponentCategory;
  status: ComponentStatus;
  props: PropDef[];
  cssClasses: string[];             // ['st-btn', 'st-btn--primary', ...]
  relatedComponents?: string[];     // IDs of related components
  importPath: string;               // '../components/ui/Button'
}

export const COMPONENT_REGISTRY: ComponentMeta[] = [
  {
    id: 'button',
    name: 'Button',
    description: 'Primary action trigger with multiple variants and sizes.',
    category: 'atom',
    status: 'stable',
    props: [
      { name: 'variant', type: "'primary' | 'secondary' | 'ghost' | 'danger'", default: "'primary'", description: 'Visual style' },
      { name: 'size', type: "'sm' | 'default' | 'lg'", default: "'default'", description: 'Size preset' },
      { name: 'disabled', type: 'boolean', default: 'false', description: 'Disable interaction' },
      { name: 'leftIcon', type: 'ReactNode', description: 'Icon before label' },
      { name: 'className', type: 'string', description: 'Additional CSS classes' },
    ],
    cssClasses: ['st-btn', 'st-btn--primary', 'st-btn--secondary', 'st-btn--ghost', 'st-btn--danger', 'st-btn--sm', 'st-btn--lg'],
    relatedComponents: ['styled-link', 'icon'],
    importPath: '../components/ui/Button',
  },
  // ... one entry per component, populated incrementally as components ship
];

export function getComponentById(id: string): ComponentMeta | undefined {
  return COMPONENT_REGISTRY.find(c => c.id === id);
}

export function getComponentsByCategory(cat: ComponentCategory): ComponentMeta[] {
  return COMPONENT_REGISTRY.filter(c => c.category === cat);
}
```

**Populate incrementally:** When building a Plan 01 component, add its registry entry at the same time. Existing components get their entries when demos are migrated from the old page.

---

## Step 2b: Atoms Index Page (`DesignSystemAtomsIndex.tsx`)

Replaces the old single-page gallery. Shows a searchable, filterable catalog of all components.

### Layout

- **Sidebar (left):** All components listed by category (Atoms, Molecules, Organisms, Layout). Each item is a `NavLink` to `/ui/atoms/:id`. Active item highlighted.
- **Content (right):** Card grid. Each card shows component name, description, category badge, status badge, and a mini live preview. Click navigates to `/ui/atoms/:id`.
- **Search bar** at top of content area filters by name/description.

### Sidebar structure

```typescript
const CATEGORY_ORDER: ComponentCategory[] = ['atom', 'molecule', 'organism', 'layout'];
const CATEGORY_LABELS: Record<ComponentCategory, string> = {
  atom: 'Atoms',
  molecule: 'Molecules',
  organism: 'Organisms',
  layout: 'Layout',
};
```

The sidebar persists on every `/ui/atoms/*` route — both the index and individual component pages — so developers can jump between components without returning to the index.

---

## Step 2c: Per-Component Reference Page (`DesignSystemAtomPage.tsx`)

Reads `:componentId` from URL params, looks up the registry, and renders a full reference page.

### Page sections

**1. Header** — Component name (heading role, H1), one-line description, category badge, status badge.

**2. Live Preview** — The component rendered with default props in a themed preview area. Three small theme previews side by side (Beige, DarkGray, NearBlack) so you can see all themes at a glance.

**3. Props Table** — Auto-generated from `ComponentMeta.props`:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| variant | `'primary' \| 'secondary'` | `'primary'` | Visual style |

**4. Variants** — Each variant/combination rendered as a grid with a code snippet below. Grouped by prop (e.g., all `variant` values, then all `size` values).

**5. Usage Examples** — 2-3 common patterns with JSX code blocks. E.g., "Button with icon", "Button as link", "Button group".

**6. CSS Classes** — Table of all `st-*` classes this component uses and what each one does.

**7. Related Components** — Links to related components from the registry.

### Demo rendering

Each component needs a demo module that exports variant/example JSX. Create alongside the component:

```
src/pages/design-system/demos/
  button-demo.tsx
  badge-demo.tsx
  heading-demo.tsx
  ...
```

Each demo file exports:
```typescript
export const variants: DemoVariant[] = [
  { label: 'Primary', jsx: <Button variant="primary">Click me</Button> },
  { label: 'Secondary', jsx: <Button variant="secondary">Click me</Button> },
  // ...
];

export const examples: DemoExample[] = [
  {
    title: 'Button with icon',
    code: `<Button leftIcon={<Search />}>Search</Button>`,
    jsx: <Button leftIcon={<Search />}>Search</Button>,
  },
  // ...
];
```

The `DesignSystemAtomPage` lazily imports the correct demo based on `componentId`.

### 404 handling

If `:componentId` doesn't match any registry entry, render a "Component not found" message with a link back to `/ui/atoms`.

### Sidebar on component pages

Same sidebar as the index page — all components listed by category. The current component is highlighted. This lets developers navigate between components without returning to the index.

---

## Step 3: Update Routes in `App.tsx`

Replace:

```tsx
const DesignSystemPage = lazy(() => import('./pages/DesignSystemPage'));
// ...
<Route path="/ui" element={<DesignSystemPage />} />
<Route path="/ui/*" element={<DesignSystemPage />} />
```

With:

```tsx
const DesignSystemLayout = lazy(() => import('./pages/design-system/DesignSystemLayout'));
const DesignSystemAtomsIndex = lazy(() => import('./pages/design-system/DesignSystemAtomsIndex'));
const DesignSystemAtomPage = lazy(() => import('./pages/design-system/DesignSystemAtomPage'));
const DesignSystemCompositionPage = lazy(() => import('./pages/design-system/DesignSystemCompositionPage'));
const DesignSystemTemplatesPage = lazy(() => import('./pages/design-system/DesignSystemTemplatesPage'));
// ...
<Route path="/ui" element={<DesignSystemLayout />}>
  <Route index element={<Navigate to="/ui/atoms" replace />} />
  <Route path="atoms" element={<DesignSystemAtomsIndex />} />
  <Route path="atoms/:componentId" element={<DesignSystemAtomPage />} />
  <Route path="composition" element={<DesignSystemCompositionPage />} />
  <Route path="templates" element={<DesignSystemTemplatesPage />} />
</Route>
```

**SPA redirect note:** The `404.html` redirect with `pathSegmentsToKeep=0` handles all these routes correctly — tested and guarded by `src/__tests__/spa-redirect.test.ts`. Nested routes like `/ui/atoms/button` will redirect through `/?/ui/atoms/button` and be decoded by `index.html`.

---

## Step 4: Create Stub Pages

### `DesignSystemCompositionPage.tsx`

```tsx
export default function DesignSystemCompositionPage() {
  return (
    <div style={{ flex: 1, padding: '32px 48px' }}>
      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--type-display)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-0.03em', marginBottom: 16 }}>
        Composition Patterns
      </h1>
      <p style={{ fontSize: 'var(--type-body-lg)', color: 'var(--color-text-secondary)', maxWidth: 600 }}>
        Grid system, section rhythm, component insets, stacking patterns, responsive behavior, and z-index scale.
      </p>
      {/* Sections will be built per Plan 03 */}
    </div>
  );
}
```

### `DesignSystemTemplatesPage.tsx`

```tsx
export default function DesignSystemTemplatesPage() {
  return (
    <div style={{ flex: 1, padding: '32px 48px' }}>
      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--type-display)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-0.03em', marginBottom: 16 }}>
        Templates
      </h1>
      <p style={{ fontSize: 'var(--type-body-lg)', color: 'var(--color-text-secondary)', maxWidth: 600 }}>
        Section-level blocks assembled from library components. Hero blocks, pricing sections, CTA layouts, data grids.
      </p>
      {/* Will be populated after Composition page is complete */}
    </div>
  );
}
```

---

## Important Notes for Sasha

1. **Do NOT remove the main site Header/Footer** — The design system pages still live inside the main app shell (Header + TopBanner + Footer). The `st-ds-header` is a SECONDARY header below the main one.

2. **paddingTop** — The atoms page needs `paddingTop: calc(var(--header-current-height) + var(--top-banner-height))` on the outer wrapper. This should be set in the Layout, not each page.

3. **paddingBottom** — Add `padding-bottom: 60px` to content area to account for the sticky footer (44px + breathing room).

4. **Sidebar pattern** — Each top-level page renders its own `<nav>` sidebar. For `/ui/atoms` and `/ui/atoms/:componentId`, the sidebar is the same — a full component list grouped by category, driven by `component-registry.ts`. The sidebar is sticky, positioned inside `st-ds-main` flex container. For `/ui/composition` and `/ui/templates`, sidebars list their own section anchors.

5. **scroll-margin-top** — Each `<Section>` already has `scrollMarginTop` for anchor scrolling. This needs to account for the main header + ds header. Current value: `calc(var(--header-current-height, 64px) + var(--top-banner-height, 0px) + 46px + 24px)`.

6. **Theme persistence** — Handled by `ThemeProvider` (writes to localStorage). The footer controls just call `setTheme()` from `useTheme()` hook.

7. **Current phase: Desktop only.** The Mobile button in the footer should be visible but `disabled`. It exists as a placeholder for future work.

8. **Layout primitives are mode-agnostic.** The layout shell, Section spacing, Container widths, and Stack gaps do NOT change with runtime toggles. This is a deliberate decision — layout coordinates are page-level concerns, not content-level.

9. **CSS `@layer` is NOT introduced in this sprint.** The token-spec references `@layer reset, vendor, tokens, components, pages, utilities` but the current `app.css` (~9500 lines) doesn't use layers. Introducing layers reorders the cascade and can break specificity assumptions silently. This is a separate work package with its own audit.

10. **Z-index tokens required.** The footer uses `var(--z-footer)` which must be defined in `:root` before this layout ships. See Plan 01, prerequisite 0b.
