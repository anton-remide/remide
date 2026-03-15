import { getSupabase } from '../shared/supabase.js';

const sb = getSupabase();

async function main() {
  // Find how Polish entities are stored (what parser_id, country_code, regulator)
  const { data: plSearch } = await sb.from('entities')
    .select('id, name, canonical_name, parser_id, country_code, regulator')
    .or('country_code.eq.PL,parser_id.ilike.%pl%,name.ilike.%spółka%,name.ilike.%spolka%')
    .order('name')
    .limit(15);

  console.log('=== Polish entity search (country/parser/name patterns) ===');
  console.log(`Found: ${plSearch?.length ?? 0}`);
  for (const e of plSearch ?? []) {
    console.log(`  name: "${e.name?.substring(0, 100)}"`);
    console.log(`  canonical: ${e.canonical_name ? `"${e.canonical_name.substring(0, 100)}"` : 'NULL/empty'}`);
    console.log(`  parser: ${e.parser_id}, country: ${e.country_code}, regulator: ${e.regulator}`);
    console.log('');
  }

  // NYDFS: get ALL entities for this parser with full names
  const { data: nydfsAll } = await sb.from('entities')
    .select('id, name, canonical_name, is_garbage')
    .eq('parser_id', 'us-nydfs')
    .eq('is_garbage', false)
    .order('name');

  console.log('=== NYDFS non-garbage entities ===');
  console.log(`Found: ${nydfsAll?.length ?? 0}`);
  for (const e of nydfsAll ?? []) {
    const cn = e.canonical_name ?? '';
    const nameShort = e.name?.substring(0, 120) ?? '';
    const isDiff = cn && cn !== e.name;
    console.log(`  name: "${nameShort}"`);
    if (isDiff) console.log(`  canonical: "${cn.substring(0, 120)}"`);
    else if (!cn) console.log(`  canonical: [EMPTY/NULL]`);
    else console.log(`  canonical: [SAME AS NAME]`);
    console.log('');
  }

  // Check: sample of entities where name starts with „ (Polish opening quote)
  const { data: quoteEntities } = await sb.from('entities')
    .select('id, name, canonical_name, parser_id, country_code')
    .like('name', '„%')
    .limit(10);

  console.log(`=== Entities starting with „ (Polish opening quote) ===`);
  console.log(`Found: ${quoteEntities?.length ?? 0}`);
  for (const e of quoteEntities ?? []) {
    console.log(`  name: "${e.name?.substring(0, 100)}"`);
    console.log(`  canonical: "${e.canonical_name?.substring(0, 100) ?? 'NULL'}"`);
    console.log(`  parser: ${e.parser_id}, country: ${e.country_code}`);
    console.log('');
  }

  // Check esma-unified entities for PL
  const { data: esmaPl } = await sb.from('entities')
    .select('id, name, canonical_name, parser_id, country_code, regulator')
    .eq('parser_id', 'esma-unified')
    .eq('country_code', 'PL')
    .limit(10);

  console.log(`=== ESMA-unified PL entities ===`);
  console.log(`Found: ${esmaPl?.length ?? 0}`);
  for (const e of esmaPl ?? []) {
    console.log(`  name: "${e.name?.substring(0, 100)}"`);
    console.log(`  canonical: "${e.canonical_name?.substring(0, 100) ?? 'NULL'}"`);
    console.log(`  regulator: ${e.regulator}`);
    console.log('');
  }
}

main().catch(console.error);
