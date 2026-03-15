import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function check() {
  // Check total entities
  const { count: total } = await sb.from('entities').select('*', { count: 'exact', head: true });
  console.log(`Total entities: ${total}`);

  // Check is_hidden counts
  const { count: hidden } = await sb.from('entities').select('*', { count: 'exact', head: true }).eq('is_hidden', true);
  console.log(`Hidden entities (is_hidden=true): ${hidden}`);

  // Check by hidden_reason
  const { data: reasons } = await sb.from('entities').select('hidden_reason').eq('is_hidden', true).not('hidden_reason', 'is', null);
  if (reasons && reasons.length > 0) {
    const byReason: Record<string, number> = {};
    reasons.forEach((r: any) => { byReason[r.hidden_reason] = (byReason[r.hidden_reason] || 0) + 1; });
    console.log('\nBy hidden_reason:');
    Object.entries(byReason).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log(`  ${k}: ${v}`));
  } else {
    console.log('\nNo entities with hidden_reason set!');
  }

  // Check EPI/EEMI/ENL license types
  for (const lt of ['E-Money Payment Institution (EPI)', 'Exempt EMI', 'Entity National Law']) {
    const { count } = await sb.from('entities').select('*', { count: 'exact', head: true }).eq('license_type', lt);
    const { count: hiddenLt } = await sb.from('entities').select('*', { count: 'exact', head: true }).eq('license_type', lt).eq('is_hidden', true);
    console.log(`\n${lt}: total=${count}, hidden=${hiddenLt}`);
  }

  // Check is_garbage
  const { count: garbage } = await sb.from('entities').select('*', { count: 'exact', head: true }).eq('is_garbage', true);
  console.log(`\nGarbage entities: ${garbage}`);

  // Check entities with no canonical_name (won't show on frontend anyway)
  const { count: noName } = await sb.from('entities').select('*', { count: 'exact', head: true }).is('canonical_name', null);
  console.log(`Entities with no canonical_name: ${noName}`);

  // Frontend-visible count (not hidden, not garbage, has canonical_name)
  const { count: visible } = await sb.from('entities')
    .select('*', { count: 'exact', head: true })
    .not('canonical_name', 'is', null)
    .neq('is_garbage', true)
    .neq('is_hidden', true);
  console.log(`\nFrontend-visible entities: ${visible}`);
}

check().catch(console.error);
