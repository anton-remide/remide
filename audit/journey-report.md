# RemiDe UX/UI Audit — Phase 3: Customer Journey Report

**Generated**: 2026-03-07
**Environment**: localhost:5173 (dev server)
**Auth State**: Logged in as `test@remide.dev`
**Viewports Tested**: Desktop (1280px), Mobile (375x812px)

---

## Executive Summary

10 customer journeys tested covering all primary user flows. The platform excels at data richness and individual page quality, but suffers from **broken cross-entity navigation** and **search gaps** that fragment the research workflow.

### Severity Distribution
| Severity | Count |
|----------|-------|
| High | 5 |
| Medium | 10 |
| Low | 8 |
| **Total** | **23** |

### Top 3 Systemic Issues
1. **Missing cross-links**: Jurisdiction pages are navigation dead-ends — no links to stablecoins, CBDCs, or issuers
2. **Search scope too narrow**: Stablecoins, CBDCs, and issuers not indexed; search completely missing on mobile
3. **Filter counter mismatch**: Combined sector+region filters show incorrect total count

---

## Journey Results

### J1: New Visitor Discovery (Landing → Explore)
**Route**: `/` → `/jurisdictions` → `/entities`
**Result**: ✅ PASS (minor issues)

| Step | Status |
|------|--------|
| Landing page hero loads | ✅ |
| "Explore Regulatory Map" CTA → `/jurisdictions` | ✅ |
| Map + table with 207 rows | ✅ |
| Navigate to `/entities` | ✅ |
| 11,030 entities with filters + tabs | ✅ |

**Issues:**
- [LOW] Stat counters flash "0" briefly before animation starts (intersection observer timing)
- [MEDIUM] "0 PAYMENTS" sector filter visible — confusing empty category

**UX Friction:**
- CTA says "Explore Regulatory Map" but nav says "Jurisdictions" — naming inconsistency
- RemiDe logo links to home but it's not visually obvious as a navigation element

---

### J2: Entity Search & Detail
**Route**: `/entities` → search "Coinbase" → `/entities/us-coinbase-inc`
**Result**: ⚠️ PARTIAL PASS

| Step | Status |
|------|--------|
| Entities page loads | ✅ |
| Table search finds "Coinbase" (17 results) | ✅ |
| Click Coinbase US → entity detail | ✅ |
| Breadcrumb, info card, activities | ✅ |
| "Other entities" section visible | ❌ FAIL |

**Issues:**
- [MEDIUM] **"Other entities" section invisible** — `.reveal` container stuck at `opacity: 0`. IntersectionObserver scroll-reveal animation never triggers. Content exists in DOM (493px height, 10 entity links) but permanently invisible.
- [LOW] 1,343 entities (12%) have no sector classification — show in "ALL" but no sector filter matches them

**UX Friction:**
- Table search is hidden behind magnifying glass icon — should be always visible for 11K+ entities

---

### J3: Jurisdiction Deep Dive
**Route**: `/jurisdictions` → search "United States" → `/jurisdictions/US` → click entity → detail
**Result**: ✅ PASS

| Step | Status |
|------|--------|
| Jurisdictions page with map + table | ✅ |
| Search and click "United States" | ✅ |
| US jurisdiction detail loads | ✅ |
| All sections present (info card, map, laws, events, entities) | ✅ |
| Click entity → navigate to entity detail | ✅ |

**Data verified for US:** Regulator (FinCEN/SEC/CFTC/States), Key Law (BSA/MTL/BitLicense), Travel Rule (Enforced), 3,840 entities, 14 stablecoins, CBDC (Digital Dollar - Cancelled), 4 laws, 7 events, 10+ issuer licenses

**UX Friction:**
- Jurisdictions table sorted alphabetically — US on page ~8 of 207 entries. No jump-to-letter or map-click-to-navigate feature.
- Entity count discrepancy: info card says "3840" but entity table says "3838" (minor)

---

### J4: Stablecoin Research Flow
**Route**: `/entities?tab=stablecoins` → `/stablecoins/usdt` → (issuer link?)
**Result**: ⚠️ PARTIAL PASS

| Step | Status |
|------|--------|
| Stablecoins tab loads (70 items) | ✅ |
| Click USDT → stablecoin detail | ✅ |
| Blockchain deployments (5 chains with addresses) | ✅ |
| Regulatory status table (9 jurisdictions) | ✅ |
| Click issuer name → issuer detail | ❌ FAIL — plain text, not a link |

**Issues:**
- [MEDIUM] **Issuer name not linked** on stablecoin detail page — "Tether Limited" is plain text, should link to `/issuers/tether-limited`
- [MEDIUM] **No "Stablecoins Issued" section** on issuer detail page — reverse cross-link missing

**UX Friction:**
- Contract addresses styled as orange links but don't link to block explorers (Etherscan/BscScan)
- Breadcrumb says "Stablecoins & CBDCs" but parent is actually Entities page with tab

