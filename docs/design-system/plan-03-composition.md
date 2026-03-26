# Plan 03: Composition Page — Layout Patterns & Spacing Rules

> **For:** Sasha (frontend) | **Status:** Ready for implementation
> **Route:** `/ui/composition` | **File:** `src/pages/design-system/DesignSystemCompositionPage.tsx`
> **Depends on:** Plan 02 (page architecture) must be done first so routes exist
> **Scope:** Reference guide — shared vocabulary and recommended defaults, NOT a prescriptive rulebook. See DECISION-LOG §2 "Strict Atoms, Creative Composition".
> **Reviewed:** Cycles 1-3. Cycle 3 = page assembly simulation. All gaps incorporated.

## Purpose

This page documents the **spatial vocabulary** of the RemiDe design system: spacing tokens, typography pairing defaults, surface hierarchy, and grid dimensions. It's a shared reference — not a set of rules that must be followed.

**Design philosophy:** Atoms are strict (a Button is always a Button). Composition is creative. The patterns below are *recommended starting points* — a developer building a page should use them as defaults but break them freely when the content demands it. A landing page hero might need unusual spacing. A data dashboard might ignore the standard section rhythm. That's fine.

Every pattern on this page should be demonstrated with a **live visual example** — not just text documentation.

---

## Sidebar Sections

```typescript
const COMPOSITION_SECTIONS = [
  { id: 'grid', label: 'Grid System' },
  { id: 'rhythm', label: 'Section Rhythm' },
  { id: 'coupling', label: 'Section Coupling' },
  { id: 'insets', label: 'Component Insets' },
  { id: 'stacking', label: 'Stacking Patterns' },
  { id: 'typography', label: 'Typography Pairing' },
  { id: 'surfaces', label: 'Surface Hierarchy' },
  { id: 'motion', label: 'Motion Tokens' },
  { id: 'focus', label: 'Focus States' },
  { id: 'primitives', label: 'Layout Primitives' },
  { id: 'responsive', label: 'Responsive Behavior' },
  { id: 'zindex', label: 'Z-Index Scale' },
];
```

---

## Section 1: Grid System (`#grid`)

### New tokens to define (add to `app.css` `:root`)

```css
:root {
  --grid-columns: 12;
  --grid-gutter: var(--space-6);   /* 24px */
  --grid-margin: var(--space-8);   /* 32px */
  /* --content-max-width stays at 1200px (existing value, not changed — see Plan 01 §0i) */
}
```

### Rules

- **12-column grid** with 24px gutters
- **Outer margins:** 32px on desktop, 16px on mobile
- **Max content width:** 1280px, centered
- Common column spans:
  - Full width: 12/12
  - Two-thirds + sidebar: 8/12 + 4/12
  - Three equal: 4/4/4
  - Two equal: 6/6
  - Four equal: 3/3/3/3

### Visual demo

Show a live grid overlay with numbered columns. Use semi-transparent accent-colored columns. Below it, show the common column span patterns as real layouts with placeholder cards.

```tsx
{/* Grid overlay visualization */}
<div className="st-grid-demo">
  {Array.from({ length: 12 }, (_, i) => (
    <div key={i} className="st-grid-demo__col">
      <span>{i + 1}</span>
    </div>
  ))}
</div>

{/* Column span patterns */}
<div className="st-grid-demo-patterns">
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 'var(--grid-gutter)' }}>
    <div style={{ gridColumn: 'span 12', background: 'var(--color-accent-subtle)', padding: 16, borderRadius: 'var(--radius-md)' }}>
      12/12 — Full width
    </div>
  </div>
  {/* ... more patterns ... */}
</div>
```

### CSS for grid demo

