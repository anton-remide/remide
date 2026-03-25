# RemiDe — Decision Log (Cache)

> **Source of truth:** Notion KB (Type: Decision). This file is a fast cache.
> **Format:** `[ID]: Title — Category — Date`

---

## PROC-001: Development Priority — Features First, SEO+Mobile as Quality Gates
- **Category:** Business
- **Date:** 2026-03-04
- **Context:** Sprint S3 planning. SEO/mobile/architecture consuming sprints without monetization impact.
- **Decision:** Features first. SEO+Mobile are mandatory quality gates, not priorities. Architecture only when it unblocks features.
- **Impact:** All sprint planning follows: features > SEO+mobile as quality gates.

## PROC-002: A/B/C/D Adversarial Debate Framework
- **Category:** Process
- **Date:** 2026-03-05
- **Context:** SIMULATE step (10 failure scenarios) was unstructured. No adversarial check, no confidence levels, no business/UX lens.
- **Decision:** Replace SPEC+SIMULATE+REVIEW with integrated A/B/C/D framework. Tier 1 skip, Tier 2 = 1 round A+B+C, Tier 3 = 2 rounds A+B+D+C.
- **Impact:** CLAUDE.md Feature Lifecycle replaced. Notion System Prompt + CD Protocol updated.

## DATA-001: Parsers Collect ALL Entities — No Crypto Filtering at Parse Stage
- **Category:** Data
- **Date:** 2026-03-05
- **Context:** Parsers grab PI, EMI, banks, securities, VASPs from registries. Filtering at parse time loses data.
- **Decision:** S2/S3 parsers collect everything. S4 (Enrichment) handles sorting, classification, cleanup.
- **Impact:** Enables "crypto penetration in tradfi" analytics. No data loss from misclassification.

## DATA-002: Entity Sector Classification (sector + crypto_related)
- **Category:** Data
- **Date:** 2026-03-06
- **Context:** 14K entities include banks (FDIC), payment institutions (EBA), VASPs. Need to distinguish.
- **Decision:** Added `sector` (Crypto/Payments/Banking) + `crypto_related` boolean. Auto-classify by parser_id.
- **Impact:** Sector filter chips on EntitiesPage. Tab label "VASPs" → "Entities".

## INFRA-001: Scoped Delete in upsertEntities()
- **Category:** Infra
- **Date:** 2026-03-06
- **Context:** `upsertEntities()` DELETE was scoped only by country_code, wiping ALL parsers' data for that country.
- **Decision:** Scope DELETE to parser_id when available. Prevents FDIC+NYDFS coexistence issues.
- **Impact:** `parsers/core/db.ts` — critical fix. Commit `5e1075e`.

## ARCH-008: Quality Pipeline Architecture — 3 Workers
- **Category:** Architecture
- **Date:** 2026-03-06
- **Context:** 14K entities with garbage data (dates as names, CONSOB codes, quoted Polish sole proprietors). No processing between parsing and display. Tier 3 A/B/C/D debate completed — 2 rounds.
- **Alternatives:**
  - A) 5-stage pipeline with separate processing_log table (rejected: over-engineered)
  - B) Quick fixes only — regex cleanup in frontend (rejected: unsustainable)
  - C) 3 workers + columns on entities + scrape_runs for logging (chosen)
- **Decision:** 3 workers: Quality (cleanup+classify+score), Enrichment (existing expanded), Verify (DNS+staleness). No separate log table — quality_flags JSONB on entities + scrape_runs for worker runs.
- **Confidence:** 93% avg across 6 decision points.
- **Impact:** New DDL 006, patch db.ts, 3 worker files, frontend sort/filter changes.

## DATA-003: crypto_status Enum (replaces simple sector for crypto classification)
- **Category:** Data
- **Date:** 2026-03-06
- **Context:** S4.0 in Notion already had `crypto_status` enum designed. More nuanced than sector+crypto_related: 4 levels vs 3.
- **Alternatives:**
  - A) Only `sector` + `crypto_related` (rejected: too coarse, no "adjacent" category)
  - B) `crypto_status` replaces `sector` entirely (rejected: orthogonal axes)
  - C) `crypto_status` ADDS to existing columns (chosen): sector = business type, crypto_status = crypto relevance
- **Decision:** Add `crypto_status` enum: confirmed_crypto / crypto_adjacent / traditional / unknown. Keep `sector` + `crypto_related` for backward compatibility. `crypto_related` = true when crypto_status IN ('confirmed_crypto', 'crypto_adjacent').
- **Confidence:** 90%
- **Impact:** DDL 006, Quality Worker classification rules, frontend filter.

