# Exports Worker

> **STATUS: NOT IMPLEMENTED — PLANNED ONLY**
>
> This README describes the intended design. No `run.ts` exists yet.
> Do not reference this worker as "active" or "deployed" in any documentation.

Generates downloadable data exports (CSV, JSON, PDF reports) for premium users. Future integration with Stripe billing for paid export access.

## Intended Design

1. Accept export request (entity list, jurisdiction report, or full dataset)
2. Query Supabase for requested data
3. Format into target format (CSV, JSON, or PDF via Puppeteer)
4. Upload to Supabase Storage or serve directly
5. Track export usage for billing (future: Stripe metering)

## Required env vars (when implemented)

| Var | Required | Description |
|-----|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service key (full access) |
| `DRY_RUN` | No | Set to `true` to skip writes |

## Export types (planned)

| Type | Format | Description |
|------|--------|-------------|
| `entities-csv` | CSV | Full entity directory with filters |
| `jurisdiction-report` | PDF | Single jurisdiction deep-dive report |
| `compliance-matrix` | CSV | Cross-jurisdiction compliance comparison |
| `full-dataset` | JSON | Complete dataset dump (premium) |