```css
.st-grid-demo {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: var(--grid-gutter);
  max-width: var(--content-max-width);
  margin: 0 var(--grid-margin);
  padding: var(--space-4) 0;
}
.st-grid-demo__col {
  background: var(--color-accent-subtle);
  border: 1px dashed var(--color-accent);
  border-radius: var(--radius-sm);
  padding: var(--space-4) 0;
  text-align: center;
  font-size: var(--type-caption);
  font-weight: 600;
  color: var(--color-accent);
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

---

## Section 2: Section Rhythm (`#rhythm`)

Vertical spacing between major page blocks.

### Rules

| Transition | Token | Value | Usage |
|-----------|-------|-------|-------|
| Page top → first section | `--space-24` | 96px | Below hero or page header |
| Section → section | `--space-16` | 64px | Between major blocks |
| Section title → section body | `--space-8` | 32px | Heading to content |
| Within section (groups) | `--space-6` | 24px | Between card groups, stat rows |
| Within group (items) | `--space-4` | 16px | Between individual cards, rows |
| Tight pairs | `--space-2` | 8px | Label to input, caption to element |

### Visual demo

A vertical stack of colored blocks with measured spacing rulers between them. Each ruler shows the token name and px value.

```tsx
{/* Rhythm ruler demo */}
<div style={{ display: 'flex', flexDirection: 'column', maxWidth: 600 }}>
  {[
    { label: 'Hero Block', spacing: '--space-24', px: '96px' },
    { label: 'Stats Section', spacing: '--space-16', px: '64px' },
    { label: 'Content Section', spacing: '--space-16', px: '64px' },
    { label: 'CTA Block', spacing: '--space-16', px: '64px' },
  ].map((block, i) => (
    <Fragment key={i}>
      {i > 0 && (
        <div className="st-rhythm-ruler">
          <span className="st-rhythm-ruler__line" />
          <code>{block.spacing} ({block.px})</code>
          <span className="st-rhythm-ruler__line" />
        </div>
      )}
      <div className="st-rhythm-block">{block.label}</div>
    </Fragment>
  ))}
</div>
```

---

## Section 3: Section Coupling Taxonomy (`#coupling`)

A mental model for choosing spacing between adjacent sections. These are sensible defaults — override them when the visual flow of your specific page calls for it.

### Three coupling levels (recommended defaults)

| Coupling | Token | Value | When to use |
|----------|-------|-------|-------------|
| **tight** | `--space-8` | 32px | Sections that are argument→evidence pairs. Stats below a hero claim. CTA after testimonials. |
| **standard** | `--space-16` | 64px | Topic shifts. Features after stats. Testimonials after features. |
| **thematic break** | `--space-24` | 96px | Major topic changes. Page top to first section. Between "above the fold" and deep content. |

### Modifiers

**Background-change modifier:** If two adjacent sections have different background colors (e.g., accent-subtle to bg), reduce the coupling by one step. The background change itself creates visual separation.
- standard → tight
- thematic break → standard
- tight stays tight (minimum)

**Full-bleed hero rule:** Full-bleed hero sections have **zero top spacing**. The hero IS the page top. The 96px thematic-break spacing applies only to in-flow page headers without full-bleed backgrounds.

### Mental walkthrough: Landing page

| Transition | Coupling | Spacing | Reasoning |
|-----------|----------|---------|-----------|
| Hero → Stats | tight | 32px | Stats prove the hero claim — thematic continuation |
| Stats → Features | standard | 64px | Topic shift: "what we track" → "how it works" |
| Features → Testimonials | standard | 64px | Topic shift to social proof |
| Testimonials → CTA | tight | 32px | CTA is the punchline to testimonials |

### Visual demo

Show 4 sections with adjustable spacing rulers. Each ruler displays the coupling label, token, and px value. Toggle between "tight," "standard," and "thematic break" to show the visual difference.

---

## Section 4: Component Insets (`#insets`)

Inner padding patterns.

### Rules

