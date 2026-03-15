import { getSupabase } from '../shared/supabase.js';

async function check() {
  const sb = getSupabase();
  
  // Check remaining quotes in canonical_name
  const { data } = await sb.from('entities')
    .select('id, name, canonical_name')
    .eq('country_code', 'PL')
    .limit(2420);
  
  const stillQuoted = data?.filter((e: any) => e.canonical_name && e.canonical_name.includes('"'));
  console.log('PL total:', data?.length);
  console.log('Canonical names still with " quotes:', stillQuoted?.length);
  stillQuoted?.slice(0, 10).forEach((e: any) => console.log('  name:', e.name?.substring(0, 50), '\n  canonical:', e.canonical_name?.substring(0, 50)));
  
  // Show some cleaned examples
  const cleaned = data?.filter((e: any) => e.canonical_name && e.canonical_name !== e.name);
  console.log('\nSample cleaned PL names:');
  cleaned?.slice(0, 10).forEach((e: any) => console.log('  [' + e.name?.substring(0, 45) + '] → [' + e.canonical_name?.substring(0, 45) + ']'));
  
  // Check Polish low quotes
  const polishQ = data?.filter((e: any) => e.canonical_name && (e.canonical_name.includes(',,') || e.canonical_name.includes("''")));
  console.log('\nCanonical with Polish ,, or \'\':', polishQ?.length);
}
check();
