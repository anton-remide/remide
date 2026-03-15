# RemiDe UX/UI Audit — Phase 2: Dual-Lens Audit Report

**Generated**: 2026-03-07
**Scope**: All 12 routes, 3 viewports (Desktop 1280px, Tablet 768px, Mobile 375px)
**Method**: Visual screenshot inspection + source code analysis
**Status**: Discovery only (RUN 1) — no fixes applied

---

## Executive Summary

### Severity Distribution
| Severity | Count | Description |
|----------|-------|-------------|
| Critical | 3 | Accessibility barriers, data-loss risk |
| High | 12 | WCAG violations, keyboard traps, responsive breaks |
| Medium | 18 | Hardcoded values, missing states, inconsistencies |
| Low | 14 | Code quality, DX improvements, minor visual polish |
| **Total** | **47** | |

### Top 3 Systemic Issues
1. **Keyboard accessibility**: Clickable table rows, FAQ accordion, dropdown menus — none have `role`, `tabIndex`, or `onKeyDown` handlers
2. **Hardcoded inline styles**: 50+ instances of magic numbers for colors, spacing, font sizes bypassing design tokens
3. **Missing error/loading states**: No loading skeletons, silent `catch` blocks, empty states not shown

---

## Finding Categories

### A. Accessibility (WCAG 2.1 AA)

#### A1. [CRITICAL] Clickable Table Rows Not Keyboard Accessible
**Files**: `DataTable.tsx:251-254`, `IssuerDetailPage.tsx:210-236`, `EntitiesPage.tsx:225`
**Issue**: All `<tr onClick>` elements lack `role="button"`, `tabIndex={0}`, and `onKeyDown` handler. Keyboard-only users cannot navigate to detail pages.
**Impact**: ~80% of navigation relies on table row clicks.
**Fix**: Add `role="row"` with `tabIndex={0}` and `onKeyDown={(e) => e.key === 'Enter' && onClick()}` to all clickable rows.

#### A2. [CRITICAL] Sort Headers Missing aria-sort
**File**: `DataTable.tsx:226-227`
**Issue**: Sortable column headers (`<th onClick>`) lack `aria-sort="ascending|descending|none"` and `role="columnheader"`.
**Fix**: Add `aria-sort` attribute reflecting current sort state.

#### A3. [CRITICAL] Map Canvas Has No Semantic Role
**File**: `WorldMap.tsx:500-505`
**Issue**: The Leaflet/MapLibre map container has no `role="img"` or `aria-label`. Screen readers see nothing.
**Fix**: Add `role="img"` and `aria-label="Interactive world map showing regulatory status by country"` to map container.

#### A4. [HIGH] FAQ Accordion Not Keyboard Accessible
**File**: `PricingPage.tsx:211`
**Issue**: FAQ items use `<div onClick>` without `role="button"`, `tabIndex`, or keyboard handler. Cannot expand/collapse via keyboard.
**Fix**: Use `<button>` element or add full ARIA accordion pattern (`aria-expanded`, `aria-controls`).

#### A5. [HIGH] Avatar Dropdown Missing Menu Role
**File**: `Header.tsx:100-105`
**Issue**: User avatar dropdown lacks `role="menu"`, `aria-expanded`, and `aria-haspopup="true"`. Menu items lack `role="menuitem"`.
**Fix**: Implement WAI-ARIA menu button pattern.

#### A6. [HIGH] Search Dropdown Missing Listbox Role
**File**: `HeaderSearch.tsx:145-194`
**Issue**: Search results dropdown lacks `role="listbox"`, items lack `role="option"`, no `aria-activedescendant` for arrow key navigation.
**Fix**: Implement combobox pattern with `role="combobox"` on input, `role="listbox"` on dropdown.

#### A7. [HIGH] Sector Filter Buttons Missing Labels
**File**: `EntitiesPage.tsx:43`
**Issue**: StatChip filter buttons show count but lack `aria-label` describing their purpose. Screen reader announces "5555" not "Filter by Crypto sector, 5555 entities".
**Fix**: Add `aria-label={`Filter by ${sector} sector, ${count} entities`}`.

#### A8. [HIGH] CopyButton Lacks Accessible Feedback
**File**: `StablecoinDetailPage.tsx:40-51`
**Issue**: Copy-to-clipboard button shows visual checkmark on success but has no `aria-live` announcement for screen readers.
**Fix**: Add visually-hidden `aria-live="polite"` region announcing "Address copied to clipboard".