## DATA-004: DNS Status Tracking (not just boolean)
- **Category:** Data
- **Date:** 2026-03-06
- **Context:** 164+ dead DNS entities found during enrichment. Need to distinguish "dead website" from "no website" from "not checked".
- **Alternatives:**
  - A) Boolean `is_dead` (rejected: no nuance)
  - B) Enum `dns_status`: alive/dead/no_website/unknown (chosen)
- **Decision:** `dns_status` enum + `dns_checked_at` timestamp. Verify Worker re-checks every 30 days.
- **Confidence:** 92%
- **Impact:** DDL 006, Verify Worker, UI badges (💀/⚠️).

## DATA-005: quality_flags — Current State Only, No History
- **Category:** Data
- **Date:** 2026-03-06
- **Context:** quality_flags JSONB could store change history per entity, but 14K × many runs = bloat.
- **Alternatives:**
  - A) Full history in JSONB (rejected: bloat)
  - B) Current state only in JSONB, history in scrape_runs (chosen)
- **Decision:** `quality_flags` stores: `{ "rules": [...], "garbage_reason": null, "tier": "T1" }`. No change history. Worker runs logged in scrape_runs.
- **Confidence:** 95%
- **Impact:** quality_flags schema, Quality Worker output format.

## INFRA-002: Preserve Quality Columns on Parser Re-run (CRITICAL)
- **Category:** Infra
- **Date:** 2026-03-06
- **Context:** Parsers use DELETE+INSERT (not UPDATE). Re-running a parser wipes canonical_name, quality_score, crypto_status, dns_status — all quality pipeline work lost.
- **Alternatives:**
  - A) Switch parsers to UPSERT (rejected: too many parsers to change, breaks existing pattern)
  - B) Save quality columns before DELETE, restore after INSERT (chosen)
  - C) Move quality columns to separate table (rejected: JOIN overhead, complexity)
- **Decision:** Modify `upsertEntities()` in `parsers/core/db.ts` — before DELETE, SELECT quality columns; after INSERT, UPDATE to restore. Must be done BEFORE Quality Worker is built.
- **Confidence:** 98%
- **Impact:** `parsers/core/db.ts` — critical path. Without this, entire pipeline is useless.

## DB-RESTRUCTURE-001: Split Parser Registry into Country Research + Workers Registry
- **Category:** Infra
- **Date:** 2026-03-06
- **Context:** Parser Registry held two different types of data: country-level regulatory context (200+ countries) and parser/worker machine specs (82+ workers). Mixed concerns made it hard to maintain.
- **Alternatives:**
  - A) Keep single database with tags/filters (rejected: mixed concerns, unclear ownership)
  - B) Split into two specialized databases (chosen)
- **Decision:** Parser Registry → two databases:
  1. **🌍 Country Research Registry** (`collection://3de230bb-1638-40b0-b3d1-5c3cf54101a6`) — same ID, renamed. Per-country regulatory context, research notes, priority tiers.
  2. **🤖 Workers Registry** (`collection://d9ee6a73-0f3d-42d6-8967-e4dee49d8720`) — NEW database. Parser/worker specs with: Worker, Type (Parser/Enricher/Cleaner/Verifier), Status lifecycle (Backlog→Deployed), Countries, Source URL/Type, Approach, Difficulty, Priority, Frequency, Last Run, Success Rate, Entity Count, Data Quality, Build Order, Owner, Notes, Deploy Session.
- **Logging rule:** New parsers/workers → Workers Registry. Country research → Country Research Registry. Never mix.
- **Confidence:** 95%
- **Impact:** CLAUDE.md, MEMORY.md updated. All future parser/worker logging goes to Workers Registry.

## DATA-006: Quality Score Based on Data Tiers T1-T4
- **Category:** Data
- **Date:** 2026-03-06
- **Context:** S4.6 in Notion already defined data tiers. Quality Score should reflect enrichment level.
- **Decision:** Score ranges: T1 (name+license) = 10-30, T2 (+website+description) = 40-60, T3 (+LinkedIn+social) = 60-80, T4 (+revenue+products) = 80-100. Drives Firecrawl enrichment priority: enrich lowest-tier entities first.
- **Confidence:** 88%
- **Impact:** Quality Worker scoring rules, Firecrawl prioritization.

