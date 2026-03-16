# RemiDe Design Token Specification

> **Version:** 1.0 | **Date:** 2026-03-15 | **Status:** Canonical
> **Decision:** Hard Work UI Ecosystem Upgrade — Cycles 1-2
> **Owner:** Design Owner (final arbiter on visual conflicts)

## Overview

Single source of truth for all visual tokens across RemiDe surfaces (tracker, institute, home, reports). Every component in the library consumes these tokens exclusively — no hardcoded hex, px, or rgba values in component code.

## Color Tokens (3 Themes)

All themes share the same warm color temperature (hue family H ≈ 48°, S ≈ 6-10%). DarkGray and NearBlack use warm neutrals, not cool slate/blue-gray.

### Core Surface & Text

| Token | Beige (Light) | DarkGray | NearBlack |
|---|---|---|---|
| `--color-bg` | `#F6F2EE` | `#1E1E1C` | `#111110` |
| `--color-surface` | `#FFFFFF` | `#282826` | `#1C1C1A` |
| `--color-surface-raised` | `#FFFFFF` | `#30302E` | `#242422` |
| `--color-text-main` | `#21201C` | `#EDEDEC` | `#EDEDEC` |
| `--color-text-secondary` | `#63635E` | `#9B9B97` | `#7C7C78` |
| `--color-border` | `rgba(33,32,28, 0.08)` | `rgba(255,255,250, 0.08)` | `rgba(255,255,250, 0.06)` |
| `--color-border-strong` | `rgba(33,32,28, 0.15)` | `rgba(255,255,250, 0.14)` | `rgba(255,255,250, 0.10)` |

### Accent

| Token | Beige | DarkGray | NearBlack |
|---|---|---|---|
| `--color-accent` | `#FF5F0F` | `#FF7A33` | `#FF7A33` |
| `--color-accent-hover` | `#E95A12` | `#FF8F52` | `#FF8F52` |
| `--color-accent-subtle` | `rgba(255,95,15, 0.08)` | `rgba(255,95,15, 0.12)` | `rgba(255,95,15, 0.15)` |

Note: canonical brand orange is `#FF5F0F`. Dark themes use `#FF7A33` (lightened) to maintain vibrancy against warm-dark backgrounds.

### Semantic Colors

| Token | Beige | DarkGray / NearBlack |
|---|---|---|
| `--color-success` | `#2B7A4B` | `#3ECF71` |
| `--color-success-subtle` | `#F0FDF4` | `rgba(62,207,113, 0.10)` |
| `--color-warning` | `#92610B` | `#E8A317` |
| `--color-warning-subtle` | `#FFFBEB` | `rgba(232,163,23, 0.10)` |
| `--color-danger` | `#B91C1C` | `#EF5350` |
| `--color-danger-subtle` | `#FEF2F2` | `rgba(239,83,80, 0.10)` |
| `--color-info` | `#4338CA` | `#818CF8` |
| `--color-info-subtle` | `#EEF2FF` | `rgba(129,140,248, 0.10)` |
| `--color-neutral` | `#63635E` | `#9B9B97` |
| `--color-neutral-subtle` | `#F1F5F9` | `rgba(155,155,151, 0.08)` |

Dark-mode semantic pattern: use `rgba(semantic-hue, 0.10–0.12)` for subtle backgrounds instead of hardcoded pastel hex.

---

## Type Scale (10 Sizes)

Fonts: DM Sans (`--font1`) for body/UI; Doto (`--font2`) for display/headings.

| Token | Size | Line-height | Weight | Usage |
|---|---|---|---|---|
| `--type-display` | `clamp(36px, 5vw, 56px)` | `1.08` | 700 | Hero h1 (Doto) |
| `--type-heading-1` | `clamp(26px, 3.5vw, 36px)` | `1.08` | 700 | Page title, h2 (Doto) |
| `--type-heading-2` | `22px` | `1.15` | 600 | Section h3, card group titles |
| `--type-heading-3` | `18px` | `1.25` | 600 | Card title, subsection h4 |
| `--type-body-lg` | `16px` | `1.6` | 400 | Default body, paragraphs, long-form |
| `--type-body` | `14px` | `1.55` | 400 | Table cells, secondary copy |
| `--type-body-sm` | `13px` | `1.5` | 400 | Compact UI text, form hints |
| `--type-caption` | `12px` | `1.5` | 500 | Labels, metadata, timestamps |
| `--type-micro` | `11px` | `1.45` | 500 | Badge text, tiny labels |
| `--type-nano` | `10px` | `1.4` | 600 | Minimal annotations |