---

### J5: CBDC Research Flow
**Route**: `/entities?tab=cbdcs` → `/cbdcs/eu-digitaleuro`
**Result**: ⚠️ PARTIAL PASS

| Step | Status |
|------|--------|
| CBDCs tab loads (24 items) | ✅ |
| Click Digital Euro → CBDC detail | ✅ |
| Badges, info card, features, cross-border, sources | ✅ |
| Click EU country link → jurisdiction page | ❌ FAIL — plain text, not a link |

**Issues:**
- [MEDIUM] Country name in CBDC info card is not a hyperlink to jurisdiction page
- [LOW] Breadcrumb "Stablecoins & CBDCs" links to `/stablecoins` not `/entities?tab=cbdcs`

---

### J6: Issuer Research Flow
**Route**: `/entities?tab=issuers` → `/issuers/circle`
**Result**: ⚠️ PARTIAL PASS

| Step | Status |
|------|--------|
| Issuers tab loads (44 items) | ✅ |
| Click Circle → issuer detail | ✅ |
| Official name, description, info card | ✅ |
| Corporate structure (5 subsidiaries) | ✅ |
| Global licenses (6 licenses) | ✅ |
| "Stablecoins Issued" section | ❌ MISSING |
| Country link → jurisdiction | ✅ |

**Issues:**
- [MEDIUM] No "Stablecoins Issued" section — USDC/EURC mentioned in text only, no links to `/stablecoins/usdc`
- [LOW] Subsidiary country names are plain text, not links to jurisdiction pages

---

### J7: Cross-Entity Navigation (Entity → Country → Stablecoin)
**Route**: `/entities/us-coinbase-inc` → `/jurisdictions/US` → (stablecoin?) → (CBDC?)
**Result**: ❌ PARTIAL FAIL

| Step | Status |
|------|--------|
| Entity detail → click country → jurisdiction | ✅ |
| Jurisdiction page loads with all sections | ✅ |
| Click stablecoin name on jurisdiction page | ❌ FAIL — all plain text |
| Click CBDC name on jurisdiction page | ❌ FAIL — all plain text |

**Issues:**
- [HIGH] **Jurisdiction page has ZERO internal cross-links** to stablecoins, CBDCs, or issuers. Data shown inline but no navigation. This is the biggest cross-navigation gap.
- [MEDIUM] CBDC names on jurisdiction page should link to `/cbdcs/:id`
- [MEDIUM] Issuer licenses on jurisdiction page should link to `/issuers/:slug`

---

### J8: Region Filter + Sort Workflow
**Route**: `/entities` → Europe filter → Crypto filter → sort → tab switch
**Result**: ⚠️ PARTIAL PASS

| Step | Status |
|------|--------|
| Click Europe filter → 1,604 entities | ✅ |
| Sort by column header | ✅ |
| Apply Crypto sector filter | ✅ (data correct) |
| Combined filter count accurate | ❌ FAIL |
| Clear filters | ✅ |
| Switch to Stablecoins tab | ✅ |

**Issues:**
- [HIGH] **Pagination counter wrong with combined filters** — shows "of 1,604" (Europe-only) when Europe + Crypto active. Data is correctly filtered but counter misleads.
- [MEDIUM] Region mini-stat counts don't update when sector filter is also active
- [LOW] Clearing filters doesn't reset pagination to page 1
- [LOW] Country sort effect not visually obvious due to emoji flag prefixes

---

### J9: Header Search Flow
**Route**: Header search → various queries → results
**Result**: ❌ PARTIAL FAIL

| Step | Status |
|------|--------|
| Search "Binance" → 5 entity results | ✅ |
| Click result → entity detail | ✅ |
| Search "USDT" → find stablecoin | ❌ FAIL — only entity name matches |
| Search "United States" → countries + entities | ✅ |
| Search "xyznoexist" → empty state | ✅ |

**Issues:**
- [HIGH] **Search does not index stablecoins, CBDCs, or issuers** — platform is branded "Stablecoin Intelligence Platform" but searching "USDT" or "Tether" doesn't surface stablecoin pages
- [HIGH] **No search on mobile** — search input renders at 0×0 dimensions on mobile, no alternative search in hamburger menu
- [MEDIUM] Duplicate "Binance" entries for UAE (two parser sources, same entity)
- [LOW] Search dropdown capped at 5 results with no "View all" link

---

### J10: Mobile Navigation & Hamburger Menu
**Route**: Mobile (375px) → landing → hamburger → entities → jurisdiction detail → map
**Result**: ⚠️ PARTIAL PASS

| Step | Status |
|------|--------|
| Mobile layout renders correctly | ✅ |
| Hamburger menu opens/closes | ✅ |
| Menu items correct | ✅ |
| Navigate via menu → menu closes | ✅ |
| Sector filters wrap properly | ✅ |
| Tab bar usable | ✅ |
| Table horizontal scroll works | ✅ |
| Info cards stack vertically | ✅ |
| Map renders with zoom controls | ✅ |

