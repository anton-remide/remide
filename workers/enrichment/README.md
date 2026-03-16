# Enrichment Worker

Scrapes entity websites via Firecrawl to extract structured metadata and market intelligence (English summary, social links, logo/favicon, audience/region hints, fiat on-ramp, app platform, trading pairs, time-on-market) and writes enriched data back to Supabase entities table.

## How it works

1. Query Supabase for entities missing `description` or `linkedin_url`
2. For each entity with a `website` URL, call Firecrawl to scrape the site
3. Extract structured metadata (description, LinkedIn, Twitter, founding year, etc.)
4. Write enriched fields back to Supabase
5. Log results to `scrape_runs` table

## Required env vars

All loaded via `shared/config.ts`:

| Var | Required | Description |
|-----|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service key (full access) |
| `FIRECRAWL_API_KEY` | Yes | Firecrawl API key |
| `TELEGRAM_BOT_TOKEN` | No | For error alerts |
| `TELEGRAM_CHAT_ID` | No | For error alerts |
| `DRY_RUN` | No | Set to `true` to skip DB writes |

## Supabase tables

- **Reads:** `entities` (website, description, linkedin_url)
- **Writes:** `entities` (description, linkedin_url, enriched_at)
- **Logs:** `scrape_runs` (registry_id = 'enrichment')

## Run locally

```bash
cd remide
npx tsx workers/enrichment/run.ts
npx tsx workers/enrichment/run.ts --country ZA  # Single country
npx tsx workers/enrichment/run.ts --crypto-only # Only confirmed/adjacent crypto entities
npx tsx workers/enrichment/run.ts --limit 5000   # Full run (all entities)
DRY_RUN=true npx tsx workers/enrichment/run.ts  # Dry run
```

## GitHub Actions

```yaml
name: Enrichment Worker
on:
  schedule:
    - cron: '0 4 * * *'  # Daily 4am UTC
  workflow_dispatch:

jobs:
  enrich:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: npx tsx workers/enrichment/run.ts
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          FIRECRAWL_API_KEY: ${{ secrets.FIRECRAWL_API_KEY }}
```

## Worker pattern

```typescript
import { config } from '../../shared/config.js';
import { getSupabase } from '../../shared/supabase.js';
import { logger } from '../../shared/logger.js';

async function main() {
  logger.info('enrichment', 'Starting enrichment worker...');
  const sb = getSupabase();
  // ... worker logic
}

main().catch((err) => {
  logger.error('enrichment', err.message);
  process.exit(1);
});
```
