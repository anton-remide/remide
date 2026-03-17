# RemiDe Design System — Decision Log

> **Purpose:** Complete history of decisions, trade-offs, and lessons learned during the UI design system build. Written for any developer or AI agent continuing this work.
> **Date range:** 2026-03-12 to 2026-03-15
> **Participants:** Anton Titov (product/design owner), AI agents (Cursor, Codex)

---

## Table of Contents

1. [Project Genesis](#1-project-genesis)
2. [Architecture Decisions](#2-architecture-decisions)
3. [Theme System](#3-theme-system)
4. [Component Library](#4-component-library)
5. [Design System Page (`/ui`)](#5-design-system-page)
6. [Hard Work Review Cycles](#6-hard-work-review-cycles)
7. [Critical Bugs & Fixes](#7-critical-bugs--fixes)
8. [Diagram Isolation](#8-diagram-isolation)
9. [Infrastructure & Deployment](#9-infrastructure--deployment)
10. [Current State & Next Steps](#10-current-state--next-steps)

---

## 1. Project Genesis

### The Problem

RemiDe had multiple web properties on different platforms:
- `remide.xyz` — product site (Framer)
- `tracker.remide.xyz` — VASP tracker (React/Vite)
- `institute.remide.xyz` — research institute (APIDog/ReadMe)
- Research reports on `super.site`

Each used different design languages, components, and color schemes. No shared system existed.

### The Decision

**Consolidate everything into one codebase (`tracker.remide.xyz`) with one UI library and three color themes.**

Rationale:
- Single source of truth for all components
- One target audience: fintechs, banks, central banks, regulators
- Reports, maps, databases, and articles share the same atomic elements
- Different surfaces get different themes, not different code

### What Was Rejected

- Framer — dropped ("в жопу фреймер")
- Multiple repos per property — too much duplication
- Separate design systems per surface — the audience is the same, only the mood differs

---

## 2. Architecture Decisions

### Atomic Design Methodology

**Decision:** Use Atomic Design (atoms → molecules → organisms → templates → pages) as the mental model, but store everything flat in `src/components/ui/`.

**Why flat, not nested folders:** The codebase had ~30 components already in `src/components/ui/`. Introducing `atoms/`, `molecules/`, `organisms/` folders would require mass renames with no functional benefit. The BEM-like naming convention (`st-{component}--{variant}`) provides sufficient categorization.

### CSS Architecture

**Decision:** All styles in one file: `src/styles/app.css` (~9500 lines). No CSS modules, no CSS-in-JS, no Tailwind.

**Why monolith:** The project started with this structure. Migrating to CSS modules mid-project was high risk. The `st-*` namespace prevents class collisions. CSS custom properties handle theming.

**Deferred:** CSS `@layer` introduction. The token-spec mentions `@layer reset, vendor, tokens, components, pages, utilities` but introducing layers into an existing 9500-line file reorders the cascade and can break specificity assumptions silently. This is a separate work package.

### Design Philosophy: Strict Atoms, Creative Composition

**Decision (2026-03-15):** The design system enforces strict consistency at the atom level but deliberately avoids prescribing layouts and page composition.

**The principle:**
- **Atoms are law.** Button, Badge, Input, Heading, Avatar — these are rigid building blocks with defined props, variants, sizes, and theme behavior. No creative interpretation. A Button is a Button everywhere.
- **Composition is creative territory.** When you assemble a page — deciding section order, spacing rhythm, visual hierarchy, content density, where to put a CTA — that's design work. A library of preset layouts kills exactly the creative judgment that makes pages good.
- **Plan 03 (Composition page) is a reference guide, not a rulebook.** It documents the spacing scale, typography pairing defaults, surface hierarchy, and grid system so developers have a shared vocabulary. But these are *recommended defaults*, not constraints. A developer building a landing page should feel free to break the "standard section rhythm" if the content demands it.

**Why this matters:**
- Over-engineered layout systems create "template fatigue" — every page looks the same
- The best design systems (Tailwind, Radix) give you tools but never dictate composition
- RemiDe surfaces serve different purposes (reports, dashboards, landing pages, data browsers) — a single layout grammar cannot serve all of them equally well
- Creativity at the page level is what differentiates a good product from a generic one

**What this means in practice:**
- `component-registry.ts` documents every atom's API exhaustively — props, variants, CSS classes
- Plan 03's composition page shows *how things can work together*, not *how they must work together*
- Templates page shows *examples for inspiration*, not *prescriptions for assembly*
- A developer should never feel blocked by "the system doesn't allow this layout" — if atoms exist, any composition is valid
- The only hard constraints are at the token level: use design tokens (not hardcoded hex/px), respect theme contracts, maintain WCAG contrast ratios

### No Bootstrap Grid

**Decision:** Bootstrap is imported but only for base styles. All layout uses CSS Grid/Flexbox via `st-*` classes. Bootstrap grid classes (`row`/`col`/`g-*`) are not used in JSX.

**Plan:** Remove Bootstrap import entirely in Phase 2.

### Token-Only Styling

**Decision:** Zero hardcoded `#hex`, `px` font-sizes, or `rgba()` in component code. Everything via `var(--color-*)`, `var(--type-*)`, `var(--space-*)`, `var(--radius-*)`, `var(--shadow-*)`.

**Reality check:** As of the audit, there are still 466 `style={{...}}` occurrences across 26 files. 155 of those use `var(--...)`. Full migration is ongoing.

---

## 3. Theme System

### Three Themes

| Theme | Variable | Target Surface |
|-------|----------|---------------|
| Beige (Light) | `data-theme="beige"` | Institute, reports, content |
| Dark Gray | `data-theme="darkgray"` | Tracker, dashboards |
| Near Black | `data-theme="nearblack"` | Product site (remide.xyz) |

All themes share warm color temperature (hue family H ≈ 48°, S ≈ 6-10%). No cool slate/blue-gray.

### Theme Implementation

**Decision:** CSS custom properties on `document.documentElement` via `data-theme` attribute. Managed by `ThemeProvider` context with `localStorage` persistence.

**Key fix (Cycle 0):** `ThemeProvider.applyTheme()` was removing `data-theme` attribute for Beige (treating it as "default"). This broke the design system page's theme switcher because Beige-specific token overrides in `[data-theme="beige"]` CSS blocks never applied. Fixed to always set the attribute.

### Token Corrections (Cycle 2-3)

| Token | Problem | Fix | Status |
|-------|---------|-----|--------|
| `--color-surface-raised` (Beige) | `#FFFFFF` = same as `--color-surface`. 3-level depth system collapses to 2. | Change to `#FAF9F6` | In plan, not applied |
| `--color-text-secondary` (NearBlack) | `#7C7C78` on `#1C1C1A` = 3.8:1 contrast. Fails WCAG AA (4.5:1). | Change to `#8A8A86` (~4.6:1) | In plan, not applied |
| `--shadow-soft` | Lines 85-86 have `#FFF inset` — white hairlines visible on dark themes. | Remove both inset lines | In plan, not applied |
| `--content-max-width` | Currently `1200px`. Plan proposed `1280px` but this widens 5+ existing layouts. | Keep at `1200px`. Separate migration later. | Decision made |

### NearBlack Border Rule

**Decision:** On NearBlack, every surface-level element MUST have a visible border (`--color-border-strong`). Shadows using `rgba(0,0,0,...)` on near-black backgrounds provide zero perceptible depth.

**Enforcement:** A CSS override block targeting all card/table/input components under `[data-theme="nearblack"]` — see Plan 01 §0h.

---

## 4. Component Library

### Existing Components (43 built)

As of 2026-03-15, the following components exist in `src/components/ui/`:

**Atoms:** Heading, Button, Badge, Input, Toggle, SegmentedControl, Divider, FilterChip, BulletItem, BulletIcons
**Molecules:** StatCard, BigStatRow, ContentCard, ContentCardGrid, CalloutStat, CalloutStatGrid, Callout, ProseBlock, AuthorCard, TestimonialCard, PhaseCard, StepFlow, Timeline
**Organisms:** DataTable (with sort/filter/pagination), WorldMap
**Other:** MermaidDiagram

All have smoke tests in `src/components/ui/__tests__/ui-smoke.test.tsx` (44 tests).

### Phase 1 — New Components (11)

Identified through 3 review cycles. These enable "instant page assembly":

**Atoms:**
- `Icon` — unified wrapper for lucide-react + custom SVGs. Size via CSS tokens.
- `Label` — semantic `<label>` with consistent typography.
- `StyledLink` — react-router + external links with design tokens.
- `Avatar` — image/initials, 4 sizes, circle/rounded.
- `Image` — lazy loading, aspect-ratio, theme border.

**Layout Primitives:**
- `Container` — max-width wrapper (default/wide/prose/narrow).
- `Stack` — flex layout (gap, direction, wrap, align). Density-agnostic.
- `Section` — semantic `<section>` with containment (`maxWidth`), spacing presets, scroll anchor, `surface` prop for forced dark/light, `bleed` for full-viewport backgrounds.

**Organisms:**
- `BulletSection` — groups BulletItems under a heading with variant icons.
- `AuthForm` — login/signup/forgot modes from library atoms.
- `TestimonialCarousel` — auto-play rotation of TestimonialCards.

### Phase 2 — Deferred Components

Explicitly deferred with rationale:

| Component | Why deferred |
|-----------|-------------|
| Grid/Col | Container + Stack + CSS grid covers real layouts |
| Tabs | No page needs in-page tabs; DS tabs are route-based |
| Modal | Complex (focus trap, scroll lock); no current usage |
| Select | Native `<select>` + `st-*` works; custom Select is a rabbit hole |
| SimpleTable | HTML `<table>` with `st-table` classes exists |
| TableOfContents | DS sidebar already does scroll tracking |
| Figure | Trivial inline until 5+ instances needed |
| EmptyState | UX polish, not structural |
| Tooltip | Needs positioning engine (Floating UI) |
| Toast | Needs portal, animation, queue; zero usage |
| Pagination | Extraction from DataTable needs careful API surgery |
| useBreakpoint | JS hook; media queries suffice for restyling |

### Key Design Decisions for Components

**Section absorbs Container's role for sections.** Kenji (Cycle 2) identified that Container + Section + Stack creates a triple-nesting anti-pattern. Section now owns containment via `maxWidth` prop. Container is only for non-section contexts (header/footer inner content).

**FullBleed is a prop, not a component.** Section has `bleed?: boolean` that stretches to viewport width. No separate FullBleed wrapper needed.

**Section `surface="inverse"` for dark hero sections.** Cycle 3 simulation revealed that building a dark hero on a light page requires scoped token resolution. `surface="inverse"` sets `data-theme="nearblack"` on the section element, making all child tokens resolve against the dark palette. No inline color overrides needed.

**Layout primitives are density-agnostic.** Section spacing, Container widths, and Stack gaps do NOT change with density toggle. Density affects content-level components (cards, tables, inputs) only.

### Existing Component Patches (from Cycle 3)

| Component | Fix needed |
|-----------|-----------|
| Button | Add `secondary`, `ghost`, `danger` variants and `lg` size. Current: only `primary`/`outline` and `default`/`sm`. |
| ContentCard | `.st-content-card__badge` needs `display:flex; gap:var(--space-1)` for multi-badge support |
| Callout | Add `tip` variant |
| DataTable | Add `hideSearch`, `hidePagination` boolean props for static report contexts |
| BigStatRow | Add `valueFont` prop — currently forces Doto on all values, inappropriate for non-numeric data |
| AuthorCard | Compose Avatar component internally (initials fallback when no image) |
| TestimonialCard | Same — compose Avatar for fallback |

---

## 5. Design System Page

### Evolution

1. **Initial state:** Single-page `/ui` with all components listed, theme switcher in page header.
2. **Refactored:** Sidebar navigation added, sticky header, sections reordered to match sidebar menu.
3. **Current plan (Plan 02):** Split into 3 routed sub-pages with shared layout shell:

```
/ui              → redirects to /ui/atoms
/ui/atoms        → Component showcase (current content)
/ui/composition  → Layout patterns & spacing rules
/ui/templates    → Section-level page recipes
```

### Layout Shell Architecture

- **Header:** "RemiDe UI" brand + NavLink tabs (Components, Composition, Templates)
- **Main:** Flex container with per-page sidebar + content via `<Outlet />`
- **Footer (sticky):** Theme + Density + Viewport toggles. Compact and Mobile are placeholder-disabled.

### Per-Component Reference Pages (Tailwind-style)

**Decision:** Individual routes per component (`/ui/atoms/button`, `/ui/atoms/badge`, etc.) instead of one long page with anchor sections.

**Why subpages over anchors:**
- A single page with 54 components' props tables + code examples = 8000-10000 lines, 3-5 second load
- Subpages enable code splitting — each component's demos load independently
- Clean shareable URLs — can link directly to a specific component reference
- Tailwind, Radix, and Chakra all use this pattern at scale

**Architecture:** A `component-registry.ts` data file drives both the index catalog and each reference page. Each component also has a `demos/*.tsx` file exporting variant renders and usage examples. The index page at `/ui/atoms` shows a searchable card grid. The sidebar persists on component pages for quick navigation between components.

### Typography Decision

Anton chose: **Heading component uses Doto for Display/H1/H2/H3** (same as global heading styles) — unified system where the pixel font is for large headings and data values, DM Sans is for body text.

Full typography pairing decision tree documented in Plan 03 §6 with 14 specific context rules.

---

## 6. Hard Work Review Cycles

The plan was reviewed through 3 cycles using the Hard Work Framework (`docs/hard-work-framework.md`):

### Cycle 1: Blind Spot Identification

**Roles:** Principal Frontend Engineer (Kenji Tanaka), Stripe Design System Lead (Elena Marchetti)

**Key findings (26 additions accepted):**
- Missing layout primitives (Container, Stack, Section, Grid/Col)
- Missing interactive components (Tabs, Modal, Select)
- Missing documentation sections (Typography Pairing, Surface Hierarchy, Motion Tokens, Focus States)
- Infrastructure gaps: `--content-max-width` resolution, icon size reconciliation, z-index tokens

### Cycle 2: Structural Risk Analysis

**Focus:** Sequencing, API conflicts, scope creep, phase cuts

**Critical findings:**
- Section/Container/Stack triple-nesting problem → solved by merging containment into Section
- `--content-max-width` 1200→1280 is a visual breaking change → keep at 1200
- NearBlack `--color-text-secondary` fails WCAG AA → fix token value
- Beige surface hierarchy collapses → fix `--color-surface-raised`
- Phase 1 cut: 12 components (not 23+). Defer everything not blocking page assembly.
- Confidence: 62% "good but not Stripe-quality"

### Cycle 3: Page Assembly Simulation

**Method:** Each critic built a real page from the library and flagged every gap.

**Kenji built a Report page** — 21 gaps:
- P0: All Plan 01 components needed (Section, Stack, etc.)
- P1: Section needs `surface="inverse"` for dark hero. Button variants missing.
- P2: ContentCard multi-badge gap, Callout needs `tip` variant, DataTable needs hide props.

**Elena built an Entity Detail page** — 17 gaps, 19 theme issues:
- NearBlack: 11 visual failures (borders invisible, contrast failing, shadows useless)
- Grid/Col needed for main+sidebar layout (deferred → use inline CSS grid)
- No KeyValueGrid component for info sections
- Focus ring broken on all dark themes
- Confidence: 28% pre-fix, estimated 80%+ after Phase 1

---

## 7. Critical Bugs & Fixes

### React Hooks Rule Violation

**What:** `useState` was used inside IIFEs in `DesignSystemPage.tsx`. React's rules of hooks require hooks at the top level of a component.
**Symptom:** Page crashed on render. "The whole page broke."
**Fix:** Extracted interactive demo logic into separate named components (`SegmentedDemo`, `DataTableDemo`).
**Lesson:** Never use hooks inside IIFEs, even if they look like components.

### WebGL Context Exhaustion

**What:** Repeated HMR reloads in Chrome exhausted browser WebGL contexts.
**Symptom:** WorldMap stopped rendering. "Карта мертва."
**Fix:** Close and restart Chrome. Not a code bug — browser resource limit.
**Lesson:** When working on map-adjacent code, minimize HMR cycles or use a different browser.

### SPA Redirect URL Corruption (`~and~` loop)

**What:** Visiting `/ui` on GitHub Pages resulted in `tracker.remide.xyz/ui?/&/~and~/~and~/...`
**Root cause:** `public/404.html` had `pathSegmentsToKeep = 1` while the site deploys at root `/`. This created an infinite redirect loop where each cycle mangled the URL with `~and~` encoding.
**Fix:** Changed `pathSegmentsToKeep` to `0`.
**Guard:** Created `src/__tests__/spa-redirect.test.ts` with 20 tests including regression for the exact broken scenario.

### Focus Ring Invisible on Dark Themes

**What:** Global `:focus-visible` at line 324 of `app.css` uses `var(--black)` which resolves to a dark color on dark themes — invisible.
**Fix (planned):** Replace with `--focus-ring: 0 0 0 3px var(--color-accent-a25)` token.
**Status:** In Plan 01 §0c, not yet applied.

---

## 8. Diagram Isolation

**Decision:** Extract Mermaid and React Flow diagram work from the main UI library into a separate specification.

**Why:** Diagram components have heavy dependencies (`@xyflow/react`, `dagre`, `mermaid`), require WebGL/Canvas, and their development repeatedly crashed the DS page via HMR issues. Keeping them in the same development cycle as the UI library creates instability.

**What was done:**
- Created `docs/design-system/diagrams-graphics-spec.md`
- Removed `FlowDiagram.tsx` and `src/components/ui/flow/` directory
- Removed `@xyflow/react`, `dagre`, `@types/dagre` from dependencies
- Removed ~230 lines of FlowDiagram CSS from `app.css`
- Removed "Diagrams" section from `DesignSystemPage.tsx`
- Created new unified `Diagram.tsx` component (in progress, separate from UI library)

---

## 9. Infrastructure & Deployment

### GitHub Pages Deployment

- **Repo:** `anton-remide/remide` on GitHub
- **CI:** `.github/workflows/deploy.yml` — builds and deploys to GitHub Pages on push to `main`
- **Tests gate:** `.github/workflows/test.yml` runs before deploy; failures block deployment
- **`npm ci --force`:** Required in CI because `package-lock.json` generated on macOS contains `@esbuild/darwin-arm64` which fails on Linux runners

### Git Authentication

- Configured via `gh auth login` with device flow
- `workflow` scope obtained via `gh auth refresh --scopes workflow` for pushing workflow files

### Testing

- **Framework:** Vitest + @testing-library/react + jsdom
- **UI smoke tests:** 44 tests in `src/components/ui/__tests__/ui-smoke.test.tsx`
- **SPA redirect tests:** 20 tests in `src/__tests__/spa-redirect.test.ts`
- **Mocks:** `maplibre-gl` (canvas), `mermaid` (render function), `ThemeProvider` (context)

---

## 10. Current State & Next Steps

### What Exists

| Asset | File | Lines |
|-------|------|-------|
| Token specification | `docs/design-system/token-spec.md` | 243 |
| System overview (audit v0) | `docs/design-system/overview.md` | 144 |
| Diagrams spec (isolated) | `docs/design-system/diagrams-graphics-spec.md` | 218 |
| Component build plan | `docs/design-system/plan-01-components.md` | 1111 |
| Page architecture plan | `docs/design-system/plan-02-page-architecture.md` | 386 |
| Composition & templates plan | `docs/design-system/plan-03-composition.md` | 788 |
| This decision log | `docs/design-system/DECISION-LOG.md` | — |
| 43 built components | `src/components/ui/*.tsx` | — |
| 44 smoke tests | `src/components/ui/__tests__/ui-smoke.test.tsx` | — |
| 20 SPA redirect tests | `src/__tests__/spa-redirect.test.ts` | — |
| ~9500 lines of CSS | `src/styles/app.css` | ~9500 |

### Implementation Priority

**Estimated ~13 hours to reach 80% confidence:**

| Step | Time | What |
|------|------|------|
| 1 | ~2h | Token prerequisites (Plan 01 §0a-0i) |
| 2 | ~4h | Section + Stack + Container |
| 3 | ~4h | Avatar + StyledLink + Icon + Image + Label |
| 4 | ~1h | NearBlack border enforcement CSS |
| 5 | ~1h | Button variant/size fixes |
| 6 | ~30min | ContentCard badge gap, Callout tip, DataTable hide props |
| 7 | ~1h | BulletSection + AuthForm + TestimonialCarousel |

After Phase 1: split the DS page (Plan 02), build composition demos (Plan 03), populate templates.

### What NOT to Do

1. **Do not introduce CSS `@layer`** — cascade reordering risk on a 9500-line file. Separate work package.
2. **Do not change `--content-max-width`** from 1200px — visual breaking change across 5+ layouts. Needs its own audit.
3. **Do not touch diagram components** — they live in a separate spec (`diagrams-graphics-spec.md`).
4. **Do not build Phase 2 components** until Phase 1 is done and deployed. They don't block page assembly.
5. **Do not copy existing page layouts into templates** — templates are examples for inspiration, not prescriptions for assembly.
6. **Do not treat composition/layout rules as law** — atoms are strict, but page composition is creative territory. Plan 03's spacing, rhythm, and stacking patterns are recommended defaults, not constraints. See §2 "Strict Atoms, Creative Composition".
7. **Do not use `style={{...}}` for colors or font sizes** — use design tokens. But `style={{...}}` for one-off layout tweaks is fine when the design calls for it.
