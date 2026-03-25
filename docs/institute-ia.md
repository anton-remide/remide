# Institute Information Architecture — Final Specification

> **Version:** 3.2 | **Date:** 2026-03-17
> **Process:** Hard Work Framework v2.0, Explore Mode, 4 Cycles + direct user refinement
> **Decision:** Pending user approval
> **Note:** This is a SPECIFICATION document. Numbers in wireframes (entity counts, jurisdiction counts) are illustrative examples, not current database state.

---

## 1. Platform Identity

RemiDe Institute is a **free market intelligence publication**. Content tells the story of broken markets — RemiDe is the natural answer.

- **Voice:** Personal, first-person, provocative
- **Tone:** Data-driven market narratives. All content sourced.
- **Content model:** Big Substack-style posts. Cross-postable.
- **Authorship:** Standard posts published as "RemiDe" (brand byline, no individual author). Long-form featured content (e.g. Tap Protocol) carries named authorship — co-authors, institutional signatories (e.g. Tether, Binance advisors).
- **Distribution:** Institute (canonical) + Substack (mirror) + email newsletter

---

## 2. Content Types

Three types distinguished by **editorial intent**. All have required sources.

| Type | Intent | Reader Question | URL |
|------|--------|----------------|-----|
| **Research** | Analyze | "What's happening?" | `/research/:slug` |
| **Perspective** | Advise | "What should I do?" | `/perspectives/:slug` |
| **Explains** | Educate | "What is this?" | `/explains/:slug` |

### 2.1 Research

Data analysis. Can include opinion on top. Always heavily sourced.

```typescript
interface ResearchContent extends ContentBase {
  kind: 'research';
  dataAsOf: string;            // when data was collected
  reviewDate: string;          // when to re-evaluate
  keyFindings: string[];       // 3-5 bullets
  methodology?: string;
}
```

**Lifecycle:** publish → review → update → deprecate
**Examples:** "Africa's $120B Crisis" (29 sources), "The $500K Moat" (16 sources), "The USDT Paradox"

### 2.2 Perspective

Practical takes, guides, playbooks, how-tos. Absorbs the old "Guide" type. Sourced.

```typescript
interface PerspectiveContent extends ContentBase {
  kind: 'perspective';
  actionItems?: string[];      // "what to do" bullets
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  prerequisites?: string[];
}
```

**Lifecycle:** publish → done (or update if guide-style)
**Examples:** "Pre-SWIFT Moment", "Corridor Models", "Launch Checklist"

**Long-form / Featured:** Major documents like Tap Protocol (50+ pages, policy proposals, protocol specs) are Perspectives with `format: 'long-form'`. They get a different template: sidebar table of contents, chapter navigation, version history. On the `/perspectives/` catalog they render as a large featured card at the top.

### 2.3 Explains

Educational. "What is X", "How does X work". Reference material from RemiDe's worldview.

```typescript
interface ExplainsContent extends ContentBase {
  kind: 'explains';
  definitionOf: string;        // core concept being explained
  relatedExplains?: string[];  // companion explainers
  prerequisites?: string[];
}
```

**Lifecycle:** publish → maintain → update (evergreen)
**Examples:** "What is Banking 2.0", "How Travel Rule Works", "Compliance Workflow"

**Classification rule:** "what is / how does" → Explains. "what to do / how to do" → Perspective. "what's happening / what the data says" → Research.

### 2.4 Library Item

Curated third-party reports with editorial framing. Participates in cross-referencing — Library items surface in "Mentioned In" on data pages alongside original content.

```typescript
interface LibraryItem {
  slug: string;
  title: string;
  organization: string;
  externalUrl: string;
  curatorNote: string;
  keyFindings: string[];
  tags: string[];
  jurisdictions: string[];     // country codes → cross-ref with /data/
  entities: string[];          // entity IDs → cross-ref with /data/
  relatedSlugs: string[];
}
```

### 2.5 Shared Base

