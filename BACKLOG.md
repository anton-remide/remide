# RemiDe — Backlog

## Data Pipeline: Entity & Jurisdiction Enrichment

### Context
Entity detail pages now support `description`, `registryUrl`, `linkedinUrl` fields. Jurisdiction detail pages support `description`. All are empty and need to be populated from external sources.

### P0: Web Scraper / Parser

**Goal:** Compile descriptions, registry URLs, and LinkedIn URLs for all 608 entities and 206 jurisdictions.

**Entity fields to populate:**
- `description` — 2-3 sentence summary of what the company does (from their website / about page)
- `registry_url` — direct link to the regulator's license registry entry (e.g., FinCEN MSB search, MAS registry)
- `linkedin_url` — company LinkedIn page URL

**Jurisdiction fields to populate:**
- `description` — 2-3 sentence market overview: regulatory stance, recent developments, key requirements

**Approach options:**
1. **LLM-assisted scraping** — For each entity: fetch website → extract about/description → summarize with LLM. For registries: find the regulator's search page → construct direct link.
2. **Manual curation** — Google Sheets → Supabase import. Most accurate but slow.
3. **Hybrid** — LLM generates draft → human reviews & approves.

**Registry URL patterns (known):**
- US/FinCEN: `https://www.fincen.gov/msb-registrant-search` (search by name)
- Singapore/MAS: `https://eservices.mas.gov.sg/fid/institution` (search by name)
- Japan/FSA: `https://www.fsa.go.jp/menkyo/menkyo.html`
- EU/ESMA: varies by member state
- UK/FCA: `https://register.fca.org.uk/s/search`

### P1: Auto-Update Worker

**Goal:** Keep entity status and license data fresh via periodic checks.

**Requirements:**
- Cron job (daily or weekly) that checks registry URLs for status changes
- Detect: license revoked, new license granted, status change
- Update Supabase records automatically
- Send notification/log on changes

**Architecture:**
- Supabase Edge Function or external worker (e.g., Cloudflare Worker)
- Uses `registry_url` field to know where to check
- Stores `last_checked_at` and `last_changed_at` timestamps
- Diff detection: compare scraped status vs stored status

### P2: New Data Sources

- **Sanctions lists** — Cross-reference entities against OFAC, EU sanctions
- **Compliance scores** — Aggregate rating based on license type, travel rule status, regulatory regime
- **News feed** — Recent regulatory news per jurisdiction (RSS or news API)

---

## UI Enhancements (Lower Priority)

- [ ] Mobile-responsive mini-map on JurisdictionDetailPage
- [ ] Entity comparison view (side-by-side)
- [ ] Export to CSV/PDF from tables
- [ ] Saved filters / bookmarks (requires user preferences in Supabase)
- [ ] Dark mode toggle
