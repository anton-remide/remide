# RemiDe UX/UI Audit — Phase 1: Route Map & Snapshot Summary

**Generated**: 2026-03-07
**Dev Server**: `localhost:5173`
**Auth State**: Logged in as `test@remide.dev`
**Viewports Tested**: Desktop (1280px), Tablet (768px), Mobile (375px)

---

## Route Inventory

### Public Routes (no auth required)
| # | Route | Page Title | Component |
|---|-------|-----------|-----------|
| R1 | `/` | Stablecoin Intelligence Platform — RemiDe | LandingPage |
| R2 | `/jurisdictions` | Jurisdictions — Regulatory Map | JurisdictionsPage |
| R3 | `/entities` | Regulated Entities — VASPs, EMIs, PIs & Banks | EntitiesPage |
| R4 | `/pricing` | Early Access Pricing | PricingPage |
| R5 | `/login` | Log In | LoginPage |
| R6 | `/signup` | Sign Up | SignupPage |
| R7 | `/auth/callback` | (Supabase auth callback) | AuthCallback |

### Protected Routes (auth required — paywall blur for non-authenticated)
| # | Route | Page Title Pattern | Component |
|---|-------|--------------------|-----------|
| R8 | `/jurisdictions/:code` | {Country} — Stablecoin & VASP Regulation | JurisdictionDetailPage |
| R9 | `/entities/:id` | {Name} — Licensed VASP | EntityDetailPage |
| R10 | `/stablecoins/:id` | {Name} ({Ticker}) — Stablecoin Profile | StablecoinDetailPage |
| R11 | `/cbdcs/:id` | {Name} — CBDC Profile | CbdcDetailPage |
| R12 | `/issuers/:slug` | {Name} — Stablecoin Issuer Profile | IssuerDetailPage |

### Redirects
| From | To |
|------|----|
| `/stablecoins` | `/entities?tab=stablecoins` |

### Entities Page Tabs (sub-routes via `?tab=`)
| Tab | URL | Content |
|-----|-----|---------|
| Entities (default) | `/entities` | 11,030 regulated entities table |
| Stablecoins | `/entities?tab=stablecoins` | 15+ stablecoins table |
| CBDCs | `/entities?tab=cbdcs` | 24 CBDC projects table |
| Issuers | `/entities?tab=issuers` | 44 stablecoin issuers table |

---

## Route Snapshots — Desktop (1280px)

### R1: Landing Page (`/`)
**Sections:** Hero (heading role + CTAs) → Stat Counters → Feature Grid → What's Inside → Footer
**Key Elements:**
- Hero: "STABLECOIN INTELLIGENCE PLATFORM" + 2 CTAs (Explore Map / Browse Entities)
- Stat counters: 4 cards (Jurisdictions, Entities, Stablecoins, CBDCs)
- **🐛 BUG: Stat counters show "0" on desktop snapshot, "70" on mobile — animation not completing or data not loaded**
- CTA button shows "11,030+ Entities" (correct dynamic count)
- Bottom sticky banner: "RemiDe is in early access..."

### R2: Jurisdictions Page (`/jurisdictions`)
**Sections:** Interactive Map → Regime Legend → Table (207 rows)
**Key Elements:**
- Map with zoom controls + 4 mode toggles (Regulation/Travel Rule/Stablecoins/CBDCs)
- Legend: Licensing, Registration, Partial, Prohibited, No Framework, Unknown
- Table: COUNTRY, REGIME, TRAVEL RULE, REGULATOR, STABLECOINS, CBDCS
- 207 jurisdictions, pagination present

### R3: Entities Page (`/entities`)
**Sections:** Sector Filters → Region Filters → Disclaimer → Tab Bar → Table
**Key Elements:**
- Sector pills: ALL(11,030), Crypto(5,555), **Payments(0) ⚠️**, Banking(4,132)
- Region pills: ALL, Europe(1,604), UK(679), N.America(6,922), Asia-Pacific(317), MENA(690), Africa(385), LATAM(118), Caribbean(80), Other(235)
- 4 tabs: Entities / Stablecoins / CBDCs / Issuers
- Table: NAME, SECTOR, COUNTRY, STATUS, LICENSE TYPE, REGULATOR
- **🐛 BUG: PAYMENTS shows 0 — no entities classified as "Payments" sector**
- Disclaimer text: "Aggregated from 80+ official registries..."

### R4: Pricing Page (`/pricing`)
**Sections:** Countdown → Hero → Pricing Card → Features Grid → Built For → FAQ
**Key Elements:**
- Countdown timer: "Early-bird pricing closes in X days"
- Pricing: $49 one-time (crossed-out $1,200/yr) — "96% off"
- Stats: 206 Jurisdictions, 14,000+ Entities, 70+ Stablecoins, 49 Data Sources
- 8 feature cards (entities, jurisdictions, stablecoins, CBDCs, issuers, travel rule, events, updates)
- 3 professional personas (CCO, Legal Counsel, + 1 more)
- CTA: "Get Early Access Now" + 14-day money-back guarantee

### R5/R6: Login/Signup
- Login redirects to `/` when already authenticated (useEffect with navigate)
- Signup: same behavior
- Demo credentials pre-filled: `test@remide.dev` / `TestPass123!`
- **Note:** Cannot capture these pages while logged in