```typescript
interface ContentBase {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;           // Substack subtitle
  excerpt: string;             // 1-2 sentences for cards/SEO
  body: string;                // pure markdown (no MDX — Substack-portable)
  sources: Source[];           // REQUIRED on ALL types, min 1
  author: AuthorRef;           // default: "RemiDe" brand. Named authors only on long-form featured content.
  tags: string[];              // flat strings, min 1
  jurisdictions?: string[];    // country codes → /data/ links
  entities?: string[];         // entity IDs → /data/ links
  publishedAt: string;
  updatedAt: string;
  status: 'draft' | 'published' | 'archived';
  featured: boolean;
  format: 'standard' | 'long-form';  // long-form → chapter TOC, sidebar nav
  canonicalUrl: string;        // always institute URL
  substackUrl?: string;        // link to Substack mirror
  ogImage: string;             // required for social sharing
  estimatedReadTime: number;
}

type InstituteContent = ResearchContent | PerspectiveContent | ExplainsContent;
```

No `accessTier` field. All content is free.

### 2.6 Database Schema

```sql
CREATE TABLE institute_content (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind           text NOT NULL CHECK (kind IN ('research', 'perspective', 'explains')),
  slug           text UNIQUE NOT NULL,
  title          text NOT NULL,
  subtitle       text,
  excerpt        text NOT NULL,
  body           text NOT NULL,
  author_id      uuid REFERENCES profiles(id),
  tags           text[] NOT NULL DEFAULT '{}',
  jurisdictions  text[] DEFAULT '{}',
  entities       text[] DEFAULT '{}',
  sources        jsonb NOT NULL DEFAULT '[]',
  published_at   timestamptz,
  updated_at     timestamptz DEFAULT now(),
  status         text NOT NULL DEFAULT 'draft',
  featured       boolean DEFAULT false,
  format         text NOT NULL DEFAULT 'standard' CHECK (format IN ('standard', 'long-form')),
  canonical_url  text,
  substack_url   text,
  og_image       text,
  read_time_min  int,
  metadata       jsonb NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_content_tags ON institute_content USING GIN (tags);
CREATE INDEX idx_content_kind ON institute_content (kind) WHERE status = 'published';
CREATE INDEX idx_content_published ON institute_content (published_at DESC) WHERE status = 'published';

CREATE TABLE library_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           text UNIQUE NOT NULL,
  title          text NOT NULL,
  organization   text NOT NULL,
  external_url   text NOT NULL,
  curator_note   text NOT NULL,
  key_findings   text[] DEFAULT '{}',
  tags           text[] DEFAULT '{}',
  jurisdictions  text[] DEFAULT '{}',
  entities       text[] DEFAULT '{}',
  related_slugs  text[] DEFAULT '{}',
  published_at   timestamptz DEFAULT now()
);

CREATE INDEX idx_library_jurisdictions ON library_items USING GIN (jurisdictions);
CREATE INDEX idx_library_entities ON library_items USING GIN (entities);
```

---

## 3. URL Structure

```
/                                    Homepage (publication front page)

/research/                           Research catalog (tag-filterable)
/research/:slug                      Individual research post

/perspectives/                       Perspectives & Guides catalog
/perspectives/:slug                  Individual perspective/guide

/explains/                           Explains catalog
/explains/:slug                      Individual explainer

/library/                            Curated external research
/library/:slug                       Annotated external report

/archive/                            All posts, all types, unified view

/data/                               Tracker hub
/data/entities                       Entity catalog
/data/entities/:id                   Entity detail
/data/jurisdictions                  Jurisdiction catalog
/data/jurisdictions/:code            Jurisdiction detail
/data/stablecoins/:id                Stablecoin detail
/data/cbdcs/:id                      CBDC detail
/data/issuers/:slug                  Issuer detail
/data/map                            Interactive world map

/remide/                             RemiDe product hub
/remide/how-it-works                 Product overview (SCN)
/remide/marketplace                  Off-Ramp Marketplace
/remide/alternatives                 Competitive decode (vs Circle CPN, Bridge, Notabene)
/remide/participants                 Network participant types (Banks, PSPs, Wallets, MMOs, Exchanges)
/remide/story                        Why we build this
/remide/stakeholders                 Team, advisors, market supporters
/remide/faq                          Product FAQ
/remide/contact                      Get in touch / Discovery Call

/feed                                RSS feed (all content)
/feed/research                       RSS feed (research only)
/feed/perspectives                   RSS feed (perspectives only)
/feed/explains                       RSS feed (explains only)

/search                              Full search results
/login                               Auth
/signup                              Auth
/auth/callback                       Auth callback
```