**Issues:**
- [HIGH] No search on mobile (same as J9)
- [MEDIUM] No horizontal scroll indicator on tables — users may not realize there's more data to the right
- [MEDIUM] Same scroll indicator issue on jurisdictions page table
- [LOW] Map legend overlaps map content on small screens

**UX Positives:**
- Hamburger menu is well-designed: full-screen overlay, large touch targets, clear close button
- CTA buttons are full-width on mobile — easy to tap
- Jurisdiction detail page is the best-adapted page for mobile
- Header scrolls out of view on long pages — no sticky header

---

## Cross-Navigation Matrix

Shows which entity types link TO which other types:

| FROM ↓ / TO → | Jurisdiction | Entity | Stablecoin | CBDC | Issuer |
|----------------|:---:|:---:|:---:|:---:|:---:|
| **Jurisdiction** | — | ✅ (entity list) | ❌ | ❌ | ❌ |
| **Entity** | ✅ (country link) | ✅ (related) | ❌ | ❌ | ❌ |
| **Stablecoin** | ✅ (reg. status flags) | ❌ | — | ❌ | ❌ (plain text) |
| **CBDC** | ❌ (plain text) | ❌ | ❌ | — | ❌ |
| **Issuer** | ✅ (country link) | ❌ | ❌ | ❌ | — |

**11 of 20 possible cross-links are missing.** The navigation graph is sparse — most connections are one-way or absent.

---

## Priority Fix List

### P0 — Critical UX Blockers
| ID | Issue | Journey | Effort |
|----|-------|---------|--------|
| J7-1 | Add cross-links on jurisdiction pages (stablecoins, CBDCs, issuers) | J7 | 4h |
| J9-1 | Add stablecoins/CBDCs/issuers to header search | J9 | 3h |
| J9-3 | Enable search on mobile (expandable search or in hamburger) | J9, J10 | 2h |
| J8-1 | Fix combined filter pagination counter | J8 | 2h |

### P1 — Important UX Gaps
| ID | Issue | Journey | Effort |
|----|-------|---------|--------|
| J2-1 | Fix `.reveal` opacity:0 bug on entity detail page | J2 | 1h |
| J4-1 | Link issuer name on stablecoin detail to issuer page | J4 | 1h |
| J6-1 | Add "Stablecoins Issued" section to issuer detail | J6 | 2h |
| J5-1 | Link country name on CBDC detail to jurisdiction | J5 | 30m |
| J8-2 | Update region mini-stats when sector filter active | J8 | 2h |
| J10-2 | Add horizontal scroll indicators on mobile tables | J10 | 1h |

### P2 — Polish
| ID | Issue | Journey | Effort |
|----|-------|---------|--------|
| J1-1 | Hide "0 PAYMENTS" sector when empty | J1 | 30m |
| J9-2 | Deduplicate search results (same entity, different parsers) | J9 | 1h |
| J6-2 | Link subsidiary country names to jurisdiction pages | J6 | 1h |
| J5-2 | Fix breadcrumb "Stablecoins & CBDCs" link target | J5 | 30m |
| J8-3 | Reset pagination to page 1 on filter change | J8 | 30m |
| J9-4 | Add "View all results" link to search dropdown | J9 | 1h |
| J10-4 | Reduce map legend overlap on mobile | J10 | 30m |
| J1-2 | Fix stat counter intersection observer | J1 | 1h |

### Total Estimated Effort: ~24 hours

---

## Appendix: Journeys Tested

| ID | Journey Name | Primary Route | Verdict |
|----|-------------|---------------|---------|
| J1 | New Visitor Discovery | `/` → `/jurisdictions` → `/entities` | ✅ Pass |
| J2 | Entity Search & Detail | `/entities` → search → `/entities/:id` | ⚠️ Partial |
| J3 | Jurisdiction Deep Dive | `/jurisdictions` → `/jurisdictions/US` → entity | ✅ Pass |
| J4 | Stablecoin Research | `/entities?tab=stablecoins` → `/stablecoins/usdt` | ⚠️ Partial |
| J5 | CBDC Research | `/entities?tab=cbdcs` → `/cbdcs/eu-digitaleuro` | ⚠️ Partial |
| J6 | Issuer Research | `/entities?tab=issuers` → `/issuers/circle` | ⚠️ Partial |
| J7 | Cross-Entity Navigation | Entity → Country → Stablecoin/CBDC | ❌ Partial Fail |
| J8 | Region Filter + Sort | `/entities` filter combos + sort + tabs | ⚠️ Partial |
| J9 | Header Search | Header search → various queries | ❌ Partial Fail |
| J10 | Mobile Navigation | Mobile hamburger + responsive layouts | ⚠️ Partial |