### Elimination Map

| Kill | Map to |
|---|---|
| 9px | `nano` (10px) |
| 11.5px | `micro` (11px) |
| 12.5px | `caption` (12px) |
| 15px | `body` (14px) or `body-lg` (16px) |
| 17px | `body-lg` (16px) |
| 20px | `heading-3` (18px) |
| 24px | `heading-2` (22px) |
| 28px | absorbed into `heading-1` clamp |

---

## Spacing Scale (4px Grid)

| Token | Value | Usage |
|---|---|---|
| `--space-0` | `0` | Reset |
| `--space-0-5` | `2px` | Hairline gap (icon-text micro-adjust) |
| `--space-1` | `4px` | Tight inline gap, badge padding-x |
| `--space-2` | `8px` | Small gap, input padding, compact cell padding |
| `--space-3` | `12px` | Default cell padding, card gap, button padding-y |
| `--space-4` | `16px` | Section gap, card padding (compact), button padding-x |
| `--space-6` | `24px` | Card padding (comfortable), section margin |
| `--space-8` | `32px` | Section spacing, large gap |
| `--space-12` | `48px` | Header-content gap, major section break |
| `--space-16` | `64px` | Page section padding-y |
| `--space-24` | `96px` | Hero vertical padding |

---

## Shadow Scale (4 Levels + Focus Ring)

Theme-aware: dark modes use higher opacity because shadows against dark backgrounds are less perceptible.

| Token | Beige | DarkGray | NearBlack |
|---|---|---|---|
| `--shadow-none` | `none` | `none` | `none` |
| `--shadow-sm` | `0 1px 2px rgba(33,32,28,0.05), 0 1px 3px rgba(33,32,28,0.07)` | `0 1px 2px rgba(0,0,0,0.20), 0 1px 3px rgba(0,0,0,0.15)` | `0 1px 2px rgba(0,0,0,0.30), 0 1px 3px rgba(0,0,0,0.20)` |
| `--shadow-md` | `0 4px 12px rgba(33,32,28,0.06), 0 1px 3px rgba(33,32,28,0.04)` | `0 4px 12px rgba(0,0,0,0.25), 0 1px 3px rgba(0,0,0,0.15)` | `0 4px 12px rgba(0,0,0,0.35), 0 1px 3px rgba(0,0,0,0.20)` |
| `--shadow-lg` | `0 8px 24px rgba(33,32,28,0.10), 0 2px 6px rgba(33,32,28,0.06)` | `0 8px 24px rgba(0,0,0,0.35), 0 2px 6px rgba(0,0,0,0.20)` | `0 8px 24px rgba(0,0,0,0.45), 0 2px 6px rgba(0,0,0,0.25)` |
| `--shadow-focus` | `0 0 0 3px rgba(255,95,15,0.25)` | `0 0 0 3px rgba(255,95,15,0.35)` | `0 0 0 3px rgba(255,95,15,0.40)` |

---

## Radius Scale (5 Values)

| Token | Value | Usage |
|---|---|---|
| `--radius-0` | `0` | Tables, dividers, sharp edges |
| `--radius-sm` | `4px` | Badges, small inputs, chips |
| `--radius-md` | `8px` | Buttons, dropdowns |
| `--radius-lg` | `16px` | Cards, modals, popovers |
| `--radius-pill` | `9999px` | Pills, full-round tags |

---

## Density System

Two density modes via `data-density` attribute on wrapper elements. Default (no attribute) = comfortable.

### Token Overrides

| Density Token | Comfortable | Compact |
|---|---|---|
| `--density-font-body` | `14px` (body) | `13px` (body-sm) |
| `--density-font-caption` | `12px` (caption) | `11px` (micro) |
| `--density-line-height` | `1.55` | `1.4` |
| `--density-padding-y` | `12px` (space-3) | `8px` (space-2) |
| `--density-padding-x` | `16px` (space-4) | `12px` (space-3) |
| `--density-gap` | `12px` (space-3) | `8px` (space-2) |
| `--density-row-height` | `48px` | `36px` |
| `--density-card-padding` | `24px` (space-6) | `16px` (space-4) |