### Redirect Map

```
tracker.remide.xyz/*                 → institute.remide.xyz/data/*
/entities                            → /data/entities
/jurisdictions                       → /data/jurisdictions
/guides/:slug                        → /perspectives/:slug
/guides/                             → /perspectives/
/topics/:slug                        → /archive/?tag=:slug
/topics/                             → /archive/
/about                               → /remide/story
/subscribe                           → / (homepage has email capture)
```

---

## 4. Navigation

### 4.1 Left Sidebar (persistent, 240px, collapsible)

```
HOME

INTEL
  Research
  Perspectives
  Explains
  Library
  Archive

DATA
  Entities [15,249]
  Jurisdictions
  World Map

REMIDE
  How It Works
  Marketplace
  Alternatives
  Participants
  Story
  Stakeholders
  FAQ
  Contact

---
[remide.xyz →]
```

### 4.2 Top Header

```
[Logo: RemiDe Institute]    [Global Search ⌘K]    [Login]
```

### 4.3 Breadcrumbs

```
Home / Research / Africa's $120 Billion Dollar Crisis
Home / Perspectives / Corridor Models
Home / Explains / How Travel Rule Works
Home / Data / Jurisdictions / Nigeria
```

---

## 5. Homepage

Publication front page. Featured post + latest content + data pulse.

```
┌─ SIDEBAR ─┐┌─────────────── CONTENT AREA ──────────────────┐
│            ││                                                │
│  HOME •    ││  [FEATURED POST — pinned, full-width]          │
│            ││  Research · Travel Rule · Cross-Border         │
│  INTEL     ││  "Africa's $120 Billion Dollar Crisis"         │
│   Research ││  "How fragmented compliance is costing..."     │
│   Perspect ││  29 sources · 18 min · Anton Titov · Feb 2026 │
│   Explains ││  [Read →]                                      │
│   Library  ││                                                │
│   Archive  ││  [LATEST — 6 cards, mixed types]               │
│            ││  ┌──────────────┐ ┌──────────────┐            │
│  DATA      ││  │ RESEARCH     │ │ EXPLAINS     │            │
│   Entities ││  │ The $500K    │ │ What is      │            │
│   Jurisd.  ││  │ Moat         │ │ Banking 2.0? │            │
│   Map      ││  │ 16 sources   │ │ 8 sources    │            │
│            ││  └──────────────┘ └──────────────┘            │
│  REMIDE    ││  ┌──────────────┐ ┌──────────────┐            │
│   How It   ││  │ PERSPECTIVE  │ │ RESEARCH     │            │
│   Marketpl ││  │ Pre-SWIFT    │ │ USDT Paradox │            │
│   Story    ││  │ Moment       │ │ 12 sources   │            │
│   +6 more  ││  └──────────────┘ └──────────────┘            │
│            ││  [View Archive →]                              │
│  ────────  ││                                                │
│  remide →  ││  [DATA PULSE]                                  │
│            ││  15,249 entities · 195 jurisdictions           │
│            ││  [Explore Data →]                              │
│            ││                                                │
│            ││  [FROM THE LIBRARY — 3 curated reports]        │
│            ││  Citi GPS | McKinsey | BIS Annual 2025         │
│            ││                                                │
│            ││  [NEWSLETTER]                                  │
│            ││  "New research in your inbox"                   │
│            ││  [email] [Subscribe]                           │
│            ││                                                │
└────────────┘└────────────────────────────────────────────────┘
```

---

## 6. Tags (replacing Topic Pages)

Tags are flat strings. No tag entities. No tag pages with editorial descriptions.

### Tag UX

| Surface | Behavior |
|---------|----------|
| Content cards | Tag pills, clickable → `/archive/?tag=:slug` |
| Post detail pages | Tag pills below title |
| Catalog pages | Filter chips with counts at top |
| Archive page | Type + tag multi-select filters |
| Homepage | No tag cloud (latest posts with type badges provide structure) |

