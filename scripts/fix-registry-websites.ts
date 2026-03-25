/**
 * One-time cleanup: move registry URLs from `website` → `registry_url`,
 * clear `website` so that website-discovery can find the real company site.
 *
 * Usage:
 *   npx tsx scripts/fix-registry-websites.ts              # dry-run
 *   npx tsx scripts/fix-registry-websites.ts --apply       # actually write
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { isRegistryWebsite } from '../shared/registry-domains.js';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  const apply = process.argv.includes('--apply');
  console.log(apply ? '=== LIVE MODE — will update DB ===' : '=== DRY RUN — no changes ===');

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

  const affected: any[] = [];
  const PAGE_SIZE = 1000;
  let offset = 0;
  let total = 0;

  while (true) {
    const { data, error } = await sb
      .from('entities')
      .select('id, name, website, registry_url, country_code, raw_data')
      .not('website', 'is', null)
      .neq('website', '')
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error('Query error:', error.message);
      process.exit(1);
    }

    if (!data || data.length === 0) break;
    total += data.length;

    for (const row of data) {
      if (isRegistryWebsite(row.website)) {
        affected.push(row);
      }
    }

    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
    console.log(`  scanned ${total} entities so far, ${affected.length} affected...`);
  }

  console.log(`Scanned ${total} entities with websites.`);

  console.log(`Found ${affected.length} entities with registry URLs in website field:\n`);

  for (const row of affected) {
    console.log(`  [${row.country_code}] ${row.name}`);
    console.log(`    website (registry): ${row.website}`);
    console.log(`    registry_url:       ${row.registry_url || '(empty)'}`);

    if (apply) {
      const rawData = { ...(row.raw_data || {}), previous_website_was_registry: row.website };

      const { error: updateErr } = await sb
        .from('entities')
        .update({
          registry_url: row.website,
          website: '',
          raw_data: rawData,
        })
        .eq('id', row.id);

      if (updateErr) {
        console.log(`    ERROR: ${updateErr.message}`);
      } else {
        console.log(`    FIXED: website cleared, moved to registry_url`);
      }
    } else {
      console.log(`    → would move to registry_url and clear website`);
    }
    console.log();
  }

  console.log(`\nTotal: ${affected.length} entities ${apply ? 'fixed' : 'would be fixed'}`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