| Context | Padding | Token |
|---------|---------|-------|
| Card body | 24px (comfortable) | `--space-6` |
| Card body (compact) | 16px | `--space-4` |
| Section horizontal padding | 32px | `--grid-margin` |
| Table cell | 12px 16px (comfortable) | `--space-3` / `--space-4` |
| Table cell (compact) | 8px 12px | `--space-2` / `--space-3` |
| Button | 10px 20px | `--space-3` / `--space-6` (approx) |
| Badge | 2px 8px | `--space-0-5` / `--space-2` |
| Input field | 10px 12px | — |
| Modal/Callout body | 24px | `--space-6` |

### Visual demo

Show each pattern as a real component with a highlighted padding overlay (semi-transparent accent border showing the inset area).

---

## Section 5: Stacking Patterns (`#stacking`)

How organisms compose into page sections.

### Patterns

**1. Card Grid**
- 1 column on mobile (< 768px)
- 2 columns from 768px
- 3 columns from 1024px
- 4 columns from 1280px (only for small cards like StatCard)
- Gap: `var(--space-4)` (16px)

**2. Stat Row**
- Horizontal flex, wrap
- Gap: `var(--space-4)` (16px)
- Each stat has `min-width: 140px` to prevent too-narrow items
- On mobile: 2-column grid

**3. Content + Sidebar**
- Main content: 8/12 columns
- Sidebar: 4/12 columns
- Sidebar becomes top/bottom stacked on < 1024px
- Gap: `var(--grid-gutter)`

**4. Full-bleed Section**
- Breaks out of `max-width` container
- Background spans full viewport width
- Content stays inside `max-width`
- Used for: hero, CTA, testimonial carousel, stats bar

**5. Prose Layout**
- Max-width: 720px (for readability)
- Centered within content area
- Used for: report text, article body, terms

### Visual demo

For each pattern, show a live rendered example with real components (using placeholder data). Toggle between "desktop" and "stacked" views.

---

## Section 6: Typography Pairing (`#typography`)

Reference for when to use the heading role (`--font-heading`) vs the body role (`--font-body`). The table below captures the defaults enforced by components (Heading, Badge, Button) and recommended conventions for other contexts.

### Decision Tree (defaults and recommendations)

| Context | Font | Weight | Size token | Example |
|---------|------|--------|-----------|---------|
| **Display heading** (hero, page title) | Heading role (`--font-heading`) | 700 | `--type-display` | "AFRICA'S $120B CRISIS" |
| **Section heading** (H1/H2/H3) | Heading role (`--font-heading`) | 700 | `--type-heading-*` | "KEY FINDINGS" |
| **Subheading** (H4/H5/H6) | Body role (`--font-body`) | 600 | `--type-body-lg` | "Regional breakdown" |
| **Body text** | Body role (`--font-body`) | 400 | `--type-body` | Paragraph content |
| **Data identifier** (ticker, LEI) | Heading role (`--font-heading`) | 500 | `--type-body-sm` | "USDT", "LEI-549300..." |
| **Monetary value** (stat, price) | Heading role (`--font-heading`) | 700 | varies | "$4.2B", "120" |
| **Section count** in parentheses | Heading role (`--font-heading`) | 500 | inherit from parent | "Licenses (47)" — the count inherits the heading role |
| **Badge text** | Body role (`--font-body`) | 600 | `--type-micro` | "Active", "Licensed" |
| **Inline code / address** | Heading role (`--font-heading`) | 400 | `--type-body-sm` | "0x1234...abcd" |
| **Button label** | Body role (`--font-body`) | 600 | `--type-body-sm` | "Sign In", "View Report" |
| **Nav item** | Body role (`--font-body`) | 500 | `--type-body-sm` | "Entities", "Reports" |
| **Caption / timestamp** | Body role (`--font-body`) | 400 | `--type-caption` | "Updated 2 hours ago" |
| **Label** (form, table header) | Body role (`--font-body`) | 600 | `--type-body-sm` | "Email address", "JURISDICTION" |
| **Callout stat value** | Heading role (`--font-heading`) | 700 | `--type-heading-2` | Large number in callout card |