### Tag URLs

Tags are query parameters:
- `/archive/?tag=travel-rule`
- `/research/?tag=emerging-markets`
- `/archive/?tag=travel-rule&tag=stablecoins` (intersection)

### Starter Tags

`travel-rule`, `cross-border-payments`, `stablecoin-regulation`, `correspondent-banking`, `emerging-markets`, `vasp-licensing`, `compliance`, `cbdc`, `africa`, `southeast-asia`

### Scaling

At 50+ articles: tag chips show top 10-12 by frequency + "Show all" expand.
At 200+ articles: consider adding a `/catalog` page with multi-facet filtering.
Escape hatch: can always layer editorial curation onto specific tags later if SEO demands it.

---

## 7. Substack Cross-Posting

### Content Format

Body is pure markdown (no MDX). Interactive elements degrade to static images + links.

### Canonical Strategy

Institute URL is always canonical. Substack posts link back:
> "Originally published on [RemiDe Institute](https://institute.remide.xyz/research/slug)"

### RSS Feeds

```
/feed                    → All content (Atom 1.0, full body)
/feed/research           → Research only
/feed/perspectives       → Perspectives only
/feed/explains           → Explains only
```

Full content in RSS — enables email tools, aggregators, and Substack import.

### Cross-Post Workflow

1. Publish on institute (canonical)
2. Cross-post to Substack (with canonical link back)
3. Store `substackUrl` on institute record
4. Post shows "Also on Substack" link

---

## 8. Cross-Referencing

### Content → Data

`jurisdictions[]` and `entities[]` on each post link to `/data/` pages.

### Data → Content + Library

"Mentioned In" on data detail pages pulls from both original content and curated library:
```sql
(SELECT title, slug, kind, 'content' AS source, published_at
 FROM institute_content
 WHERE jurisdictions @> ARRAY['NG'] AND status = 'published')
UNION ALL
(SELECT title, slug, 'library' AS kind, 'library' AS source, published_at
 FROM library_items
 WHERE jurisdictions @> ARRAY['NG'])
ORDER BY published_at DESC;
```

### Related Content

Boolean overlap on entities/jurisdictions. Manual override in metadata.

```sql
SELECT * FROM institute_content
WHERE (jurisdictions && $1 OR entities && $2)
  AND id != $3 AND status = 'published'
ORDER BY published_at DESC LIMIT 3;
```

---

## 9. Archive Page

`/archive/` is the unified discovery surface. All content types, filterable.

```
Type: [All] [Research] [Perspectives] [Explains]
Tags: [Travel Rule (8)] [Cross-Border (5)] [Stablecoins (4)] ...
Sort: [Newest] [Recently Updated]

● [Research] Africa's $120B Crisis · 29 sources · 18 min · Mar 12
● [Perspective] Pre-SWIFT Moment · 12 sources · 12 min · Mar 3
● [Explains] How Travel Rule Works · 8 sources · 8 min · Feb 28
...
```

URL-driven state: `/archive/?type=research&tag=travel-rule`

---

## 10. Search

Global search (Cmd+K) across all content + data. Results grouped:
```
Research (3) | Perspectives (1) | Explains (2) | Data (47) | Library (2)
```

---

## 11. Mobile

- Sidebar → slide-out drawer
- Homepage → single-column stack
- Data tables → horizontal scroll
- Content → full-width prose (720px max)
- Search → full-screen overlay

---

## 12. Decisions Log

