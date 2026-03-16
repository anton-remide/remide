# Session Report — Secondary Parser Bundle

Date: 2026-03-15
Scope: `gb-fca-emi`, `ca-osc`, `nz-fma`, `hk-sfc-lc` + parser hardening

## Implemented

- Added parser: `parsers/registries/hk-sfc-lc.ts`
  - `registryId`: `hk-sfc-lc`
  - HTML extraction + dedup
  - strict noise filtering to avoid non-company navigation text
  - curated fallback list with CE numbers
- Registered parser in `parsers/registry.ts`
- Added tests in `parsers/__tests__/html-parsers.test.ts` for:
  - parser config
  - table parsing behavior
  - fallback behavior

## Validation

- Test suite: `npx vitest run --config parsers/vitest.config.ts parsers/__tests__/html-parsers.test.ts`
  - Result: `74/74 passed`
- `hk-sfc-lc` live smoke parse:
  - Result: parser returns fallback list in current live state
  - Count: 8 entities
  - Sample:
    - Hash Blockchain Limited (`BPL992`)
    - OSL Digital Securities Limited (`BPL993`)
    - Victory Securities Company Limited (`AAV008`)

## Notion Sync Status

- Notion dual-write is currently disabled in environment (`NOTION_TOKEN` missing).
- Supabase is configured and reachable.
- Direct Notion write is blocked until token is provided.

## Current Data Quality Snapshot (database-wide)

Source: `npx tsx scripts/data-quality-report.ts --json`

- Total entities: 15,249
- Canonical names: 13,263 (86.98%)
- Garbage: 1,144 (7.50%)
- Hidden: 727 (4.77%)
- Visible: 11,393 (74.71%)
- Unprocessed by quality worker: 1,986 (13.02%)
- Avg quality score: 64

Enrichment fields:
- `enriched_at`: 0
- with website: 5,222
- with description: 0
- with LinkedIn: 0
- with brand_name: 0

## Company-level Metrics (target parsers)

Source: direct Supabase query by `parser_id` for:
`it-oam-vasp`, `ch-vqf`, `ch-sofit`, `gb-fca-emi`, `ca-osc`, `nz-fma`, `hk-sfc-lc`, `gb-fca`, `sg-mas`, `au-austrac`, `us-fincen`.

### Parsers with data currently present

- `sg-mas`
  - total: 10
  - canonical: 10
  - garbage: 0
  - hidden: 0
  - with website: 10
  - enriched: 0
- `au-austrac`
  - total: 27
  - canonical: 27
  - garbage: 21
  - hidden: 0
  - with website: 0
  - enriched: 0
  - sample indicates noisy/date-like remnants still exist and are flagged as garbage

### Parsers not yet materialized in DB (count = 0)

- `it-oam-vasp`
- `ch-vqf`
- `ch-sofit`
- `gb-fca-emi`
- `ca-osc`
- `nz-fma`
- `hk-sfc-lc`
- `gb-fca`
- `us-fincen`

Interpretation:
- Parser code and tests are ready.
- Production table has not yet been repopulated for these parser IDs in this environment (or entries were not written because runs were dry-run/anomaly-blocked).
- Quality/enrichment effects for these parser IDs will appear only after live parser writes + worker passes.

## Recommended Next Commands

From `/remide`:

1) Run parser writes (live):
- `npx tsx parsers/run.ts --registry hk-sfc-lc --force`
- `npx tsx scripts/run-critical-parsers.ts --with-quality`

2) Run workers:
- `npx tsx workers/verify/run.ts --limit 2000`
- `npx tsx workers/enrichment/run.ts --limit 5000`

3) Re-check metrics:
- `npx tsx scripts/data-quality-report.ts --json`

4) Enable Notion sync:
- set `NOTION_TOKEN` in `.env.local`, then rerun parser writes without `--no-notion`.