### Component-enforced constraints (these ARE strict — they're baked into atoms)

1. **Heading component** auto-applies the heading role for Display/H1/H2/H3 levels. Developers don't choose the font — the component enforces it.
2. **Badge text always uses the body role** at `--type-micro`. The Badge component enforces this.
3. **Button labels always use the body role.** The Button component enforces this.

### Recommendations (not enforced — use your judgment)

4. **Numbers in inline body text** usually work better with the body role. Use the heading role for primary data points (stat cards, callout values, financial tables).
5. **When in doubt: use the body role.** The heading role is high-signal — headings and standalone data values.

### Visual demo

Show a side-by-side comparison card: left side shows each context with the correct font, right side shows the same text in the wrong font. The contrast makes the rules visceral.

---

## Section 7: Surface Hierarchy (`#surfaces`)

A 3-level depth system that works across all 3 themes.

### Levels

| Level | Token | Beige | DarkGray | NearBlack | Usage |
|-------|-------|-------|----------|-----------|-------|
| **Base** | `--color-bg` | `#F6F2EE` | `#1E1E1C` | `#111110` | Page background |
| **Raised** | `--color-surface` | `#FFFFFF` | `#282826` | `#1C1C1A` | Cards, sections |
| **Overlay** | `--color-surface-raised` | `#FAF9F6` | `#30302E` | `#242422` | Modals, dropdowns, nested cards |

> **Beige fix (Plan 01 §0f):** `--color-surface-raised` was `#FFFFFF` — identical to `--color-surface`. Changed to `#FAF9F6` for a perceptible warmth step.

### Shadow mapping

| Level | Shadow token |
|-------|-------------|
| Base | none |
| Raised | `--shadow-sm` |
| Overlay | `--shadow-md` |

### NearBlack hard rule

On NearBlack, shadows use `rgba(0,0,0,...)` on a near-black background — they're invisible. **Every raised/overlay element on NearBlack MUST have a visible border** (`--color-border` or `--color-border-strong`). Shadows are decorative-only on this theme.

### When to card vs flat

| Context | Surface | Border | Shadow |
|---------|---------|--------|--------|
| Content card (standalone info block) | Raised | Yes | `--shadow-sm` |
| Section on same background | Base (flat) | No | None |
| Dropdown menu | Overlay | Yes | `--shadow-md` |
| Callout (informational) | Raised | Yes (accent-tinted) | None |
| Table row | Base | Bottom border only | None |
| Modal | Overlay | Yes | `--shadow-lg` |

### Visual demo

Three theme columns (Beige, DarkGray, NearBlack) each showing the 3 surface levels stacked. Show the border/shadow treatment at each level. NearBlack column should have prominent borders to prove the rule works.

---

## Section 8: Motion Tokens (`#motion`)

Standardized transition values. Currently 94 `transition:` declarations in `app.css` use hardcoded values.

### Duration tokens

```css
:root {
  --duration-micro: 100ms;   /* toggles, checkbox, focus ring */
  --duration-fast: 150ms;    /* button hover, link hover, badge */
  --duration-normal: 250ms;  /* card hover, dropdown open, panel slide */
  --duration-slow: 400ms;    /* modal enter, carousel slide, page transition */
}
```

### Easing tokens

```css
:root {
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);     /* entrances — element appears */
  --ease-in: cubic-bezier(0.7, 0, 0.84, 0);       /* exits — element leaves */
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);  /* state changes — hover, toggle */
}
```

Three easings, not four. A "spring" easing is premature — no component uses it.

### Usage rules

| Interaction | Duration | Easing |
|------------|----------|--------|
| Button/link hover | `--duration-fast` | `--ease-in-out` |
| Focus ring | `--duration-micro` | `--ease-out` |
| Dropdown open | `--duration-normal` | `--ease-out` |
| Dropdown close | `--duration-fast` | `--ease-in` |
| Modal enter | `--duration-slow` | `--ease-out` |
| Modal exit | `--duration-normal` | `--ease-in` |
| Carousel slide | `--duration-slow` | `--ease-in-out` |
| Toggle switch | `--duration-fast` | `--ease-in-out` |