| Decision | Chosen | Rejected | Reason |
|----------|--------|----------|--------|
| Content types | Research, Perspective, Explains | 1 unified type; 6 types; Research/Perspective/Guide split | User: "perspectives and guides are the same"; Explains is new educational type |
| Sources | Required on ALL types | Optional on Perspective | User: "all my content has sources" |
| Topic pages | Killed → tags only | `/topics/:slug` with editorial descriptions | User: "just a catalog with tags, native" |
| Guide type | Merged into Perspective | Standalone `/guides/` | User: "perspectives and guides are identical material" |
| Content format | Substack-portable markdown | MDX with interactive components | User: "big posts we can throw on Substack" |
| Sidebar label | "INTEL" | "POSTS", "INTELLIGENCE", "CONTENT" | User: "POSTS sounds like a blogger." INTEL is short and institutional. |
| Homepage | Publication front page | Bloomberg terminal, catalog-first | Latest posts + type badges provide structure |
| RSS | Full-content Atom feeds, per-type | No RSS | Cross-posting to Substack requires RSS infrastructure |
| Whitepapers (Tap Protocol) | Featured long-form Perspective | Separate "Papers" section; separate content type | Avoids empty section for 1-2 docs. Tap Protocol IS a perspective. `format: 'long-form'` switches template. |
| About / product section | "REMIDE" sidebar section (How It Works, Story, Stakeholders, Contact) | Separate "About" + "O-REMEDY"; mini-landing; footer links | User: "O-REMEDY won't be understood in English." All company info lives under REMIDE. Substantial content from Notion DD-rooms. |
| Library | Kept as curated external research hub | Kill it | User: "Library is where someone can come and download everything in one place" |
| Monetization | Removed from IA entirely | Paywall on text, conversion funnels | User: "throw out any paywalls from this story." Focus purely on content ↔ data interaction. |
| Notion internal docs | Excluded from migration | Publish everything | Competitive intel (CPN analysis, Ripple analysis), internal architecture, partner docs stay private. Only market-facing research goes public. |
| Strategy Session | Removed from site | Keep as product page | Not needed in IA. Sales handled through Contact / Discovery Call. |
| Post authorship | Brand byline "RemiDe" on standard posts | Personal byline "Anton Titov" on everything | Standard posts = brand. Only long-form featured (e.g. Tap Protocol) gets named authors — co-signed by specific people/institutions. |
| "Also on Substack" | Removed from homepage and content cards | Show on featured post | Substack is distribution plumbing, not brand signal. Link stays only at bottom of individual articles. |
| REMIDE sidebar size | 8 items, keep as full section | Collapse to 3-4 items | Normal for product companies (cf. Chainalysis). Section is fine at 8 items after removing Strategy Session. |

---

## 13. Content Inventory & Migration Map

Audit of all existing content across `institute.remide.xyz` (super.site) and Notion Research Library.
Some Notion documents are internal competitive intelligence and are excluded from public migration.

### 13.1 INTEL — Research (~8 public posts)

| Source | Current Title | New Slug | Tags |
|--------|--------------|----------|------|
| institute | Pre-SWIFT Moment | `/research/pre-swift-moment` | `cross-border-payments`, `stablecoin-regulation`, `compliance` |
| Notion | Africa Stablecoin Liquidity Deficit | `/research/africa-stablecoin-liquidity-deficit` | `africa`, `emerging-markets`, `stablecoins` |
| Notion | Riding Africa's Stablecoin Wave | `/research/riding-africas-stablecoin-wave` | `africa`, `emerging-markets`, `stablecoins` |
| Notion | Unblocking Africa's Trade: Turning US... | `/research/unblocking-africas-trade` | `africa`, `cross-border-payments` |
| Notion | Monetary Sovereignty in the Age of Stablecoins | `/research/monetary-sovereignty-stablecoins` | `cbdc`, `stablecoin-regulation`, `emerging-markets` |
| Notion | Sovereignty Over Speed: Why EM... | `/research/sovereignty-over-speed` | `emerging-markets`, `stablecoin-regulation` |
| Notion | Deep Research 1: How Top Cross-Border... | `/research/how-top-cross-border` | `cross-border-payments`, `correspondent-banking` |
| Notion | Cross-Border Stablecoin Settlement... | `/research/cross-border-stablecoin-settlement` | `cross-border-payments`, `stablecoins` |

### 13.2 INTEL — Perspectives (~5 public posts)