### Which Components Get Density

Gets density: DataTable, Badge, ColumnHeaderFilter, SegmentedControl, Breadcrumb, InfoRow, Button (in-context).

Does NOT get density: WorldMap, HeroMapCanvas, PaywallGate, FloatingCTA, Header, Footer, TopBanner, PageLoader, ErrorBoundary.

---

## Cascade Strategy

CSS Layers for deterministic cascade ordering:

```css
@layer reset, vendor, tokens, components, pages, utilities;
```

| Layer | Contains | Priority |
|---|---|---|
| `reset` | Minimal box-sizing reset | Lowest |
| `vendor` | Bootstrap import, MapLibre CSS | ↑ |
| `tokens` | `:root` vars, `[data-theme]` overrides, `[data-density]` overrides | ↑ |
| `components` | All `st-*` classes | ↑ |
| `pages` | Page-specific `st-*` blocks | ↑ |
| `utilities` | One-off overrides, `.sr-only`, keyframes | Highest |

New React components use CSS Modules (`*.module.css`) authored inside `@layer components`.

---

## Canonical Library Structure

### Atoms (15)

Button, Badge, Icon, Input, Label, Link, Divider, Heading, Text, Chip, Avatar, Spinner, Toggle, Image, SkipLink

### Molecules (20)

SearchBar, StatCard, FilterChipGroup, Breadcrumb, InfoRow, SegmentedControl, ColumnHeaderFilter, FormField, ContentCard, CTABlock, TestimonialCard, AccordionItem, PullQuote, SectionHeader, AuthorCard, ImageHeader, LogoBar, BulletItem, PhaseCard, NavItem

### Organisms (23)

Header (4 modes), Footer (2 variants), TopBanner, MobileMenu, MobileSearchOverlay, DataTable (full/simple), WorldMap, HeroWorldMapCanvas, SidebarNav, ContentCardGrid, TestimonialCarousel, StepFlow, Accordion, PaywallGate, FloatingPaywallCTA, AuthForm, BulletSection, ProseBlock, Timeline, BigStatRow, ErrorBoundary, PageLoader, ProtectedRoute

### Templates (11)

MarketingLanding, TrackerLanding, TrackerList, TrackerDetail, TrackerAuth, DocsArticle, DocsHub, DocsPlaybook, ReportPage, PricingPage, ErrorPage

---

## Build Sequence (after token normalization)

1. **Badge** — zero dependencies, brand canon, used everywhere
2. **StatCard** — authority signal, shareable numbers
3. **AccordionItem → Accordion** — enables deep analytical content
4. **DataTable** — crown jewel, intelligence platform differentiator
5. **ContentCard** — hub builder, content navigation

First complete template: **ReportTemplate** (16 components total: 6 atoms + 5 molecules + 4 organisms + 1 template).

---

## Dead Code to Remove

- `PaywallOverlay` (superseded by PaywallGate)
- `ContactForm` (zero imports)
- `SearchInput` (ui/) (merged into SearchBar)
- `FilterChips` (ui/) (pattern → Chip + FilterChipGroup)
- `StatCard` (ui/) (zero imports, replaced by canonical)

---

## Signature Elements (frozen design)

1. **WorldMap** — 4 regulatory data modes, brand visual identity
2. **Badge System** — SEMANTIC_SWATCHES as brand canon, regulatory status language
3. **PaywallGate** — blur over real data, FT-grade premium gate

---

## Quality Gate Checklist

Every component must pass before entering the library:

- [ ] Zero hardcoded colors (all via `var(--*)`)
- [ ] Zero hardcoded font-sizes (all from 10-step type scale)
- [ ] Zero hardcoded spacing (all from 4px grid tokens)
- [ ] 3-theme render test (Beige, DarkGray, NearBlack)
- [ ] WCAG AA contrast (4.5:1 normal text, 3:1 large text) on all themes
- [ ] Theme-aware shadows (not absolute rgba)
- [ ] Density modes work correctly where applicable
- [ ] Responsive at 375px, 768px, 1280px
- [ ] Keyboard navigable, screen-reader compatible
- [ ] No inline `style={{}}` except `inline-dynamic-ok:` marked cases
- [ ] Design owner visual sign-off