### Reduced motion

Already exists at line 3441 of `app.css`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

This is sufficient. No changes needed.

### Migration note

Migrating all 94 existing hardcoded transitions to tokens is Phase 2 work. For now: all new components MUST use motion tokens. Existing components are migrated incrementally.

### Visual demo

An interactive panel with a card that demonstrates each duration/easing combination. Buttons to trigger enter/exit/hover transitions at each speed.

---

## Section 9: Focus States (`#focus`)

### Global rule (replaces current broken rule at line 324)

```css
:focus-visible {
  outline: none;
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-accent) 35%, transparent);
}
```

The current rule uses `var(--black)` which is invisible on dark themes.

### Per-component overrides

Some components need adjusted focus treatment:

| Component | Focus treatment |
|-----------|----------------|
| **Button** | `box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-accent) 35%, transparent), var(--shadow-sm)` |
| **Input/Select** | `border-color: var(--color-accent); box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-accent) 35%, transparent)` |
| **Toggle** | `box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-accent) 35%, transparent)` on track |
| **Link** | `box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-accent) 35%, transparent); border-radius: 2px` |
| **Card (interactive)** | `box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-accent) 35%, transparent), var(--shadow-md)` |

### Phase 2: Retrofit

43 existing interactive components need `:focus-visible` audit. This is a separate work package. For Phase 1: the global rule catches everything, and new components use the token explicitly.

### Visual demo

Show each interactive component in focused state across all 3 themes. The accent-orange ring should be visible on all backgrounds.

---

## Section 10: Layout Primitives Decision Tree (`#primitives`)

Five layout tools exist. A developer must know which to use and when.

### One-line rules

| Primitive | Renders | Use when... |
|-----------|---------|-------------|
| **Section** | `<section>` | You have a titled block of content that should appear in sidebar navigation. Owns containment (maxWidth prop) and vertical spacing (spacing prop). |
| **Container** | `<div>` | You need max-width + centering OUTSIDE a section (e.g., header inner content, footer inner content). |
| **Stack** | `<div>` | You need to arrange children with consistent flex gap. Horizontal or vertical. |

### Composition examples

**Typical page section:**
```tsx
<Section id="stats" spacing="default" maxWidth="default">
  <Stack gap={4} direction="row" wrap>
    <StatCard ... />
    <StatCard ... />
  </Stack>
</Section>
```
Two levels: Section (containment + spacing) → Stack (arrangement). NOT three.

**Full-bleed section:**
```tsx
<Section id="hero" spacing="flush" bleed>
  <Stack gap={6} direction="column" align="center">
    <Heading level="display">HERO TEXT</Heading>
    <Button>Get Started</Button>
  </Stack>
</Section>
```
Section with `bleed` stretches to viewport. Inner content stays contained.

**Header inner content:**
```tsx
<header className="st-header">
  <Container variant="default">
    <Stack direction="row" align="center" justify="between">
      <Logo />
      <Nav />
    </Stack>
  </Container>
</header>
```
Container here because it's NOT a section — it's inside the header element.

**Dark hero section (forced dark on light page):**
```tsx
<Section id="hero" bleed spacing="flush" surface="inverse" paddingBlock="var(--space-24)">
  <Stack gap={8} direction="column" align="center">
    <Heading level="display">AFRICA'S $120B CRISIS</Heading>
    <CalloutStatGrid columns={3}>
      <CalloutStat value="$120B" label="Estimated Losses" />
      <CalloutStat value="54" label="Countries" />
    </CalloutStatGrid>
  </Stack>
</Section>
```
`surface="inverse"` scopes all child tokens to NearBlack palette. No inline color overrides needed — Heading, CalloutStat, AuthorCard etc. automatically get light text on dark background.