| Source | Current Title | New Slug | Notes |
|--------|--------------|----------|-------|
| institute | Corridor Models | `/perspectives/corridor-models` | Orchestrator vs Ownership guide |
| institute | Launch Checklist | `/perspectives/launch-checklist` | 6-layer stack playbook |
| institute | Stablecoin Use Cases | `/perspectives/stablecoin-use-cases` | 5 use cases with practical details |
| Notion | Tap Protocol | `/perspectives/tap-protocol` | `format: 'long-form'` — featured, 50+ pages, policy proposal for central banks |

### 13.3 INTEL — Explains (~2 public posts, need more)

| Source | Current Title | New Slug | Notes |
|--------|--------------|----------|-------|
| institute | Travel Rule | `/explains/travel-rule` | IVMS-101, how it works, role-specific tables |
| institute | Stablecoins 2.0 & Banking 2.0 | `/explains/stablecoins-banking-convergence` | 3 narratives decoded, convergence thesis |

**Planned Explains (to be written):**
- "What is Banking 2.0" (extract from convergence piece)
- "What is VASP Licensing"
- "How Compliance Workflow Works"
- "What are CBDCs"

### 13.4 INTEL — Library (16 curated external reports)

All sourced from `institute.remide.xyz/market-researches.md`:

| Organization | Report |
|-------------|--------|
| Citi GPS | Stablecoins 2030: Web3 to Wall Street |
| McKinsey | The Stable Door Opens |
| BIS | Annual Report 2025 — Next-Generation Monetary System |
| FATF | Recommendation 16 — Travel Rule Guidance |
| Stanford Law | A New Era of Stablecoins |
| EU | MiCA Regulation (2023/1114) |
| Chainalysis | Geography of Cryptocurrency 2024 |
| World Bank | Remittance Prices Worldwide |
| TRM Labs | Stablecoin Adoption Index |
| Keyrock & Bitso | Stablecoin: The Trillion Dollar Opportunity |
| BCG & Ripple | Tokenized Asset Market Projections |
| Fireblocks | Bank Stablecoin Integration Survey |
| Deloitte | Digital Banking Reimagined |
| Oliver Wyman | The Future of Payments |
| KPMG | Cryptoassets for Banking |
| arXiv | Banking 2.0: The Stablecoin Banking Revolution |

### 13.5 REMIDE — Product & Company (~9 pages)

| Source | Current Title | New URL | Notes |
|--------|--------------|---------|-------|
| institute | SCN (Stablecoin Clearing Network) | `/remide/how-it-works` | Main product page: architecture, flow, pricing, integration |
| institute | Off-Ramp Marketplace | `/remide/marketplace` | Auction model for fiat disbursement |
| institute | Current Solutions | `/remide/alternatives` | Competitive decode: Circle CPN, Bridge, Notabene |
| institute | Participants | `/remide/participants` | Network participant types |
| institute | People Behind SCN | `/remide/stakeholders` | Team, advisors, testimonials |
| institute | FAQ | `/remide/faq` | Product Q&A |
| institute | Discovery Call | `/remide/contact` | Booking page |
| — | (to create) | `/remide/story` | Why we build this. Assemble from intro texts + People page. |

### 13.6 Notion — Internal Only (NOT migrated)

| Title (truncated) | Reason |
|-------------------|--------|
| CPN без операционного UI: окно во... | Internal competitive intelligence (Circle CPN) |
| CPN's Ceiling: Issuer Conflicts... | Internal competitive intelligence |
| Why Ripple/ODL Failed as a Clearing... | Internal competitive analysis |
| Compliance Flow Architecture in Stab... | Internal technical architecture |
| Business Requirements... | Internal product specs |
| Onboarding docs, partner docs | Internal operations |

### 13.7 Summary

| Section | Count | Status |
|---------|-------|--------|
| **INTEL / Research** | 8 | Good base for launch |
| **INTEL / Perspectives** | 4 (incl. Tap Protocol featured) | Sufficient |
| **INTEL / Explains** | 2 (+4 planned) | Minimum viable, grow over time |
| **INTEL / Library** | 16 external reports | Excellent collection |
| **DATA** | Full tracker | Entities, Jurisdictions, Map |
| **REMIDE** | 8 pages (1 to create) | Dense, well-developed |
| **Total public content** | ~38 items | Publication-ready at launch |