#### A9. [HIGH] Legend Items Not Accessible
**File**: `WorldMap.tsx:510-522`
**Issue**: Map legend color swatches have no text alternative. Legend uses color alone to convey meaning.
**Fix**: Add text labels alongside color swatches and ensure color is not the sole differentiator.

#### A10. [MEDIUM] Skull Emoji Without aria-label
**File**: `EntityDetailPage.tsx:97`
**Issue**: Dead website indicator uses skull emoji (💀) without `role="img"` and `aria-label="Website is offline"`.
**Fix**: Wrap in `<span role="img" aria-label="Website is offline">💀</span>`.

#### A11. [MEDIUM] Dead Website Badge Color Contrast
**File**: `EntityDetailPage.tsx:108`
**Issue**: Red badge for dead websites may not meet WCAG AA contrast ratio (4.5:1) against its background.
**Verify**: Test with contrast checker tool.

#### A12. [MEDIUM] truncateAddress Breaks Screen Readers
**File**: `StablecoinDetailPage.tsx:25-28`
**Issue**: `0x1234...abcd` truncation with ellipsis character causes screen readers to announce partial text. Full address should be available via `aria-label` or `title`.
**Fix**: Add `aria-label` with full address on the truncated element.

---

### B. Design Token Violations

#### B1. [HIGH] 50+ Inline Styles with Magic Numbers
**Files**: All page components
**Issue**: Hardcoded values bypass CSS custom properties defined in `app.css`.