## PAYWALL-001: Three-Tier Paywall Architecture
- **Category:** Product/Monetization
- **Date:** 2026-03-08
- **Context:** Binary paywall (isLocked=!user) had high bounce rate. All-or-nothing approach doesn't show value before commitment. Need progressive disclosure to increase conversion.
- **Alternatives:**
  - A) Keep binary paywall, improve CTA copy (rejected: doesn't solve core problem)
  - B) Three-tier: Anonymous (blurred) → Registered (free) → Paid $49 (chosen)
  - C) Freemium with feature limits only (rejected: less visual impact)
- **Decision:** Three-tier model via `usePaywall()` hook. Anonymous: see structure with blurred values, first 3 entity rows clickable. Registered: jurisdiction profiles, entity lists, basic details unlocked. Paid $49: license numbers, registry links, corporate structure, contract addresses, export.
- **Confidence:** 85%
- **Impact:** All detail pages migrated from `useAuth()` binary to `usePaywall()` three-tier. PaywallOverlay updated. PricingPage/SignupPage redesigned.

## PAYWALL-002: Entity Table First-3-Rows Clickable Pattern
- **Category:** UX
- **Date:** 2026-03-08
- **Context:** Anonymous users seeing 100% blurred entity table had no reason to register. Need a teaser that shows real value.
- **Decision:** First 3 entity rows are clickable `<Link>` elements navigating to `/entities/:id`. Rows 4-8 blurred with gradient fade. CTA banner below. Registered users see full table.
- **Confidence:** 80%
- **Impact:** JurisdictionDetailPage entity table section.

## PAYWALL-003: Laws/Events Collapsed Teaser Pattern
- **Category:** UX
- **Date:** 2026-03-08
- **Context:** Completely hiding laws/events for anonymous users removes key content from SEO crawlers and gives no incentive to register.
- **Decision:** First law/event fully expanded (visible teaser). Remaining items collapsed with lock icon and count indicator. Registered users see all expanded.
- **Confidence:** 82%
- **Impact:** JurisdictionDetailPage laws and events sections.

---

## Product Backlog from Feedback Screenshots (2026-03-08)

> Items below were identified from 16 feedback screenshots in `/Feedback Screenshots/`.
> Quick fixes are done ✅. Remaining items are product backlog for future sprints.

### Done this session ✅
- Footer: removed redundant "Pricing" link
- PricingPage: removed "Everything Included" (8 feature cards) + "Built For Professionals" (6 audience cards) — redundant with comparison table
- PricingPage Final CTA: clarified "14-day money-back guarantee" + reduced white space
- Header nav: removed "Pricing" nav link (redundant with "Special Offer" button)
- Search: removed regulator names from country results
- Entity table on jurisdiction page: restored white background + border
- Entity Detail: CTA button made full-width (max-width: 360px)
- Verified: search loading spinner already exists, entity rows 1-3 already clickable in anonymous mode

### Product Backlog (future sprints)
1. **PAYWALL-FLOAT:** Paywall overlay should be floating white card with shadow over blurred content (not static)
2. **SIGNUP-COMPARE:** SignupPage right side should show free-vs-paid feature comparison blocks
3. **BLUR-COLORS:** Blurred text on colored backgrounds (badges, portal labels) looks weird — portal labels shouldn't be blurred
4. **LAWS-ACCORDION:** Laws/Events sections — accordion pattern: first expanded, rest collapsed, CTA banner above
5. **MAP-TOOLTIPS:** Map tooltip should be context-aware per active mini-stat tab
6. **ENTITIES-LAZY:** Entities page loads 3-4s — need lazy loading (first 100 instant, rest background)
7. **ENTITY-DESC:** Entity Detail — company description area from website parser data
8. **ENTITY-SIMILAR:** Entity Detail — "Similar Companies" block below profile
9. **ENTITY-OFFER:** Entity table blurred section — offer overlay on top of gradient (not just blur)
10. **STRIPE-CHECKOUT:** Stripe integration with product `prod_U6qNlT7koH0SlO` ($49 one-time)

---

## PROC-005: Hard Work Framework — Parallel Subagent Debate Protocol
- **Category:** Process
- **Date:** 2026-03-14
- **Context:** A/B/C/D Adversarial Debate (PROC-002) had fundamental flaw: one AI playing 4 roles sequentially creates echo chamber — Critic sees Defender's framing, Arbiter sees both, producing false consensus. No alignment phase (Discovery), no multi-cycle iteration, no user input between rounds.
- **Alternatives:**
  - A) Keep A/B/C/D as-is (rejected: echo chamber, no alignment, sequential contamination)
  - B) Layer Hard Work on top of A/B/C/D (rejected: conflicting protocols, added complexity)
  - C) Full replace with Hard Work Framework + parallel subagents (chosen)
