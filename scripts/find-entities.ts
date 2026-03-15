import dotenv from 'dotenv'; dotenv.config({ path: '.env.local' }); dotenv.config();
import { getSupabase } from '../shared/supabase.js';
const sb = getSupabase();
async function main() {
  // Test different search approaches
  const searches = [
    { label: 'Payward (canonical)', col: 'canonical_name', val: 'Payward Canada' },
    { label: 'Payward (name)', col: 'name', val: '%PAYWARD%' },
    { label: 'Indodax (name)', col: 'name', val: '%INDODAX%' },
    { label: 'Direct Crypto', col: 'canonical_name', val: 'Direct Crypto' },
    { label: 'Nuage', col: 'canonical_name', val: 'Nuage Payments Canada' },
  ];
  for (const s of searches) {
    if (s.val.includes('%')) {
      const { data, error } = await sb.from('entities').select('id, name, canonical_name').ilike(s.col, s.val).limit(3);
      console.log(`${s.label}: ${data?.length ?? 0} results, error: ${error?.message ?? 'none'}`);
      if (data) data.forEach((e: any) => console.log(`  -> ${e.id} | ${e.name} | ${e.canonical_name}`));
    } else {
      const { data, error } = await sb.from('entities').select('id, name, canonical_name').eq(s.col, s.val).limit(3);
      console.log(`${s.label}: ${data?.length ?? 0} results, error: ${error?.message ?? 'none'}`);
      if (data) data.forEach((e: any) => console.log(`  -> ${e.id} | ${e.name} | ${e.canonical_name}`));
    }
  }
}
main();
