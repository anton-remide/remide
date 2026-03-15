# RemiDe Design Tokens Audit — Phase 0

**Generated**: 2026-03-07
**Framework**: Pure CSS + Bootstrap (CSS-only). No Tailwind.
**Fonts**: Google Fonts: DM Sans (body) + Doto (display/numbers)
**CSS File**: `src/styles/app.css` (5445 lines)

---

## 1. COLORS

### CSS Variables (root)
| Token | Value | Usage |
|-------|-------|-------|
| `--color-primary` | `#21201C` | Dark text |
| `--color-bg` | `#F6F2EE` | Light cream background |
| `--color-surface` | `#FFFFFF` | White surface |
| `--color-border` | `rgba(0, 0, 0, 0.08)` | Very subtle border |
| `--color-text-main` | `#21201C` | Primary text |
| `--color-text-secondary` | `#63635E` | Muted text |
| `--color-accent` | `#FF5F0F` | Orange — primary action |
| `--green` | `#22C55E` | Success state |
| `--bg-light` | `#FDFDFC` | Off-white |
| `--border-light` | `rgba(0, 0, 0, 0.06)` | Extra-light border |

### Accent Variations
- Default: `#FF5F0F`
- Hover: `#E95A12`
- Focus ring: `rgba(255, 95, 15, 0.25)`
- Focus shadow: `rgba(255, 95, 15, 0.16)`

### Semantic Colors
- Error bg: `#FFF0F0` / text: `#A93F3F` / border: `#F5D0D0`
- Success text: `#2B7A4B` / bg: `rgba(236, 253, 243, 0.8)` / border: `#5BB98C`

### Opacity Scale (base: `rgba(10, 37, 64, X)`)
3%, 4%, 6%, 8%, 10%, 12%, 15%, 18%, 25%, 30%

---

## 2. TYPOGRAPHY

### Fonts
- Body: `'DM Sans', sans-serif`
- Display: `'Doto', sans-serif`
- Feature settings: `'cv02', 'cv03', 'cv04', 'cv11'`

### Font Sizes (30+ values — NEEDS CONSOLIDATION)
9px, 10px, 11px, 11.5px, 12px, 12.5px, 13px, 14px, 15px, 16px (1rem),
17px, 18px, 20px, 22px, 24px, 28px, 36px + clamp() for responsive headings

### Font Weights: 400, 500, 600, 700, 800

### Line Heights: 1.08, 1.5, 1.55, 1.6, 1.65, 1.7

### Letter Spacing: -0.03em to 0.08em

---

## 3. SPACING (35+ values — NEEDS 8px BASELINE)
0, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 36, 40, 48, 56, 72, 100, 104, 110px

---

## 4. BORDER RADIUS (18 values — NEEDS CONSOLIDATION)
0, 3, 4, 5, 6, 8, 8.182, 10, 12, 14, 16, 24px, 50%, 9999px

---

## 5. SHADOWS (10+ patterns)
- Minimal: `0 1px 2px rgba(0, 0, 0, 0.04)`
- Subtle: `0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(10, 37, 64, 0.06)`
- Medium: `0 4px 16px rgba(10, 37, 64, 0.06)`
- Large: `0 8px 24px rgba(10, 37, 64, 0.12), 0 2px 6px rgba(10, 37, 64, 0.06)`
- Deep: `0 8px 30px rgba(10, 37, 64, 0.12), 0 2px 6px rgba(10, 37, 64, 0.06)`
- Focus: `0 0 0 3px rgba(255, 95, 15, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.04)`

---

## 6. Z-INDEX
| Value | Usage |
|-------|-------|
| 0-2 | Base, table sticky, map legend |
| 10 | Map overlays |
| 100 | Dropdown menu |
| 1000 | Header fixed |
| 2000 | Mobile menu |
| 9998-9999 | Modal backdrop + popup |

---

## 7. BREAKPOINTS
- Desktop: Default (1200px+)
- Tablet: 768px (hamburger appears)
- Small tablet: 600px
- Phone: 480px
- Small phone: 375px (iPhone SE)

---

## 8. ANIMATIONS
- Durations: 150ms (micro), 200ms (standard), 300ms (large)
- Prefers-reduced-motion: All disabled
- Keyframes: logoSpin, st-dropdown-in, searchExpand, st-pill-in, st-col-filter-in, st-slide-down, st-fade-in, st-bottom-sheet-in

---

## 9. KEY INCONSISTENCIES

### Critical
1. **Font sizes**: 30+ values — should be ~10 max
2. **Spacing**: 35+ values with no baseline grid — need 8px system
3. **Border radius**: 18 values — reduce to 6: 0, 4, 8, 12, 9999px
4. **Shadows**: 10+ patterns — standardize to 4 depth levels
5. **Card padding**: `.st-card` 24px vs `.st-feature-card` 36px vs info cards 12-24px

### Medium
6. **Z-index gaps**: 100 → 1000 with nothing between
7. **Line heights**: 6 different values (1.08-1.7) — need 3 max
8. **Color opacity**: 10+ different opacity values on same base color
9. **Button shadows**: Overly complex multi-layer with inset highlights

### Minor
10. **Animation naming**: Mixed prefixes (st-dropdown-in, searchExpand, st-pill-in)
11. **Placeholder colors**: `#999` vs `var(--text-muted)` — needs single token
12. **Mobile menu font**: 28px (too large vs 14px header nav)
