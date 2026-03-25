# RemiDe — Backlog

> **Source of truth:** Notion Knowledge Base (`collection://c973a8be-f1be-462c-bf14-55c47f0c5708`).
> This file is a quick-reference cache. Last synced: 2026-03-14.

---

## Completed (Post-Launch baseline)

- ✅ 86 registry parsers (15K+ entities across 60+ jurisdictions)
- ✅ Quality Worker (canonical_name, garbage detection, crypto classification, scoring)
- ✅ Enrichment Worker (Firecrawl — descriptions, LinkedIn, social, audience, fiat on-ramp)
- ✅ Website Discovery Worker (DuckDuckGo + known brands mapping)
- ✅ Site Scraper Worker (Cheerio — brand, description, social links)
- ✅ Verify Worker (DNS + HTTP liveness)
- ✅ Brand Coverage Worker (CoinGecko + curated stablecoin/payments list)
- ✅ Stripe €49 one-time payment (Edge Functions)
- ✅ 3-tier paywall (Anonymous → Registered → Paid)
- ✅ Progressive entity loading
- ✅ Stride stablecoin data integration (issuers, laws, events, licenses)
- ✅ Stablecoin/CBDC/Issuer detail pages
- ✅ SEO (BrowserRouter, meta tags, sitemap, JSON-LD)

---

## In Progress

| Task | Sprint | Owner |
|------|--------|-------|
| S2.14: Multi-Registry Coverage Spec | S2 | Both |
| S1.20: Parser documentation in Notion | S1 | Both |

---

## Backlog — by priority

### Core / Standard — Data Pipeline

- **S2.17:** us-nmls parser (45+ states)
- **S2.8:** Fix us-fincen parser (browser automation)
- **S2.9:** Fix gb-fca parser (API key)
- **S2.10:** Build India parser (FIU-IND)
- **S2.12:** Build parsers for 175 remaining countries
- **S1.W2b:** Medium parsers — 12 countries (HK, PH, NZ, GE, NG, BM, SV, VG, MX, BH, IL, GR)
- **S1.W3:** Hard strategic parsers (TR, BR, IN, KE, GH)
- **S3.12:** Market cap live feed (CoinGecko/CoinMarketCap daily)
- **S3.4:** Stablecoins intelligence — $50M+ mcap, issuer cross-reference

### Core / Standard — Enrichment & Quality

- **S4.6:** Entity enrichment — LinkedIn/websites/Clay
- **S4.8:** Parallel.ai dataset API — entity gap detection
- **S4.7:** Jurisdiction enrichment — AI descriptions
- **S4.10:** Verification worker — license status cross-check
- **S4.11:** Supabase-Notion sync for data QA

### Standard — Monetization & Product

- **S6.3:** Access tiers spec — Free/Registered/Paid/Export
- **S6.4:** Content gating spec
- **S6.5:** Monetization strategy spec
- **S7.5:** Research reports section — gated content hub

### Post-Launch Polish (UI/SASHA)

- Map tooltip should show tab-relevant data
- Landing page hero — clear CTA for compliance users
- Entities page layout spacing
- Pricing CTA 'Special Offer' badge
- Search results — truncate regulator names
- Teal background text formatting
- Signup page tagline

### Future (S7/S8)

- Dark mode + responsive design polish
- Entity detail page — enriched profile + license history
- Mobile full adaptation (S8)
- API (v3.0)

---

## UI Enhancements (Lower Priority)

- [ ] Mobile-responsive mini-map on JurisdictionDetailPage
- [ ] Entity comparison view (side-by-side)
- [ ] Export to CSV/PDF from tables
- [ ] Saved filters / bookmarks
- [ ] Dark mode toggle
