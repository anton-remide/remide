# Exports Worker

Generates downloadable data exports (CSV, JSON, PDF reports) for premium users. Future integration with Stripe billing for paid export access.

## How it works

1. Accept export request (entity list, jurisdiction report, or full dataset)
2. Query Supabase for requested data
3. Format into target format (CSV, JSON, or PDF via Puppeteer)
4. Upload to Supabase Storage or serve directly
5. Track export usage for billing (future: Stripe metering)

## Required env vars

All loaded via `shared/config.ts`:

| Var | Required | Description |
|-----|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service key (full access) |
| `DRY_RUN` | No | Set to `true` to skip writes |

## Supabase tables

- **Reads:** `entities`, `countries`, `stablecoins`, `cbdcs`
- **Writes:** Supabase Storage (exports bucket)
- **Logs:** `export_logs` (future table)

## Export types

| Type | Format | Description |
|------|--------|-------------|
| `entities-csv` | CSV | Full entity directory with filters |
| `jurisdiction-report` | PDF | Single jurisdiction deep-dive report |
| `compliance-matrix` | CSV | Cross-jurisdiction compliance comparison |
| `full-dataset` | JSON | Complete dataset dump (premium) |

## Run locally

```bash
cd remide
npx tsx workers/exports/run.ts --type entities-csv --country ZA
npx tsx workers/exports/run.ts --type jurisdiction-report --code US
npx tsx workers/exports/run.ts --type full-dataset
DRY_RUN=true npx tsx workers/exports/run.ts --type entities-csv  # Preview
```

## GitHub Actions

```yaml
name: Exports Worker
on:
  workflow_dispatch:
    inputs:
      type:
        description: 'Export type'
        required: true
        type: choice
        options: [entities-csv, jurisdiction-report, compliance-matrix, full-dataset]
      filter:
        description: 'Filter (country code or empty for all)'
        required: false

jobs:
  export:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: npx tsx workers/exports/run.ts --type ${{ inputs.type }} ${{ inputs.filter && format('--filter {0}', inputs.filter) || '' }}
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

## Worker pattern

```typescript
import { config } from '../../shared/config.js';
import { getSupabase } from '../../shared/supabase.js';
import { logger } from '../../shared/logger.js';

async function main() {
  logger.info('exports', 'Starting export worker...');
  const sb = getSupabase();
  // ... export logic
}

main().catch((err) => {
  logger.error('exports', err.message);
  process.exit(1);
});
```
