# VASP Tracker — Data Pipeline Reference

> Single source of truth for all parsers, workers, quality rules, and data flows.
> Auto-referenced by agents, used for gap analysis and quality audits.
>
> **Last verified against codebase:** 2026-03-25

---

## Table of Contents

1. [Pipeline Overview](#1-pipeline-overview)
2. [Data Flow & Schedule](#2-data-flow--schedule)
3. [Parsers (86 registered)](#3-parsers-86-registered)
4. [Workers](#4-workers)
5. [Quality Rules Engine](#5-quality-rules-engine)
6. [Enrichment Pipeline](#6-enrichment-pipeline)
7. [Shared Infrastructure](#7-shared-infrastructure)
8. [Database Schema (key columns)](#8-database-schema-key-columns)
9. [Known Issues & Gaps](#9-known-issues--gaps)
10. [Live Metrics Snapshot](#10-live-metrics-snapshot)

---

## 1. Pipeline Overview

```
┌─────────────┐    ┌─────────────┐    ┌──────────────────┐    ┌─────────────┐
│  86 Parsers  │───▶│  Supabase   │───▶│  Quality Worker   │───▶│   Website   │
│  (Mon 06:00) │    │  `entities` │    │  (daily 05:00)    │    │  Discovery  │
│              │    │  + scrape_  │    │  cleanup/classify/ │    │ (daily 02:00)│
│  HTML/API/   │    │    runs     │    │  score/brand       │    │  brand+guess │
│  CSV/PDF     │    │             │    │                    │    │              │
└─────────────┘    └─────────────┘    └──────────────────┘    └──────┬──────┘
                                                                      │
┌─────────────┐    ┌─────────────┐    ┌──────────────────┐           │
│  Site        │◀──│ Enrichment  │◀──│  DNS Verify       │◀──────────┘
│  Scraper     │    │ (Firecrawl) │    │  (daily 03:00)    │
│ (daily 06:00)│    │(daily 04:00)│    │  alive/dead/none   │
│  cheerio     │    │  desc/logo/ │    │                    │
│  backfill    │    │  social/etc  │    │                    │
└─────────────┘    └─────────────┘    └──────────────────┘

Side processes:
  ├── Parser Doctor    (daily 10:00) — auto-diagnose + fix broken parsers via Claude
  ├── Brand Coverage   (Tue 07:00)   — CoinGecko brand matching
  ├── Quality Report   (Mon 09:00)   — data quality stats
  └── Keep-alive       (daily 08:00) — ping Supabase
```

---

## 2. Data Flow & Schedule

### Execution order (daily pipeline)

| Time (UTC) | Worker | Purpose | Depends on |
|------------|--------|---------|------------|
| 02:00 | `website-discovery` | Find real websites for entities missing them (or with registry URLs) | — |
| 03:00 | `dns-verify` | Check DNS/HTTP liveness for all websites | website-discovery |
| 04:00 | `enrichment` (Firecrawl) | Scrape corporate sites → description, socials, logo, brand | dns-verify, quality |
| 05:00 | `quality` | Cleanup names, detect garbage, classify crypto, score 0-100 | — |
| 06:00 | `site-scraper` | Cheerio backfill for entities Firecrawl missed | enrichment |
| 08:00 | `keep-alive` | Ping Supabase to prevent cold starts | — |
| 10:00 | `parser-doctor` | Auto-diagnose + fix broken parsers | parsers |

### Weekly schedule

| Time (UTC) | Worker | Purpose |
|------------|--------|---------|
| Mon 06:00 | `parsers` | Run all 86 registry parsers → refresh entity data |
| Mon 07:30 | `quality` | Post-parser quality pass |
| Mon 08:00 | `parser-doctor` | Check for parser failures from Mon run |
| Mon 09:00 | `data-quality-report` | Generate stats report |
| Tue 07:00 | `brand-coverage` | CoinGecko brand matching |

### Key invariant

Enrichment **requires** `last_quality_at IS NOT NULL` — entities must pass through quality worker before they can be enriched. This prevents wasting Firecrawl credits on garbage/unclassified rows.

---

## 3. Parsers (86 registered)

All parsers are in `parsers/registries/` and registered in `parsers/registry.ts`.

### Parser contract

Every parser implements `RegistryParser` and outputs `ParsedEntity[]`:
- **Required:** `name`, `licenseNumber`, `countryCode`, `country`, `sourceUrl`
- **Optional:** `licenseType`, `entityTypes`, `activities`, `status`, `regulator`, `website`

### DB write strategy

`parsers/core/db.ts` uses **delete + insert** (not upsert):
1. Backup quality columns (`canonical_name`, `is_garbage`, `quality_score`, `crypto_status`, `dns_status`, etc.) — INFRA-002
2. Delete existing entities for the parser's country+parser_id
3. Insert new rows in batches of 50
4. Restore backed-up quality columns

### Full parser inventory

| Parser ID | Country | Regulator | Source | Entities (last) |
|-----------|---------|-----------|--------|-----------------|
| ae-adgm | AE | ADGM FSRA | api | — |
| ae-dfsa | AE | DFSA | html | — |
| ae-vara | AE | VARA | html | 42 |
| ar-cnv | AR | CNV | html | — |
| at-fma | AT | FMA | csv | 7 |
| au-austrac | AU | AUSTRAC | html | 21 |
| bd-bsec | BD | BSEC | html | — |
| be-fsma | BE | FSMA | csv | 1 |
| bh-cbb | BH | CBB | html | — |
| bm-bma | BM | BMA | html | — |
| br-bcb | BR | BCB | api | — |
| ca-fintrac | CA | FINTRAC | csv | 3310 |
| ca-osc | CA | OSC | html | 22 |
| ch-finma | CH | FINMA | csv | 11 |
| ch-sofit | CH | SO-FIT | html | 4 |
| ch-vqf | CH | VQF | html | 0 |
| cl-cmf | CL | CMF | html | — |
| co-sfc | CO | SFC | html | — |
| cy-cysec | CY | CySEC | — | 8 |
| cz-cnb | CZ | CNB | csv | 6 |
| de-bafin | DE | BaFin | csv | 50 |
| dk-dfsa | DK | Finanstilsynet | csv | 3 |
| eba-euclid | EU | EBA + NCAs | api | 4501 (partial) |
| ee-fiu | EE | FIU | html | — |
| ee-fsa | EE | Finantsinspektsioon | csv | 0 |
| es-cnmv | ES | CNMV | csv | 5 |
| esma-unified | EU | ESMA CASP | csv | 300 (partial) |
| fi-finfsa | FI | FIN-FSA | csv | 5 |
| fr-amf | FR | AMF | csv | 12 |
| gb-fca | GB | FCA | api | 0 |
| gb-fca-emi | GB | FCA EMI | api | 8 |
| gb-pra | GB | PRA | csv | — |
| ge-nbg | GE | NBG | html | — |
| gg-gfsc | GG | GFSC Guernsey | html | — |
| gi-gfsc | GI | FSC Gibraltar | html | 0 |
| hk-sfc | HK | SFC | html | — |
| hk-sfc-lc | HK | SFC (licensed corps) | html | — |
| hr-hanfa | HR | HANFA | html | — |
| id-ojk | ID | OJK / Bappebti | json | 41 |
| ie-cbi | IE | CBI | csv | 11 |
| il-isa | IL | ISA | html | — |
| im-fsa | IM | Isle of Man FSA | html | 301 |
| in-fiu | IN | FIU-IND | html | — |
| it-consob | IT | CONSOB | csv | 0 |
| it-oam-vasp | IT | OAM | html | 0 |
| je-jfsc | JE | JFSC | html | — |
| jp-fsa | JP | FSA Japan | csv | 28 |
| ke-cma | KE | CMA | html | — |
| kr-fiu | KR | KOFIU / FSC | html | — |
| ky-cima | KY | CIMA | html | 21 |
| kz-afsa | KZ | AFSA | html | — |
| li-fma | LI | FMA Liechtenstein | api | 25 |
| lt-bol | LT | Bank of Lithuania | csv | 4 |
| lu-cssf | LU | CSSF | csv | 4 |
| mt-mfsa | MT | MFSA | csv | 12 |
| mx-cnbv | MX | CNBV | html | — |
| my-sc | MY | SC Malaysia | html | 87 |
| ng-cbn | NG | CBN | html | — |
| ng-sec | NG | SEC Nigeria | html | — |
| nl-dnb | NL | DNB | csv | 23 |
| no-fsa | NO | Finanstilsynet | csv | 0 |
| nz-fma | NZ | FMA NZ | html | — |
| pa-sbp | PA | SBP | html | — |
| pe-sbs | PE | SBS | html | — |
| ph-bsp | PH | BSP | html | — |
| pk-secp | PK | SECP | html | — |
| pl-knf | PL | KNF | csv | 0 |
| pt-cmvm | PT | CMVM | csv | 0 |
| qa-qfcra | QA | QFCRA | html | — |
| ru-cbr | RU | CBR | html | — |
| sa-sama | SA | SAMA | html | — |
| sc-fsa | SC | FSA Seychelles | html | 9 |
| se-fi | SE | Finansinspektionen | csv | 1 |
| sg-mas | SG | MAS | html | 43 |
| sv-cnad | SV | CNAD | html | — |
| th-sec | TH | SEC Thailand | html | 28 |
| tr-spk | TR | SPK / CMB | html | — |
| tw-fsc | TW | FSC Taiwan | html | 27 |
| tz-bot | TZ | Bank of Tanzania | html | — |
| ua-nssmc | UA | NSSMC | html | — |
| us-fdic | US | FDIC | api | — |
| us-fincen | US | FinCEN | html | 0 |
| us-nydfs | US | NYDFS | html | 68 |
| vg-fsc | VG | FSC BVI | html | — |
| vn-sbv | VN | SBV / MoF | html | — |
| za-fsca | ZA | FSCA | pdf | 300 |

**Note:** `stride-tracker.ts` exists on disk but is NOT registered in `PARSERS` — it's a separate Stride API ingestion for stablecoins/jurisdictions.

---

## 4. Workers

### 4.1 Quality Worker

| | |
|---|---|
| **File** | `workers/quality/run.ts` + `workers/quality/rules.ts` |
| **Workflow** | `.github/workflows/quality.yml` |
| **Schedule** | Daily 05:00, Mon 07:30 |
| **Reads** | `entities` where `last_quality_at IS NULL` (or `--force` for all) |
| **Writes** | `canonical_name`, `is_garbage`, `quality_score`, `quality_flags`, `crypto_status`, `last_quality_at`, `brand_name`, `crypto_related` |
| **Limits** | Default 5,000; max 50,000; batch 1,000 |
| **Alerts** | Telegram if garbage rate > 30% and > 50 entities |

### 4.2 DNS Verify Worker

| | |
|---|---|
| **File** | `workers/verify/run.ts` |
| **Workflow** | `.github/workflows/dns-verify.yml` |
| **Schedule** | Daily 03:00 |
| **Reads** | `entities` with website, not garbage; refreshes if `dns_checked_at` null or > 30 days |
| **Writes** | `dns_status` (alive/dead/no_website), `dns_checked_at`, `last_verified_at` |
| **Limits** | Default 500; max 20,000; concurrency 10; DNS timeout 5s, HTTP timeout 10s |
| **Alerts** | Telegram if dead > 30% and > 50 entities |

### 4.3 Website Discovery Worker

| | |
|---|---|
| **File** | `workers/website-discovery/run.ts` |
| **Workflow** | `.github/workflows/website-discovery.yml` |
| **Schedule** | Daily 02:00 |
| **Reads** | `entities` where website is null/empty OR is a registry URL (`isRegistryWebsite`) |
| **Writes** | `website`, `registry_url` (if replacing registry URL), `raw_data` discovery metadata |
| **Phases** | 1) Brand matching (120+ known brands → instant URL), 2) Domain guessing (slug + TLD + HEAD check) |
| **Limits** | Default 50,000; batch 1,000; domain check 3s timeout; 10 parallel; 200ms between entities |

### 4.4 Enrichment Worker (Firecrawl)

| | |
|---|---|
| **File** | `workers/enrichment/run.ts` |
| **Workflow** | `.github/workflows/enrichment.yml` |
| **Schedule** | Daily 04:00 |
| **Reads** | `entities` with valid website, `last_quality_at` set, not garbage/hidden, DNS not dead, not registry URL |
| **Writes** | `description`, `linkedin_url`, `twitter_url`, `brand_name`, `enriched_at`, `raw_data` (logo_url, contact_email, keywords, site_languages, etc.) |
| **Limits** | Default 5,000; max 50,000; 1.5s between Firecrawl calls; scrape timeout 30s |
| **Cost** | Firecrawl Standard plan: 100,000 credits/month ($99) |

### 4.5 Site Scraper (Cheerio)

| | |
|---|---|
| **File** | `workers/site-scraper/run.ts` |
| **Workflow** | `.github/workflows/site-scraper.yml` |
| **Schedule** | Daily 06:00 |
| **Purpose** | Cheaper fetch+cheerio pass; backfills entities Firecrawl missed |
| **Reads** | `entities` with website, not garbage/hidden, `enriched_at IS NULL` unless `--force` |
| **Writes** | `brand_name`, `description`, `linkedin_url`, `twitter_url`, `enriched_at`, `raw_data` (og_image, favicon, etc.) |
| **Limits** | Default 50,000; request timeout 15s; 150ms delay; concurrency 5 |

### 4.6 Brand Coverage

| | |
|---|---|
| **File** | `workers/brand-coverage/run.ts` |
| **Workflow** | `.github/workflows/brand-coverage.yml` |
| **Schedule** | Tue 07:00 |
| **Purpose** | CoinGecko exchanges → match entities → `brand_aliases` table |
| **Limits** | 200 brands; 2.5s between CoinGecko pages; 60s wait on 429 |

### 4.7 Parser Doctor

| | |
|---|---|
| **File** | `workers/parser-doctor/run.ts` |
| **Workflow** | `.github/workflows/parser-doctor.yml` |
| **Schedule** | Mon 08:00, Daily 10:00 |
| **Purpose** | Find broken parsers from `scrape_runs` (error/partial in last 48h); fetch source HTML; Claude diagnoses; tests fix; creates PR or Issue |
| **Limits** | Max HTML 15,000 chars; fetch timeout 20s; test timeout 60s; 1 fix attempt per parser |

### 4.8 Stubs (not implemented)

- `workers/intelligence/` — README only
- `workers/exports/` — README only

---

## 5. Quality Rules Engine

File: `workers/quality/rules.ts`

### 5.1 Name cleanup (`cleanName`)

Iterative removal of: legal suffixes (Ltd, GmbH, Sp. z o.o., K.K., 株式会社, etc. — 50+ patterns), noise prefixes (bullets, numbers, "Subsidiary Organization of"), markdown markers, quotes, f/k/a clauses, DBA aliases, soft hyphens. ALL-CAPS → title case (preserving acronyms like LLC, BTC, etc.)

### 5.2 Garbage detection (`detectGarbage`)

| Rule | Catches |
|------|---------|
| Name length < 2 or > 200 | Data corruption |
| Boilerplate names | "N/A", "unknown", "pending", etc. |
| Garbage character patterns | Dates, registry codes, CONSOB gibberish, article refs |
| Pure numbers | "123456" |
| Numbered companies (6+ leading digits) | FINTRAC shell corps: "1000224522 ONTARIO INC." |
| Quebec format (XXXX-XXXX) | "9435-9643 Québec" |
| List-numbered | "1)kantor..." |
| Markdown prose as name | NYDFS: "**The Department granted..." |
| Sentence-like text > 100 chars | Contains "granted", "approved", "the department" |
| Standalone coin names | "Bitcoin", "Ethereum" (coins, not companies) |
| Personal names | 2-word names where first word is in EU first-name list |
| Out-of-scope activities | Insurance, pension, reinsurance |
| Out-of-scope license types | Insurance, credit union |
| Test/dummy markers | "test", "demo", "placeholder" in short names |
| URL or email as name | Data import artifacts |

### 5.3 Crypto classification (`classifyCryptoStatus`)

Priority order:
1. **Parser ID map** (`PARSER_CRYPTO_MAP`): 86 parser IDs → `confirmed_crypto` / `traditional` / `unknown`
2. **License type patterns**: regex for VASP/CASP/DPT vs bank/insurance
3. **Keyword analysis**: 100+ crypto keywords vs 30+ tradfi keywords in all text fields
4. **Website domain heuristic** (weak): `CRYPTO_DOMAINS` substrings in website URL
5. **Fallback**: `unknown`

### 5.4 Quality scoring

| Field | Points | Condition |
|-------|--------|-----------|
| name | 10 | > 2 chars |
| license_number | 5 | Non-empty |
| license_type | 5 | Non-empty |
| status | 5 | Not "Unknown" |
| regulator | 5 | Non-empty |
| **website** | **15** | Non-empty, > 3 chars, not "N/A", **not a registry URL** |
| **description** | **15** | > 20 chars |
| linkedin_url | 10 | Contains "linkedin.com" |
| activities | 10 | Non-empty array |
| entity_types | 10 | Non-empty array |

**Tiers:** T4 ≥ 80, T3 ≥ 60, T2 ≥ 40, T1 < 40

### 5.5 Registry URL detection

`shared/registry-domains.ts` contains 100+ known regulator hostnames. Used by:
- Quality worker (website scores 0 if registry URL)
- Website discovery (picks up entities with registry URLs)
- Enrichment (skips registry URLs)
- Parsers (SG-MAS, GI-GFSC, HK-SFC patched to not set `website` to registry URLs)

---

## 6. Enrichment Pipeline

### Firecrawl extraction

From scraped markdown + metadata:
- **Description**: OG description → twitter description → first paragraph
- **LinkedIn URL**: og/twitter/link tags, href matching
- **Twitter URL**: og/twitter/link tags
- **Brand name**: `og:site_name` → `application-name` → cleaned `<title>`
- **Logo URL**: OG image → favicon
- **Contact email**: mailto links, page text
- **Keywords**: meta keywords
- **Site languages**: html lang, content-language header
- **Business heuristics**: target regions, audience, fiat on-ramp, app platforms, trading pairs, founded year

### Enrichment eligibility filters

Entity must satisfy ALL:
- `website` is non-null, non-empty, not a placeholder
- `is_garbage = false`, `is_hidden = false`
- `last_quality_at IS NOT NULL` (passed quality)
- `dns_status` is NOT `dead` or `no_website`
- `website` is NOT a registry URL (`isRegistryWebsite`)
- Missing `description` and/or `linkedin_url`

---

## 7. Shared Infrastructure

### Config (`shared/config.ts`)

| Area | Keys |
|------|------|
| Supabase | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, anon key |
| Notion | `NOTION_TOKEN` + hardcoded DB IDs |
| Telegram | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` |
| AI | `ANTHROPIC_API_KEY`, `FIRECRAWL_API_KEY` |
| Flags | `DRY_RUN`, `NOTION_DUAL_WRITE`, `TELEGRAM_ALERTS`, `DEBUG` |

### Guards (`shared/guards.ts`)

| Limit | Value |
|-------|-------|
| ENRICHMENT_MAX_BATCH | 50,000 |
| QUALITY_MAX_BATCH | 50,000 |
| VERIFY_MAX_BATCH | 20,000 |
| SUPABASE_WRITE_BATCH | 50 |
| MAX_RETRIES | 3 |
| MAX_WORKER_RUNTIME | 6 hours |
| LOCK_STALE | 7 hours |

### Logging (`shared/logger.ts`)

Console logger + Telegram alerts via Bot API. Skipped in DRY_RUN mode.

---

## 8. Database Schema (key columns)

### `entities` table

| Column | Type | Set by |
|--------|------|--------|
| id | text (slug) | Parser (db.ts) |
| name | text | Parser |
| canonical_name | text | Quality worker |
| brand_name | text | Quality / Enrichment |
| country_code | text | Parser |
| country | text | Parser |
| license_number | text | Parser |
| license_type | text | Parser |
| entity_types | text[] | Parser |
| activities | text[] | Parser |
| status | enum | Parser |
| regulator | text | Parser |
| website | text | Parser → Website discovery |
| registry_url | text | Fix script / Website discovery |
| source_url | text | Parser |
| description | text | Enrichment |
| linkedin_url | text | Enrichment |
| twitter_url | text | Enrichment |
| parser_id | text | Parser |
| parsed_at | timestamp | Parser |
| enriched_at | timestamp | Enrichment |
| dns_status | text | Verify worker |
| dns_checked_at | timestamp | Verify worker |
| last_verified_at | timestamp | Verify worker |
| crypto_status | text | Quality worker |
| crypto_related | boolean | Quality worker |
| is_garbage | boolean | Quality worker |
| quality_score | int | Quality worker |
| quality_flags | jsonb | Quality worker |
| last_quality_at | timestamp | Quality worker |
| is_hidden | boolean | Manual |
| raw_data | jsonb | All workers |
| sector | text | — |

### `scrape_runs` table

| Column | Type |
|--------|------|
| registry_id | text (parser ID or worker name) |
| status | text (success/partial/error) |
| entities_found | int |
| entities_new | int |
| entities_updated | int |
| entities_removed | int |
| duration_ms | int |
| error_message | text |
| warnings | text[] |
| delta_percent | float |
| created_at | timestamp |

### `brand_aliases` table

Written by brand-coverage worker. Maps CoinGecko exchange IDs to entity IDs.

---

## 9. Known Issues & Gaps

See `QUALITY-ISSUES.md` for the auto-tracked issue log.

### Structural issues

| Issue | Impact | Status |
|-------|--------|--------|
| `PARSER_CRYPTO_MAP` uses `ae-dfsareg` but parser ID is `ae-dfsa` | DFSA entities may not get parser-based crypto classification | OPEN |
| `id-ojk` uses `sourceType: 'json'` but `ParserConfig` only allows html/api/pdf/csv | Type mismatch | OPEN |
| Website-discovery docs say "DuckDuckGo" but code uses domain guessing | Doc drift | OPEN |
| `intelligence/` and `exports/` workers are stubs (README only) | No implementation | KNOWN |
| `stride-tracker.ts` not registered in PARSERS | Separate ingestion pipeline | BY DESIGN |

---

## 10. Live Metrics Snapshot

> As of 2026-03-25

| Metric | Value |
|--------|-------|
| **Total entities** | 15,324 |
| **Non-garbage** | 14,120 (92.1%) |
| **With website** | 8,796 (57.4%) |
| **Enriched** | 7,771 (50.7%) |
| **DNS alive** | 5,109 |
| **DNS dead** | 494 |
| **Quality scored** | 15,324 (100%) |
| **Crypto: confirmed** | 5,348 (34.9%) |
| **Crypto: adjacent** | 66 (0.4%) |
| **Crypto: traditional** | 9,486 (61.9%) |
| **Crypto: unknown** | 424 (2.8%) |

### Last parser run (2026-03-23)

| Status | Count | Parsers |
|--------|-------|---------|
| **Success** | ~15 | za-fsca, jp-fsa, ca-fintrac, ch-finma, id-ojk, ky-cima, tw-fsc, im-fsa, sc-fsa, th-sec |
| **Partial** | 2 | eba-euclid (4501), esma-unified (300) |
| **Error** | ~50+ | gb-fca, us-fincen, most esma-*, eba-*, CSV parsers, ae-vara, sg-mas, and others |

**Critical:** ~60% of parsers errored on last run. Many are CSV/API parsers where the source URL or format may have changed. Parser Doctor should address these automatically.