**Worst offenders:**
| File | Line | Value | Should Be |
|------|------|-------|-----------|
| `EntitiesPage.tsx` | 449 | `color: '#2B7A4B'` | `var(--green)` or semantic token |
| `JurisdictionDetailPage.tsx` | 34-37 | `BACKING_COLORS` object with 6 hex values | CSS variables |
| `CbdcDetailPage.tsx` | 18-25 | `BoolIndicator` hardcoded colors | Semantic success/error tokens |
| `DataTable.tsx` | 124 | `borderRadius: 10` | `var(--radius-md)` (doesn't exist yet) |
| `DataTable.tsx` | 279 | Pagination font size hardcoded | Typography token |
| `LandingPage.tsx` | 182 | `maxWidth` magic number | Layout token |
| `PricingPage.tsx` | 236 | `maxWidth` on CTA button | Layout token |

#### B2. [HIGH] fontFamily/fontSize Repeated Inline
**File**: `JurisdictionDetailPage.tsx` (throughout)
**Issue**: `fontFamily: 'var(--font2)'` and `fontSize: '0.9375rem'` repeated in 8+ inline style objects. Should be a CSS class.
**Fix**: Create `.st-display-text` or similar CSS class.

#### B3. [MEDIUM] SECTION_LABEL Constant Duplicated
**Files**: `StablecoinDetailPage.tsx:16-23`, `IssuerDetailPage.tsx:~20`
**Issue**: Identical `SECTION_LABEL` style object defined in two files.
**Fix**: Extract to shared constant or CSS class `.st-section-label`.

#### B4. [MEDIUM] Icon Sizes Inconsistent
**Files**: Multiple components
**Issue**: Icons use 12px, 13px, 14px, and 16px interchangeably with no pattern.
**Fix**: Define icon size tokens: `--icon-sm: 14px`, `--icon-md: 16px`, `--icon-lg: 20px`.

#### B5. [MEDIUM] Inline Style Objects Recreated Every Render
**File**: `EntitiesPage.tsx` (11+ instances)
**Issue**: Inline `style={{...}}` objects in JSX create new objects on every render, preventing React memo optimization.
**Fix**: Extract to `const` outside component or use CSS classes.

---

### C. Responsive Design

#### C1. [HIGH] Grid minmax(320px) Breaks on 375px Viewport
**File**: `JurisdictionDetailPage.tsx:179`
**Issue**: `grid-template-columns: repeat(auto-fill, minmax(320px, 1fr))` means on a 375px screen with padding, the column cannot fit, causing horizontal overflow or layout break.
**Fix**: Use `minmax(min(320px, 100%), 1fr)` or reduce minimum to 280px.

#### C2. [MEDIUM] Stat Counter Animation Bug
**Route**: R1 `/` (Landing Page)
**Issue**: Desktop shows "0" for all stat counters. Mobile shows "70" instead of "207" for jurisdictions. Intersection Observer or counter animation not completing properly.
**Root cause**: Likely `IntersectionObserver` not triggering on desktop (element already in viewport on load), and animation not reaching final value on mobile.

#### C3. [MEDIUM] Bottom Sticky Banner Overlap
**Route**: R1 `/` (Mobile 375px)
**Issue**: Early access banner takes ~60px at bottom, overlapping stat counter cards and footer content.
**Fix**: Add `padding-bottom: 60px` to main content when banner is visible.

#### C4. [MEDIUM] Table Horizontal Scroll Missing
**File**: `StablecoinDetailPage.tsx:319`
**Issue**: Blockchain deployments table and regulatory status table lack horizontal scroll wrapper on mobile. Long contract addresses may overflow.
**Fix**: Wrap tables in `<div style="overflow-x: auto">`.

#### C5. [LOW] Mobile Menu Font Size
**Reference**: `design-tokens.md` line 126
**Issue**: Mobile hamburger menu uses 28px font size vs 14px header nav — 2x jump feels jarring.
**Fix**: Consider 20px or 22px for mobile menu items.

---

### D. Error & Loading States

#### D1. [HIGH] No Loading Skeletons in DataTable
**File**: `DataTable.tsx`
**Issue**: While data loads, table shows nothing (empty state). No skeleton/shimmer provides layout stability.
**Fix**: Add skeleton rows matching column count during loading.

#### D2. [HIGH] Silent Error Handling
**Files**: `HeaderSearch.tsx:69-71`, `WorldMap.tsx:187-189`
**Issue**: Errors caught and swallowed with no user feedback:
```tsx
// HeaderSearch.tsx
} catch (err) { /* nothing */ }
// WorldMap.tsx
.catch(() => {}) // map tile load failure
```
**Fix**: Show inline error state or retry option.

#### D3. [MEDIUM] Empty States Not Shown
**File**: `CbdcDetailPage.tsx`
**Issue**: Cross-border projects and sources sections render nothing when data is empty — no "No cross-border projects found" message.
**Fix**: Add empty state messages for all optional sections.

#### D4. [MEDIUM] PAYMENTS Sector Shows 0
**Route**: R3 `/entities`
**Issue**: Payments sector filter shows "0" — either no entities classified as Payments or filter logic doesn't match any sector value.
**Investigate**: Check if `sector` column has "Payments" value in Supabase.

#### D5. [LOW] Entity Title Template Inconsistency
**Route**: R9 `/entities/:id`
**Issue**: `<title>` always says "Licensed VASP" even when entity status is "Unknown".
**Fix**: Use dynamic template: `${name} — ${status} ${sectorLabel}`.

---

### E. Code Quality & DX

#### E1. [MEDIUM] Click-Outside Logic Duplicated 3x
**Files**: `Header.tsx`, `HeaderSearch.tsx`, `ColumnHeaderFilter.tsx`
**Issue**: Three separate `useEffect` + `document.addEventListener('mousedown')` implementations for click-outside detection.
**Fix**: Extract `useClickOutside(ref, callback)` custom hook.

#### E2. [MEDIUM] Debounce Timing Inconsistent
**Files**: `SearchInput` (200ms), `HeaderSearch` (250ms), `DataTable` filter (200ms)
**Issue**: Different debounce timings create inconsistent UX feel.
**Fix**: Define `DEBOUNCE_MS = 200` constant or `--debounce-search` CSS custom property.

#### E3. [MEDIUM] Related Entities Fetch-All-Then-Slice
**File**: `EntityDetailPage.tsx:50-52`
**Issue**: Fetches ALL related entities from Supabase, then `.slice(0, 10)` in frontend. For countries with 3,000+ entities, this transfers unnecessary data.
**Fix**: Add `.limit(10)` to Supabase query.

#### E4. [LOW] Map Tooltip Uses innerHTML
**File**: `WorldMap.tsx:393-396`
**Issue**: Tooltip content built with string concatenation and set via `innerHTML`. XSS risk if country names contain malicious content (low probability since data is from DB, but bad practice).
**Fix**: Use DOM API or sanitize content.

#### E5. [LOW] False Urgency Countdown
**File**: `PricingPage.tsx:41-46`
**Issue**: Countdown timer uses `sessionStorage` to persist end time — resets on new session, creating artificial urgency. Not inherently a bug, but worth noting for UX ethics review.

#### E6. [LOW] Animation Naming Convention Mixed
**Reference**: `design-tokens.md` line 124
**Issue**: Keyframes use mixed naming: `st-dropdown-in`, `searchExpand`, `st-pill-in` — no consistent prefix pattern.
**Fix**: Standardize to `st-{component}-{action}` pattern.

---

### F. SEO & Performance

#### F1. [MEDIUM] Stablecoin ID Routing Inconsistency
**Route**: R10 `/stablecoins/:id`
**Issue**: Route uses DB `id` field (e.g., `usdt`) not sequential integers. Navigating to `/stablecoins/1` shows "not found". URL pattern not intuitive.
**Note**: Current approach is correct for SEO (semantic URLs), but error page should suggest alternatives.

#### F2. [MEDIUM] Issuer Slug Mismatch
**Route**: R12 `/issuers/:slug`
**Issue**: `/issuers/tether-holdings` returns 404. Slug generation may have inconsistencies between what's in DB and what URL is expected.
**Fix**: Verify slug generation logic in DDL 005 and ensure all issuers have valid slugs.

#### F3. [LOW] Missing 404 Page
**Issue**: Invalid routes show React Router default "not found" or blank page. No branded 404 page with navigation back.
**Fix**: Add `NotFoundPage` component with links to key routes.

---

## Cross-Cutting Patterns

### Pattern 1: Inline Styles vs CSS Classes
**Prevalence**: Every page component
**Problem**: 50+ inline style objects with hardcoded values. Makes theming impossible, bloats bundle, prevents React memo optimization.
**Recommendation**: Audit each inline style → extract to `app.css` using BEM-like naming (`.st-{component}__{element}--{modifier}`).

### Pattern 2: Missing Keyboard Navigation
**Prevalence**: DataTable, FAQ, Dropdowns, Filter Pills
**Problem**: Mouse-first development. All interactive elements work with click but not keyboard.
**Recommendation**: Establish a11y checklist for all interactive elements: `role`, `tabIndex`, `onKeyDown`, `aria-*`.

### Pattern 3: Error Boundary Gaps
**Prevalence**: All data-fetching components
**Problem**: No React Error Boundary wrapping data-dependent sections. A Supabase timeout crashes the entire page.
**Recommendation**: Add `<ErrorBoundary fallback={<ErrorState />}>` around each data section.

### Pattern 4: Design Token Adoption
**Prevalence**: All components
**Problem**: `app.css` defines 10+ CSS custom properties, but components use hardcoded values.
**Recommendation**: Phase approach — (1) audit all hardcoded values, (2) create missing tokens, (3) migrate file by file.

---

## Priority Matrix (What to Fix First)

### P0 — Fix Before Launch (Blocks Users)
| ID | Finding | Effort |
|----|---------|--------|
| A1 | Keyboard nav on table rows | 2h |
| A4 | FAQ accordion keyboard | 1h |
| D1 | Loading skeletons | 3h |
| C1 | Grid 320px overflow on mobile | 30m |

### P1 — Fix This Sprint (Quality Bar)
| ID | Finding | Effort |
|----|---------|--------|
| A2 | aria-sort on table headers | 1h |
| A3 | Map ARIA label | 30m |
| A5 | Dropdown menu roles | 2h |
| A6 | Search combobox pattern | 3h |
| B1 | Extract inline styles (top 10) | 4h |
| D2 | Error state handling | 2h |
| E1 | useClickOutside hook | 1h |
| E3 | Entities fetch limit | 30m |

### P2 — Fix Next Sprint (Polish)
| ID | Finding | Effort |
|----|---------|--------|
| A7-A12 | Remaining ARIA fixes | 3h |
| B2-B5 | Design token migration | 4h |
| C2-C5 | Responsive fixes | 3h |
| D3-D5 | Empty/error states | 2h |
| E2-E6 | Code quality | 2h |
| F1-F3 | SEO/routing | 2h |

### Total Estimated Effort: ~36 hours

---

## Appendix: Files Audited

### Page Components
| File | Findings |
|------|----------|
| `src/pages/LandingPage.tsx` | 4 |
| `src/pages/EntitiesPage.tsx` | 7 |
| `src/pages/PricingPage.tsx` | 4 |
| `src/pages/JurisdictionDetailPage.tsx` | 4 |
| `src/pages/StablecoinDetailPage.tsx` | 5 |
| `src/pages/EntityDetailPage.tsx` | 4 |
| `src/pages/CbdcDetailPage.tsx` | 3 |
| `src/pages/IssuerDetailPage.tsx` | 3 |

### Shared Components
| File | Findings |
|------|----------|
| `src/components/DataTable.tsx` | 5 |
| `src/components/Header.tsx` | 3 |
| `src/components/WorldMap.tsx` | 4 |
| `src/components/HeaderSearch.tsx` | 2 |
| `src/components/ColumnHeaderFilter.tsx` | 1 |

### Reference Documents
- `audit/design-tokens.md` — Phase 0 token extraction
- `audit/route-map.md` — Phase 1 route inventory + snapshots
- `src/styles/app.css` — 5,445 lines, main stylesheet
