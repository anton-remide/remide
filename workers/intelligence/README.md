# Intelligence Worker

> **STATUS: NOT IMPLEMENTED — PLANNED ONLY**
>
> This README describes the intended design. No `run.ts` exists yet.
> Do not reference this worker as "active" or "deployed" in any documentation.

Monitors regulatory changes across jurisdictions using Parallel.ai and Anthropic APIs. Detects new laws, license updates, enforcement actions, and regime changes.

## Intended Design

1. For each tracked jurisdiction, query news/regulatory sources for recent changes
2. Use Anthropic Claude to analyze and classify changes (new law, enforcement, regime shift)
3. Generate structured alerts with impact assessment
4. Write alerts to Supabase and send Telegram notifications for high-impact changes
5. Optionally update jurisdiction `notes` field with latest regulatory context

## Required env vars (when implemented)

| Var | Required | Description |
|-----|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service key (full access) |
| `ANTHROPIC_API_KEY` | Yes | For Claude analysis |
| `PARALLEL_API_KEY` | No | For source monitoring |
| `TELEGRAM_BOT_TOKEN` | No | For high-impact alerts |
| `TELEGRAM_CHAT_ID` | No | For high-impact alerts |
| `DRY_RUN` | No | Set to `true` to skip DB writes |

## Supabase tables (planned)

- **Reads:** `countries` (regime, regulator, key_law, notes)
- **Writes:** `regulatory_alerts` (future table), `countries` (notes)
- **Logs:** `scrape_runs` (registry_id = 'intelligence')
