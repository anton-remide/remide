import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
if (url === undefined || key === undefined) { console.error('Missing env'); process.exit(1); }

const sb = createClient(url, key);

async function main() {
  const { count: totalCount } = await sb.from('entities').select('*', { count: 'exact', head: true });
  console.log('TOTAL entities in DB:', totalCount);

  const { count: usCount } = await sb.from('entities').select('*', { count: 'exact', head: true }).eq('country_code', 'US');
  console.log('Total US entities:', usCount);

  const { count: fdicCount } = await sb.from('entities').select('*', { count: 'exact', head: true }).eq('parser_id', 'us-fdic');
  console.log('us-fdic parser entities:', fdicCount);

  const { count: nydfsCount } = await sb.from('entities').select('*', { count: 'exact', head: true }).eq('parser_id', 'us-nydfs');
  console.log('us-nydfs parser entities:', nydfsCount);

  // Top 10 parsers by entity count
  const allEntities: { parser_id: string }[] = [];
  let offset = 0;
  while (true) {
    const { data } = await sb.from('entities').select('parser_id').range(offset, offset + 999);
    if (data === null || data.length === 0) break;
    allEntities.push(...(data as { parser_id: string }[]));
    offset += data.length;
    if (data.length < 1000) break;
  }

  const byParser: Record<string, number> = {};
  for (const e of allEntities) {
    byParser[e.parser_id || 'null'] = (byParser[e.parser_id || 'null'] || 0) + 1;
  }

  const sorted = Object.entries(byParser).sort((a, b) => b[1] - a[1]);
  console.log(`\nTOP PARSERS BY ENTITY COUNT (${sorted.length} parsers, ${allEntities.length} total):`);
  for (const [parser, count] of sorted.slice(0, 20)) {
    console.log(`  ${parser.padEnd(25)} ${String(count).padStart(6)}`);
  }
}

main().catch(console.error);
