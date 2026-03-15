# RemiDe UX/UI Audit — Phase 4: Space Utilization Analysis

**Generated**: 2026-03-07
**Method**: DOM measurements via `getBoundingClientRect()` + `getComputedStyle()`
**Viewport**: 1650×1082px (desktop)

---

## Executive Summary

The platform uses a rigid `max-width: 1200px` container across all pages, leaving 450px of unused horizontal space on standard monitors. Vertical space is consumed heavily by navigation chrome (35% on Entities, 76% on Jurisdictions) before data rows become visible. Entity detail pages spread 4 short key-value pairs across 1100px width — 70% whitespace.

### Severity Distribution
| Severity | Count |
|----------|-------|
| High | 2 |
| Medium | 2 |
| Low | 1 |
| **Total** | **5** |

---

## Findings

### S1. [HIGH] Entity Detail — Info Card Wastes 70% Width

**Page**: `/entities/:id` (e.g., `/entities/us-coinbase-inc`)
**Measurement**:
- Info card width: **1102px**
- Content per row: label ~120px + value ~200px = **~320px useful**
- Rows: 4 (Country, Regulator, License Type, License Number)
- Card height: 223px for 4 × 43px rows

**Problem**: A 1102px-wide card displays 4 short key-value pairs. 70% of the horizontal space is empty. The page overall feels sparse: breadcrumb + title + 4 info rows + 2 activity pills + invisible "Other entities" section (opacity:0 bug).

**Total page height**: 1162px — barely fills viewport, yet feels empty.

**Recommendation**:
- Option A: 2-column info card (8 fields in 2×4 grid instead of 1×4 list)
- Option B: Sidebar layout — info card left (400px) + additional content right (enrichment data, related entities, timeline)
- Option C: Compact card (max-width: 600px) aligned left, with right column for future content

---

### S2. [HIGH] Entities Page — 35% of Viewport is Chrome Above Data

**Page**: `/entities`
**Measurement**:

| Zone | Height | % Viewport |
|------|--------|------------|
| Header | 80px | 7.4% |
| Gap to filters | 20px | 1.8% |
| Sector filter pills (row 1) | ~44px | 4.1% |
| Region filter pills (row 2) | ~44px | 4.1% |
| Subtitle text | ~22px | 2.0% |
| Tabs (Entities/Stablecoins/CBDCs/Issuers) | ~48px | 4.4% |
| Table header + "Showing X of Y" bar | ~124px | 11.5% |
| **Total chrome** | **382px** | **35.3%** |
| **Visible data rows** | **700px (14 rows × 48px)** | **64.7%** |

**Problem**: On a 1082px viewport, user sees only **14 of 11,030 rows**. The 2-row filter area (sector + region = 14 pills) consumes 110px. On a 1650px-wide screen, all 14 pills could fit in a single row.

**Recommendation**:
- Compact filters: single row with horizontal scroll for overflow pills
- Collapsible filter panel (default collapsed, expandable)
- Sticky table header so column labels stay visible during scroll
- Consider virtual scrolling for 11K+ row dataset

---

### S3. [MEDIUM] Jurisdictions Page — Map Takes 76% of Initial Viewport

**Page**: `/jurisdictions`
**Measurement**:

| Zone | Height | Bottom Position |
|------|--------|-----------------|
| Header | 80px | 80px |
| Map tabs | ~8px | 88px |
| Map frame | 565px | 653px |
| Mini-stats | ~47px | 640px |
| Insight panel | 42px | 711px |
| Gap | ~24px | 735px |
| **Table starts at** | — | **820px** |

**Problem**: At viewport 1082px, the data table starts at 820px — leaving only **262px (24%) for data**. User sees ~5-6 table rows on initial load. The map is the primary visualization, but 565px is tall for a world map that's wider than it is tall.

**Recommendation**:
- Reduce map height to 380-420px (map aspect ratio is ~2:1, so 400px is still generous)
- Or: split-view layout — map left (60%), table right (40%) on wide screens
- Or: collapsible map with "Show/Hide Map" toggle
- Move mini-stats into a horizontal bar between map and table instead of overlaying