- **Decision:** Replace A/B/C/D with Hard Work Framework. Key innovation: roles run as parallel Cursor subagents (Task tool, readonly) — each is an independent AI instance that never sees others' output. Parent agent = Arbiter. Interactive Role Casting: 2-3 candidates per position, user selects. Compact mode (Tier 2: 2 subagents) and Full mode (Tier 3: 3 subagents + Lateral from outside domain).
- **Impact:** CLAUDE.md updated (A/B/C/D section replaced). New files: `.cursor/rules/hard-work.mdc` (router), `docs/hard-work-framework.md` (full spec). `project-decisions.md` updated. Notion KB entry created.

## PROC-004: Engineering Standards — 6 Cursor Rules from Git/Notion Audit
- **Category:** Process
- **Date:** 2026-03-14
- **Context:** Full audit of git history (91 commits), Notion KB, and codebase. Found: 15 commits without prefix, avg 8 files/commit (max 74), CLAUDE.md with 4 stale facts, Workers Registry missing 3 workers, Current State 8 days stale, 0 new tests in 80+ feature commits.
- **Decision:** Introduced 6 `.cursor/rules/*.mdc` files:
  1. `commit-convention.mdc` — conventional commits, English, ≤72 chars
  2. `atomic-commits.mdc` — ≤15 files per commit, split by layer
  3. `test-with-logic.mdc` — unit tests mandatory for business logic
  4. `notion-sync.mdc` — session-end checklist for all Notion databases
  5. `version-guard.mdc` — auto-check CLAUDE.md when infra files change
  6. `project-structure.mdc` — import boundaries, naming, ownership
- **Impact:** .cursor/rules/ created, CLAUDE.md updated, all future sessions auto-load these rules.

## DS-001: Canonical Font Roles Only — Remove Legacy Font Aliases
- **Category:** Architecture
- **Date:** 2026-03-24
- **Context:** Foundations exposed `Legacy Aliases` in `Fonts`, while runtime still referenced `--font1` / `--font2` and a few direct font-family hardcodes. This made the typography system ambiguous and allowed code to bypass foundations roles.
- **Decision:** Remove `--font1` and `--font2` from the foundation registry, migrate runtime usage to `--font-body` / `--font-heading`, and keep typography API limited to the three canonical roles: `--font-body`, `--font-heading`, `--font-mono`.
- **Impact:** `public/design-system/foundation.registry.json`, generated `src/styles/tokens.css`, `src/styles/app.css`, `src/components/ui/MermaidDiagram.tsx`, runtime page styles, and current design-system docs now align on role-based typography only.

## DS-002: Foundations Editor Uses Card-First Editing With Dirty-State Save/Discard
- **Category:** UX-UI
- **Date:** 2026-03-24
- **Context:** The foundations editor hid editability behind a global `View/Edit` toggle, which made the selected token/rule card read like a static reference panel and made save affordances feel disconnected from the actual act of editing.
- **Decision:** Remove the global `View/Edit` dichotomy and remove the right-side inspector. Editing happens directly inside each card: token cards expose the active mode value in the top-right corner with a compact preview in the lower-right corner, rule cards expose their properties inline, and `Save`/`Discard` appear only after the draft becomes dirty.
- **Impact:** `src/pages/design-system/DesignSystemFoundationsPage.tsx`, `src/design-system/foundations.ts`, `src/design-system/foundations.test.ts`, and `src/styles/app.css` now follow a card-first editing model with unsaved-change protection (`beforeunload`), inline dirty markers, and no visible `description` / `usage` editing surface in the main UX.

## DS-003: Foundations Colors Use Tri-Palette Ledger and Theme IDs Match Product Names
- **Category:** UX-UI
- **Date:** 2026-03-25
- **Context:** The card-first foundations editor worked for single-mode editing, but `Colors` needed side-by-side comparison and faster token maintenance across all three palettes. Legacy theme ids (`main`, `darkgray`, `nearblack`) also no longer matched product language.
- **Decision:** Rename runtime theme ids to `tracker`, `institute`, and `main-site`, keep `tracker` as the root/default palette, and render `Colors` as a Figma Variables-style ledger with columns `Name / Tracker / Institute / Main site`. Color cells edit inline and save on `blur` or `Enter`; invalid CSS colors stay local with inline error and do not persist.
- **Impact:** `src/context/ThemeProvider.tsx`, `src/components/layout/ThemeSwitcher.tsx`, `public/design-system/foundation.registry.json`, generated `src/styles/tokens.css`, `src/styles/app.css`, `src/pages/design-system/DesignSystemFoundationsPage.tsx`, and new UI tests now align on the renamed themes and the tri-palette color workflow.