### Common pitfalls (things that usually indicate a simpler approach exists)

| Instead of... | Consider... | Why |
|---------------|-------------|-----|
| `<Section><Container><Stack>` | `<Section maxWidth="default"><Stack>` | Section owns containment — Container inside Section is redundant. |
| `<Stack>` for a page section | `<Section>` | If it has an id and title, Section gives you scroll anchoring and spacing for free. |
| `style={{ background: '#1C1C1A', color: '#F5F5F0' }}` on hero | `surface="inverse"` on Section | Hardcoded colors break when themes change. Surface prop scopes tokens. |
| Raw `<a>` for links | `<StyledLink>` | StyledLink provides focus ring, hover transitions, external icon. |

---

## Section 11: Responsive Behavior (`#responsive`)

### Breakpoints

| Name | Width | Changes |
|------|-------|---------|
| `mobile` | < 768px | Single column, stacked nav, hamburger menu |
| `tablet` | 768px – 1023px | 2-column grids, sidebar still visible |
| `desktop` | 1024px – 1279px | Full layout, 3-column grids |
| `wide` | >= 1280px | Max content width, 4-column grids possible |

### What happens at each breakpoint

| Element | Desktop (1024+) | Tablet (768-1023) | Mobile (< 768) |
|---------|-----------------|-------------------|----------------|
| Grid columns | 3-4 | 2 | 1 |
| Sidebar | Sticky left | Sticky left (narrower) | Hidden (hamburger) |
| Header nav | Horizontal links | Horizontal links | Hamburger menu |
| Card grid | 3 cols | 2 cols | 1 col (stacked) |
| Stat row | 4 inline | 2x2 grid | 2x2 grid |
| DataTable | Full columns | Horizontal scroll | Horizontal scroll |
| AuthForm | Centered card | Centered card | Full width |

### Fold line

"Above the fold" at 768px viewport height:
- Hero heading + subtitle must be visible
- At least 1 stat or CTA must be visible
- Navigation must be fully accessible
- No important content should be partially cut

### Visual demo

Show the responsive rules as a comparison table with miniature wireframes at each breakpoint. Use CSS grid with fixed-width containers to simulate each viewport.

**Note:** This is documentation only for current phase. Actual mobile implementation is future work.

---

## Section 12: Z-Index Scale (`#zindex`)

### Layers

| Layer | Z-Index | Elements |
|-------|---------|----------|
| Base content | `0` | Page body, cards, sections |
| Sticky sidebar | `10` | Design system sidebar, entity page sidebar |
| Dropdowns | `20` | Column header filters, avatar menu |
| Sticky header | `50` | Main site header |
| Design system toolbar | `99` | DS page header/tabs |
| Tooltips | `999` | Map tooltips, hover tooltips |
| Overlays | `9000` | PaywallGate blur, mobile menu backdrop |
| Modals | `9999` | Future modals, lightbox |
| Fixed footer | `100` | DS footer controls |
| Toast/notifications | `99999` | System notifications (future) |

### New tokens (add to `:root`)

```css
:root {
  --z-base: 0;
  --z-sticky: 10;
  --z-dropdown: 20;
  --z-header: 50;
  --z-toolbar: 99;
  --z-footer: 100;
  --z-tooltip: 999;
  --z-overlay: 9000;
  --z-modal: 9999;
}
```

### Visual demo

A 3D-perspective diagram showing stacked layers with labels. Can be built with CSS transforms:

```css
.st-zindex-demo {
  perspective: 800px;
  display: flex;
  flex-direction: column-reverse;
  align-items: center;
  gap: 4px;
}
.st-zindex-demo__layer {
  width: 300px;
  padding: 8px 16px;
  background: var(--color-accent-subtle);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-sm);
  font-size: var(--type-caption);
  transform: rotateX(40deg);
  text-align: center;
}
```

---

## Implementation Notes

