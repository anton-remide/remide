import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(
  process.env.VITE_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

async function check() {
  const { count } = await sb.from('entities')
    .select('*', { count: 'exact', head: true })
    .is('canonical_name', null);
  console.log('Entities with canonical_name = NULL:', count);

  if ((count ?? 0) > 0) {
    const { data } = await sb.from('entities')
      .select('name, parser_id, country_code')
      .is('canonical_name', null)
      .limit(10);
    console.log('\nSamples:');
    for (const r of data ?? []) {
      console.log(`  [${r.parser_id}/${r.country_code}] ${r.name?.substring(0, 70)}`);
    }
  }

  // Also check: how many names still have quotes after canonical cleanup?
  const { data: stillDirty } = await sb.from('entities')
    .select('name, canonical_name')
    .not('canonical_name', 'is', null)
    .or('canonical_name.like.%\u201e%,canonical_name.like.%\u201c%,canonical_name.like.%\u00ab%,canonical_name.like.%\u00bb%,canonical_name.like.%,,"%')
    .limit(10);
  console.log(`\ncanonical_name with fancy quotes: ${stillDirty?.length ?? 0}`);
  for (const r of stillDirty ?? []) {
    console.log(`  CAN: ${r.canonical_name?.substring(0, 80)}`);
  }
}

check();
