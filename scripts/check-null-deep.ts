import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(
  process.env.VITE_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

async function check() {
  // Check: are the null canonical_name entities processed or not?
  const { data } = await sb.from('entities')
    .select('id, name, canonical_name, last_quality_at, quality_score, parser_id')
    .is('canonical_name', null)
    .limit(15);

  console.log('Entities with canonical_name=NULL:');
  for (const r of data ?? []) {
    console.log(`  [${r.parser_id}] last_quality_at=${r.last_quality_at ? 'SET' : 'NULL'} score=${r.quality_score} name=${(r.name as string).substring(0, 60)}`);
  }

  // Count: null canonical + null last_quality_at (truly unprocessed)
  const { count: c1 } = await sb.from('entities')
    .select('*', { count: 'exact', head: true })
    .is('canonical_name', null)
    .is('last_quality_at', null);
  console.log(`\nTruly unprocessed (both null): ${c1}`);

  // Count: null canonical + non-null last_quality_at (processed but canonical_name not set!)
  const { count: c2 } = await sb.from('entities')
    .select('*', { count: 'exact', head: true })
    .is('canonical_name', null)
    .not('last_quality_at', 'is', null);
  console.log(`Processed but canonical_name still NULL: ${c2}`);
}

check();
