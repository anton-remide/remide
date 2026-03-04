# Intelligence Worker

Monitors regulatory changes across jurisdictions using Parallel.ai and Anthropic APIs. Detects new laws, license updates, enforcement actions, and regime changes.

## How it works

1. For each tracked jurisdiction, query news/regulatory sources for recent changes
2. Use Anthropic Claude to analyze and classify changes (new law, enforcement, regime shift)
3. Generate structured alerts with impact assessment
4. Write alerts to Supabase and send Telegram notifications for high-impact changes
5. Optionally update jurisdiction `notes` field with latest regulatory context

## Required env vars

All loaded via `shared/config.ts`:

| Var | Required | Description |
|-----|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service key (full access) |
| `ANTHROPIC_API_KEY` | Yes | For Claude analysis |
| `PARALLEL_API_KEY` | No | For source monitoring |
| `TELEGRAM_BOT_TOKEN` | No | For high-impact alerts |
| `TELEGRAM_CHAT_ID` | No | For high-impact alerts |
| `DRY_RUN` | No | Set to `true` to skip DB writes |

## Supabase tables

- **Reads:** `countries` (regime, regulator, key_law, notes)
- **Writes:** `regulatory_alerts` (future table), `countries` (notes)
- **Logs:** `scrape_runs` (registry_id = 'intelligence')

## Run locally

```bash
cd remide
npx tsx workers/intelligence/run.ts
npx tsx workers/intelligence/run.ts --country US  # Single jurisdiction
npx tsx workers/intelligence/run.ts --tier 1      # Tier 1 jurisdictions only
DRY_RUN=true npx tsx workers/intelligence/run.ts  # Dry run
```

## GitHub Actions

```yaml
name: Intelligence Worker
on:
  schedule:
    - cron: '0 6 * * *'  # Daily 6am UTC
  workflow_dispatch:

jobs:
  intel:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: npx tsx workers/intelligence/run.ts
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
          TELEGRAM_CHAT_ID: ${{ secrets.TELEGRAM_CHAT_ID }}
```

## Worker pattern

```typescript
import { config } from '../../shared/config.js';
import { getSupabase } from '../../shared/supabase.js';
import { logger, sendTelegramAlert } from '../../shared/logger.js';

async function main() {
  logger.info('intelligence', 'Starting intelligence worker...');
  const sb = getSupabase();
  // ... worker logic
  if (highImpactChange) {
    await sendTelegramAlert('intelligence', `Regime change detected: ${country}`, true);
  }
}

main().catch((err) => {
  logger.error('intelligence', err.message);
  process.exit(1);
});
```