### R8: Jurisdiction Detail (`/jurisdictions/US`)
**Sections:** Breadcrumb → Header + Badges → Info Card → Mini-Map → Stablecoin Regulation → Laws → Events → Entities
**Key Elements:**
- Breadcrumb: Home > Jurisdictions > United States
- Header: 🇺🇸 United States + badges (Licensing, Enforced)
- Info card: Regulator, Key Law, Travel Rule, Licensed Entities(3840), Stablecoins(14), CBDCs, Notes, Sources(4 links)
- Mini-map with 4 mode buttons
- Stablecoin Regulation: 5 collateral types (Fiat/Crypto/Commodity/Algorithmic + Yield) with status
- Stablecoin Laws section (4 laws)
- Regulatory Events section (4+ events)
- Entity table with "Other entities in {country}" section

### R9: Entity Detail (`/entities/ca-088-exchange-co`)
**Sections:** Breadcrumb → Header + Badges → Info Card → Activities → Entity Types → Related Entities
**Key Elements:**
- Breadcrumb: Home > Entities > {name}
- Header: name + 3 badges (status, license type, travel rule)
- Info card: Country (linked), Regulator, License Type, License Number
- Activities tags
- Entity Types section
- "Other entities in {country}" — 10 related links + "View all →"
- **⚠️ NOTE: Title says "Licensed VASP" but entity status is "Unknown" — title template inconsistency**

### R10: Stablecoin Detail (`/stablecoins/usdt`)
**Sections:** Breadcrumb → Header + Badges → Description → Info Card → Blockchain Deployments → Regulatory Status
**Key Elements:**
- Breadcrumb: Home > Stablecoins & CBDCs > {ticker} — {name}
- Header: USDT — Tether + 3 badges (type, peg, market cap)
- Collateral method below badges
- Info card: Issuer, Country, Launch Date, Reserve Type, Audit Status, Regulatory Status, Collateral, Website, Whitepaper
- Blockchain Deployments table (5 chains, contract addresses with copy buttons)
- Regulatory Status by Jurisdiction table (9+ rows with flag links)

### R11: CBDC Detail (`/cbdcs/eu-digitaleuro`)
**Sections:** Breadcrumb → Header + Badges → Description → Info Card → Features → Cross-Border → Sources
**Key Elements:**
- Breadcrumb: Home > Stablecoins & CBDCs > {name}
- Header: 🇪🇺 Digital Euro + 3 badges (phase, currency, type)
- Info card: Country, Central Bank, Phase, Launch Date, Technology, Privacy Model
- Features grid (4 boolean features)
- Cross-Border Projects
- Sources section with external links

### R12: Issuer Detail (`/issuers/aed-stablecoin`)
**Sections:** Breadcrumb → Header → Official Name → Description → Info Card → Licenses
**Key Elements:**
- Breadcrumb: Home > Entities > Issuers > {name}
- Header: flag + name
- Official name subtitle
- Rich description paragraph
- Info card: Country (linked), Auditor, Assurance Frequency, Redemption Policy
- Global Licenses section
- **⚠️ NOTE: "Stablecoins Issued" section missing for some issuers (data-dependent)**

---

## Responsive Findings

### Mobile (375px)
- ✅ Hamburger menu replaces nav links
- ✅ Filter pills wrap into rows
- ✅ Tab bar fits 4 tabs
- ✅ Info cards stack vertically
- ✅ Tables readable with horizontal scroll
- 🐛 Landing stat counter shows "70" instead of "207" (animation timing bug)
- ⚠️ Bottom sticky banner takes ~60px, overlaps footer content

### Tablet (768px)
- ✅ Hamburger menu present (768px = breakpoint)
- ✅ Entity table shows all 6 columns without truncation
- ✅ Filter pills in 2 rows (sector + region)
- ✅ All content legible and well-spaced

### Desktop (1280px+)
- ✅ Full nav bar with links
- ✅ Search bar visible in header
- ✅ Two-column layouts where applicable (info card + map)
- 🐛 Landing stat counters show "0" (animation/intersection observer issue)

---

## Bugs Discovered (Phase 1)

| ID | Severity | Route | Description |
|----|----------|-------|-------------|
| B1 | Medium | R1 `/` | Stat counters show "0" on desktop, "70" on mobile — counter animation/intersection observer not triggering properly |
| B2 | Low | R3 `/entities` | PAYMENTS sector shows 0 entities — either no entities classified as "Payments" or filter logic issue |
| B3 | Low | R9 `/entities/:id` | Page title template always says "Licensed VASP" regardless of entity status (could show "Unknown" status entity as "Licensed") |
| B4 | Minor | R1 `/` (mobile) | Bottom sticky banner overlaps with stat counter cards at bottom of viewport |
| B5 | Minor | R10 `/stablecoins/:id` | Stablecoin ID routing uses DB id (e.g., `/stablecoins/usdt`) — navigating to `/stablecoins/1` shows "not found" |
| B6 | Minor | R12 `/issuers/:slug` | Slug `tether-holdings` returns 404 — slug generation may have inconsistencies |

---

## Notes for Phase 2

- All pages use consistent header/footer chrome
- Breadcrumb pattern is consistent across detail pages
- ProtectedRoute wraps detail pages (blur + paywall for non-auth)
- Heading role used for display headings, body role for body copy
- Accent color (#FF5F0F) used consistently for CTAs
- Map component uses Leaflet/MapLibre with custom layer toggles
- Early access banner appears on all pages (dismissible)