1. **All demos use real library components** — StatCard, ContentCard, Badge, etc. No placeholder divs for things that have components.

2. **Each section follows the same pattern as the atoms page:** `<Section title="..." id="...">` with `scrollMarginTop` for anchor navigation.

3. **The page has its own sidebar** with the 12 sections listed above.

4. **New CSS tokens** (`--grid-*`, `--z-*`, `--duration-*`, `--ease-*`, `--leading-*`) should be added to the `:root` block in `app.css` near the existing spacing tokens.

5. **Current phase = Desktop + Comfortable.** Document mobile rules but don't build responsive demos. Show them as comparison tables and wireframe sketches.

6. **Motion token migration** of existing 94 transitions is Phase 2. All NEW components must use tokens.

7. **Focus state retrofit** of 43 existing components is Phase 2. The global rule and token are Phase 1.

---

## Templates Page — 5 Page Recipes

> **Route:** `/ui/templates` | **File:** `src/pages/design-system/DesignSystemTemplatesPage.tsx`
> **Purpose:** Examples showing how library components can be composed into real pages. Inspiration, not prescription.

Each recipe is a documented wireframe showing one possible way to assemble a page type. These are starting points — not the only valid approach. A developer building a new report page might use a completely different section order or layout. That's fine, as long as the atoms themselves are used correctly.

### Recipe 1: Report Page

Target: Long-form research documents like "Africa's $120B Crisis"

```
[Section: bleed, flush] Hero — Heading(display) + Stack(row) of Badge + CalloutStat grid
[Section: default, prose] Prose — ProseBlock with BulletSection(findings), embedded Image(figure)
[Section: tight, default] Data — DataTable or SimpleTable with stat highlights
[Section: default, prose] Analysis — ProseBlock with Callout(info) sidebars
[Section: default, default] Testimonial — TestimonialCarousel
[Section: tight, default] CTA — Button + StyledLink
```

### Recipe 2: Dashboard Page

Target: Tracker home, entity overview, CBDC tracker

```
[Section: tight, default] Top bar — BigStatRow (4 stats)
[Section: default, default] Map + Sidebar — Grid 8/4 with WorldMap + Stack of filters
[Section: default, default] Data grid — Stack of ContentCard(3-col) or DataTable
[Section: tight, default] Secondary stats — CalloutStat grid
```

### Recipe 3: Landing Page

Target: remide.xyz home, institute.remide.xyz home

```
[Section: bleed, flush] Hero — Heading(display) + body text + Button CTA
[Section: tight, default] Stats — BigStatRow or CalloutStat grid
[Section: default, default] Features — Card grid (3-col) using ContentCard
[Section: default, default] Testimonials — TestimonialCarousel
[Section: bleed, flush] CTA — full-bleed accent bg + Heading + Button
```

### Recipe 4: Detail/Entity Page

Target: EntityDetailPage, JurisdictionDetailPage, IssuerDetailPage, StablecoinDetailPage, CbdcDetailPage

> **Cycle 3 finding:** This is the most complex and highest-traffic page type. Simulation revealed 17 component gaps and 11 NearBlack theme failures. Key issues: no Grid/Col for main+sidebar, no KeyValueGrid for info pairs, no compact StatCard for sidebars. All are addressable with Phase 1 components + CSS grid inline (Grid/Col deferred to Phase 2).

```
[Page-level layout: CSS grid 1fr 280px with var(--space-8) gap]

  [Main column:]
    [Section: tight, default] Hero — Avatar(xl, rounded) + Heading(1) + Stack(row) of Badge + BigStatRow
    [Divider]
    [Section: tight, default] Info grid — CSS grid 200px 1fr with Label:value pairs
    [Divider]
    [Section: default, default] License table — FilterChip row + DataTable
    [Section: tight, default] Regulatory timeline — Timeline component
    [Section: default, default] Related — ContentCardGrid(3-col) of ContentCard

  [Sidebar (sticky, top: header-height + space-8):]
    Card: Quick links (anchor nav to sections)
    Card: Key stats (compact key-value pairs — NOT StatCard, too large)
    Button: "Report Issue"
```

