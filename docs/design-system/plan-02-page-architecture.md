# Plan 02: Page Architecture — Multi-Page Design System

> **For:** Sasha (frontend) | **Status:** Ready for implementation
> **Depends on:** Plan 01 token prerequisites (0b z-index tokens) must be done first. Component work can be parallel.
> **Reviewed:** Cycles 1-3. No additional changes from Cycle 3 (page architecture was not a simulation bottleneck).

## Current State

Everything lives in a single file:
- `src/pages/DesignSystemPage.tsx` (~1315 lines)
- Route: `/ui` and `/ui/*` in `App.tsx` (lines 71-72)
- Theme/density controls in a sticky toolbar at the top
- Left sidebar with anchor links to sections

## Target State

Three routed sub-pages with a shared layout shell:

```
/ui              → redirects to /ui/atoms
/ui/atoms        → Components showcase (current content)
/ui/composition  → Layout patterns & spacing rules (Plan 03)
/ui/templates    → Section-level blocks built from library (Plan 04 — future)
```

---

## New File Structure

```
src/pages/
  design-system/
    DesignSystemLayout.tsx          ← Shared shell: header + sidebar + sticky footer
    DesignSystemAtomsPage.tsx       ← Current DesignSystemPage.tsx content
    DesignSystemCompositionPage.tsx  ← New (Plan 03)
    DesignSystemTemplatesPage.tsx   ← New (stub for now)
```

---

## Step 1: Create `DesignSystemLayout.tsx`

This is the shared wrapper for all /ui/* pages. It provides:
1. **Header bar** — branding + tab navigation
2. **Sidebar** — section anchors (different per page, passed as prop)
3. **Content area** — renders child route via `<Outlet />`
4. **Sticky footer** — theme + density + viewport controls

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
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop');

  return (
    <div data-density={density} style={{ /* same wrapper styles as current */ }}>

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
        <Outlet context={{ density, viewport }} />
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

        {/* Density */}
        <div className="st-ds-footer__group">
          <span className="st-ds-footer__label">Density</span>
          {(['comfortable', 'compact'] as const).map(d => (
            <button
              key={d}
              onClick={() => setDensity(d)}
              className={['st-ds-footer__btn', density === d && 'is-active'].filter(Boolean).join(' ')}
              disabled={d === 'compact'}  // placeholder — compact not yet implemented
            >
              {d}
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
  font-family: var(--font2);
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
  font-family: var(--font1);
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
  font-family: var(--font1);
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

## Step 2: Split `DesignSystemPage.tsx` → `DesignSystemAtomsPage.tsx`

1. Rename `src/pages/DesignSystemPage.tsx` → `src/pages/design-system/DesignSystemAtomsPage.tsx`
2. Remove from it:
   - The outer wrapper `<div data-density={density}>` (now in Layout)
   - The sticky toolbar with theme/density buttons (now in Layout footer)
   - The `useTheme()` call (now in Layout)
3. Keep:
   - The sidebar section list (render as part of this page's `<nav>`)
   - All `<Section>` components
   - All demo code (FilterChipDemo, ChipDemo, SegmentedDemo, DataTableDemo, etc.)
4. Export the sidebar items list so Layout can render the correct sidebar

The page should still have its own sidebar. The sidebar is part of each sub-page, not the layout, because each page has different sections.

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
const DesignSystemAtomsPage = lazy(() => import('./pages/design-system/DesignSystemAtomsPage'));
const DesignSystemCompositionPage = lazy(() => import('./pages/design-system/DesignSystemCompositionPage'));
const DesignSystemTemplatesPage = lazy(() => import('./pages/design-system/DesignSystemTemplatesPage'));
// ...
<Route path="/ui" element={<DesignSystemLayout />}>
  <Route index element={<Navigate to="/ui/atoms" replace />} />
  <Route path="atoms" element={<DesignSystemAtomsPage />} />
  <Route path="composition" element={<DesignSystemCompositionPage />} />
  <Route path="templates" element={<DesignSystemTemplatesPage />} />
</Route>
```

---

## Step 4: Create Stub Pages

### `DesignSystemCompositionPage.tsx`

```tsx
export default function DesignSystemCompositionPage() {
  return (
    <div style={{ flex: 1, padding: '32px 48px' }}>
      <h1 style={{ fontFamily: 'var(--font2)', fontSize: 'var(--type-display)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-0.03em', marginBottom: 16 }}>
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
      <h1 style={{ fontFamily: 'var(--font2)', fontSize: 'var(--type-display)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-0.03em', marginBottom: 16 }}>
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

4. **Sidebar pattern** — Each page renders its own `<nav>` sidebar. The sidebar is sticky, positioned inside `st-ds-main` flex container. Current sidebar code (DesignSystemPage lines 372-472) can be extracted into a helper or kept inline per page.

5. **scroll-margin-top** — Each `<Section>` already has `scrollMarginTop` for anchor scrolling. This needs to account for the main header + ds header. Current value: `calc(var(--header-current-height, 64px) + var(--top-banner-height, 0px) + 46px + 24px)`.

6. **Theme persistence** — Handled by `ThemeProvider` (writes to localStorage). The footer controls just call `setTheme()` from `useTheme()` hook.

7. **Current phase: Desktop + Comfortable only.** The Compact and Mobile buttons in the footer should be visible but `disabled`. They exist as placeholders for future work.

8. **Layout primitives are density-agnostic.** The layout shell, Section spacing, Container widths, and Stack gaps do NOT change with the density toggle. Density affects content-level components (cards, tables, inputs) only. This is a deliberate decision — layout coordinates are page-level concerns, not content-level.

9. **CSS `@layer` is NOT introduced in this sprint.** The token-spec references `@layer reset, vendor, tokens, components, pages, utilities` but the current `app.css` (~9500 lines) doesn't use layers. Introducing layers reorders the cascade and can break specificity assumptions silently. This is a separate work package with its own audit.

10. **Z-index tokens required.** The footer uses `var(--z-footer)` which must be defined in `:root` before this layout ships. See Plan 01, prerequisite 0b.
