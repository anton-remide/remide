# Registry Coverage Execution Board (Weeks 1-6)

> Date: 2026-03-15  
> Goal: close critical registry coverage gaps first, run enrichment in parallel, ship entity fusion before US-NMLS.

## Priority Order (fixed)

1. Fix broken high-impact parsers (P0)
2. Build missing national critical parsers (P0)
3. Run enrichment continuously in background
4. Ship entity fusion (mandatory before `us-nmls`)
5. Expand data model
6. Launch `us-nmls` + automation

## Weekly Plan

## Week 1 — Stabilize Existing Coverage

- Scope:
  - Fix `gb-fca` (API key + parser recovery)
  - Fix `sg-mas` (pagination)
  - Start `au-austrac` (Playwright base + selectors)
  - Start `us-fincen` (Playwright base + selectors)
- Expected gain:
  - UK + SG restored, AU/US in active build
- Definition of done:
  - Parser returns non-empty entities
  - `parsers/health-check.ts` status `ok`
  - Quality worker run completed
  - No schema errors in parser output

## Week 2 — Complete P0 Fixes

- Scope:
  - Finish `au-austrac`
  - Finish `us-fincen`
  - Resolve ESMA failing country slices (`esma-it`, `esma-de`, etc.)
- Expected gain:
  - AU + US recovery, EU unlock in batch
- Definition of done:
  - All four repaired parsers pass health-check
  - ESMA error set reduced to zero or documented blocked subset
  - Delta counts validated vs prior run snapshot

## Week 3 — Build New Critical National Parsers

- Scope:
  - Build `it-oam-vasp` (critical gap for transition entities)
  - Build `ch-vqf`
  - Start `ch-sofit`
- Expected gain:
  - Italy OAM + Swiss SRO coverage begins
- Definition of done:
  - New parsers registered in `parsers/registry.ts`
  - Unit tests added for parser-specific transform logic
  - Runbook note added (auth/rate-limit/captcha caveats if any)

## Week 4 — Finish Critical New Coverage + Fusion Start

- Scope:
  - Finish `ch-sofit`
  - Build secondary parser candidates:
    - `gb-fca-emi`
    - `ca-osc`
  - Start Entity Fusion foundation (`companies` model + linking strategy)
- Expected gain:
  - Swiss critical set complete, UK/CA extensions in motion
- Definition of done:
  - `it-oam-vasp`, `ch-vqf`, `ch-sofit` produce stable non-empty output
  - Entity Fusion technical design approved and schema draft ready

## Week 5 — Entity Fusion Implementation (hard gate)

- Scope:
  - Implement `companies` table and `company_id` FK on entities
  - Dedup matching by `domain + canonical_name` with confidence thresholds
  - Backfill links for existing entities
  - Search/profile path supports grouped company view
- Expected gain:
  - Duplicate explosion risk controlled before NMLS
- Definition of done:
  - Same company across jurisdictions links to one `company_id`
  - Duplicate rate reduced and measured
  - QA checklist completed on known multi-license brands

## Week 6 — Data Model Expansion + NMLS Preparation

- Scope:
  - Add `category` and `source_type`
  - Seed priority non-registry entities (DeFi/infra/tools)
  - Prepare `us-nmls` ingestion plan and pilot run
- Expected gain:
  - Broader product model ready, NMLS launch-safe foundation
- Definition of done:
  - New columns live and mapped end-to-end
  - Seed pipeline documented and repeatable
  - `us-nmls` dry-run validated against fusion logic

## Parallel Track — Enrichment (starts Day 1, never pauses)

- Run daily on maximum practical throughput.
- Keep rate limits only at provider safety level, not artificial product limits.
- Track:
  - enriched entities/day
  - remaining backlog
  - error/retry ratio
- Target:
  - legacy backlog cleared by Week 4

## Daily Run Order (operator checklist)

1. Run parser(s) for current sprint scope.
2. Run quality worker (mandatory after parser runs).
3. Run verify worker (DNS/HTTP liveness).
4. Run enrichment worker (long batch, background).
5. Run health-check and capture report snapshot.
6. Log outcomes (what failed, why, next action).

## Commands (from `/remide`)

```bash
# 1) Parsers
npx tsx parsers/run.ts --registry <id>

# 1b) Critical bundle (P0)
npx tsx scripts/run-critical-parsers.ts --with-quality

# 2) Quality (mandatory)
npx tsx workers/quality/run.ts --limit 50000

# 3) Verify
npx tsx workers/verify/run.ts --limit 20000

# 4) Enrichment
npx tsx workers/enrichment/run.ts --limit 50000

# 4b) Website discovery (finds missing websites)
npx tsx workers/website-discovery/run.ts

# 4c) Site scraper (Cheerio, no Firecrawl credits)
npx tsx workers/site-scraper/run.ts

# 4d) Brand coverage
npx tsx workers/brand-coverage/run.ts

# 5) Health report
npx tsx parsers/health-check.ts
```

## Exit Criteria for This 6-Week Program

- P0 broken parsers fixed (`gb-fca`, `sg-mas`, `au-austrac`, `us-fincen`)
- Critical missing parsers shipped (`it-oam-vasp`, `ch-vqf`, `ch-sofit`)
- ESMA error cluster resolved
- Enrichment backlog materially reduced (target: near-zero old backlog)
- Entity Fusion live before `us-nmls`
- `us-nmls` approved for production launch