---

### S4. [MEDIUM] max-width: 1200px Wastes 450px on Wide Screens

**All pages**: `.st-page { max-width: 1200px; margin: 0 auto; }`
**Measurement**: Viewport 1650px → side margins 225px + 225px = **450px wasted**

**Affected pages**:
| Page | Content at 1200px | Would benefit from wider |
|------|-------------------|-------------------------|
| `/entities` | 6-column table (300+120+173+133+275+148 = 1149px) | Yes — could show 7-8 columns (website, date) |
| `/jurisdictions` | Map + table stacked | Yes — side-by-side layout possible |
| `/jurisdictions/:code` | Info card + mini-map stacked to side | Already uses 2-col, OK |
| `/stablecoins/:id` | Info card + tables | Yes — 2-col for blockchain + regulatory tables |
| `/pricing` | Marketing layout | No — 1200px is fine for marketing |

**Recommendation**:
- Data pages: `max-width: min(1440px, 95vw)` or fluid layout
- Marketing pages (landing, pricing): keep 1200px
- Or: define two container widths: `.st-page--wide { max-width: 1440px }` for data, `.st-page` for marketing

---

### S5. [LOW] Pricing Page — Excessive Section Padding

**Page**: `/pricing`
**Measurement**:

| Section | Height | Padding Top | Padding Bottom |
|---------|--------|-------------|----------------|
| Hero (.st-hero) | 574px | 80px | 64px |
| Stats section | 263px | 0px | 80px |
| Features grid | 539px | 0px | 96px |
| Early access | 459px | 0px | 64px |
| Subscribe | 196px | 0px | 32px |

**Total scroll height**: 2031px (1.88× viewport)
**Pure padding between sections**: ~300px (14.7% of total height)

**Problem**: For a single pricing page, 2× viewport scroll is normal for marketing. But the 64-96px section gaps combined with already generous internal spacing means FAQ content is pushed far below fold.

**Recommendation**: Low priority — keep current spacing if brand aesthetic values whitespace. If optimizing: reduce section padding to 48-64px uniformly.

---

## Space Efficiency Scorecard

| Page | Width Efficiency | Vertical Efficiency | Data Density | Overall |
|------|-----------------|---------------------|--------------|---------|
| Landing `/` | ⭐⭐⭐ (marketing, OK) | ⭐⭐ (heavy hero) | N/A | OK |
| Entities `/entities` | ⭐⭐ (1200px cap) | ⭐⭐ (35% chrome) | ⭐⭐ (14/11K rows) | Needs work |
| Jurisdictions `/jurisdictions` | ⭐⭐ (1200px cap) | ⭐ (76% map+chrome) | ⭐ (5-6 rows visible) | Needs work |
| Entity Detail | ⭐ (70% waste) | ⭐⭐ (sparse) | ⭐ (4 fields) | **Worst** |
| Stablecoin Detail | ⭐⭐⭐ (good tables) | ⭐⭐⭐ (dense) | ⭐⭐⭐ | Good |
| Jurisdiction Detail | ⭐⭐⭐ (2-col layout) | ⭐⭐⭐ (rich) | ⭐⭐⭐ | **Best** |
| Pricing `/pricing` | ⭐⭐⭐ (marketing) | ⭐⭐ (padding) | N/A | OK |

---

## Priority Matrix

### P0 — High Impact
| ID | Finding | Effort |
|----|---------|--------|
| S1 | Entity detail 2-column info card or sidebar layout | 3h |
| S2 | Compact filter row + sticky table header on entities | 4h |

### P1 — Medium Impact
| ID | Finding | Effort |
|----|---------|--------|
| S3 | Reduce map height or split-view on jurisdictions | 3h |
| S4 | Widen max-width to 1440px for data pages | 2h |

### P2 — Low Impact
| ID | Finding | Effort |
|----|---------|--------|
| S5 | Reduce section padding on pricing | 1h |

### Total Estimated Effort: ~13 hours
