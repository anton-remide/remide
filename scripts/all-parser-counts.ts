import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
if (url === undefined || key === undefined) { console.error('Missing env'); process.exit(1); }

const sb = createClient(url, key);

async function main() {
  const counts: Record<string, number> = {};
  let offset = 0;
  const batchSize = 1000;

  while (true) {
    const { data, error } = await sb
      .from('entities')
      .select('parser_id')
      .range(offset, offset + batchSize - 1);
    if (error) { console.error(error); break; }
    if (data.length === 0) break;
    for (const row of data) {
      const pid = row.parser_id || 'null';
      counts[pid] = (counts[pid] || 0) + 1;
    }
    offset += batchSize;
  }

  // Sort alphabetically
  const sorted = Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]));
  console.log('ALL PARSERS WITH ENTITY COUNTS:');
  for (const [pid, cnt] of sorted) {
    console.log(`  ${pid.padEnd(28)} ${cnt}`);
  }
  console.log(`\nTotal parsers: ${sorted.length}`);
  console.log(`Total entities: ${Object.values(counts).reduce((a, b) => a + b, 0)}`);
}

main().catch(console.error);