**Key composition rules for this template:**
- Sidebar cards on NearBlack MUST use `--color-border-strong` (enforced by 0h CSS block)
- BigStatRow `valueFont="body"` for non-numeric values (LEI, country names)
- DataTable `hideSearch`/`hidePagination` if table has fewer than 10 rows
- Info grid labels use `Label` component or `--type-body-sm` + 600 weight + `--color-text-secondary`
- All section anchors need `scroll-margin-top` (handled by Section component)

**Until Grid/Col ships (Phase 2):** Use inline CSS grid for the page-level 2-column layout:
```css
.entity-detail-layout {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: var(--space-8);
  align-items: start;
}
```

### Recipe 5: Auth/Form Page

Target: LoginPage, SignupPage, ForgotPasswordPage, ResetPasswordPage

```
[Full-page layout: centered]
[Container: narrow] Card — Surface(raised) with:
  Heading(h2) + AuthForm(mode) + StyledLink("Back to home")
[Optional: background image or gradient]
```

### Template page sidebar

```typescript
const TEMPLATE_SECTIONS = [
  { id: 'report', label: 'Report' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'landing', label: 'Landing' },
  { id: 'detail', label: 'Detail / Entity' },
  { id: 'auth', label: 'Auth / Form' },
];
```

### Template demo pattern

Each recipe is rendered as:
1. **Wireframe diagram** — ASCII-art or CSS-drawn box layout showing section arrangement
2. **Component manifest** — table listing every component used, with props
3. **Live mini-preview** — a scaled-down (50%) rendering using actual components with placeholder data, all 3 themes switchable

---

## Appendix: Cycle 3 Simulation Report

### Build simulation results

Two pages were assembled from the library during Cycle 3 review:

**Report page (Kenji):** 21 gaps found. Critical: Section `surface="inverse"` needed for dark hero sections (added to Plan 01). Button variant vocabulary mismatch between spec and implementation. DataTable too complex for static report tables. Callout needs `tip` variant. ContentCard multi-badge needs gap CSS.

**Entity Detail page (Elena):** 17 gaps, 19 theme issues. Critical: Grid/Col needed for main+sidebar (deferred — use inline CSS grid). KeyValueGrid is a common missing pattern. NearBlack has 11 visual failures — all traced to `--color-border` at 0.06 opacity being invisible and `--color-text-secondary` failing WCAG AA. Focus ring broken on all dark themes.

### Confidence progression

| Cycle | Score | Reason |
|-------|-------|--------|
| Cycle 1 | n/a | Identified missing components and documentation |
| Cycle 2 | 62% | "Good but not Stripe-quality" — surface collapse, contrast failure, heading-role enforcement |
| Cycle 3 (pre-fix) | 28% | Entity detail page simulation — many raw HTML workarounds, 11 NearBlack failures |
| Cycle 3 (post-fix estimate) | ~80% | After token prerequisites (0c-0i) + 11 components + NearBlack border enforcement |

### Path to 80%+ confidence

| Work | Cost estimate | Impact |
|------|--------------|--------|
| Token prerequisites (Plan 01 §0a-0i) | ~2 hours | Removes 8 of 16 theme issues across all pages |
| Build Section + Stack + Container | ~4 hours | Eliminates all inline layout hacks |
| Build Avatar + StyledLink + Icon | ~4 hours | Removes 3 critical gaps |
| NearBlack border enforcement CSS (Plan 01 §0h) | ~1 hour | Removes 5 NearBlack visibility failures |
| Button variant/size fixes | ~1 hour | Unblocks all CTA patterns |
| ContentCard badge gap + Callout tip variant | ~30 min | Polish for report pages |
| **Total** | **~13 hours** | **All P0 and P1 gaps closed** |
