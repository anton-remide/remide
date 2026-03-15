/**
 * Check how many numbered companies are still visible (not garbage)
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(
  process.env.VITE_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

async function main() {
  // Fetch all non-garbage entities
  let allEntities: any[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await sb
      .from('entities')
      .select('id, name, canonical_name, is_garbage, country_code, parser_id, license_type')
      .eq('is_garbage', false)
      .range(from, from + pageSize - 1);

    if (error) { console.error('Error:', error.message); break; }
    if (!data || data.length === 0) break;
    allEntities.push(...data);
    from += pageSize;
    if (data.length < pageSize) break;
  }

  console.log('Total non-garbage entities:', allEntities.length);

  // Find all that look like numbered companies
  const numbered = allEntities.filter(e => {
    const n = e.canonical_name || e.name;
    return /^\d{4,}/.test(n); // starts with 4+ digits
  });

  console.log('Numbered companies (4+ leading digits) still visible:', numbered.length);

  // Breakdown
  const by8 = numbered.filter(e => /^\d{8,}/.test(e.canonical_name || e.name));
  const by6 = numbered.filter(e => /^\d{6,7}/.test(e.canonical_name || e.name));
  const by4 = numbered.filter(e => /^\d{4,5}/.test(e.canonical_name || e.name));
  console.log('  8+ digits:', by8.length);
  console.log('  6-7 digits:', by6.length);
  console.log('  4-5 digits:', by4.length);

  // By country
  const byCountry = new Map<string, number>();
  for (const e of numbered) {
    const cc = e.country_code || '??';
    byCountry.set(cc, (byCountry.get(cc) || 0) + 1);
  }
  console.log('\nBy country:');
  [...byCountry.entries()].sort((a, b) => b[1] - a[1]).forEach(([cc, n]) => console.log(`  ${cc}: ${n}`));

  // Sample
  console.log('\nSample (first 20):');
  numbered.slice(0, 20).forEach(e => {
    console.log(`  "${e.canonical_name || e.name}" (${e.country_code}, ${e.parser_id})`);
  });

  // Also check: entities starting with ( or other garbage patterns
  const parenStart = allEntities.filter(e => {
    const n = e.canonical_name || e.name;
    return /^\(/.test(n);
  });
  console.log('\nEntities starting with (:', parenStart.length);
  parenStart.slice(0, 10).forEach(e => {
    console.log(`  "${e.canonical_name || e.name}" (${e.country_code}, ${e.license_type})`);
  });

  // Check entities with very short names (likely garbage)
  const shortNames = allEntities.filter(e => {
    const n = e.canonical_name || e.name;
    return n.length <= 3;
  });
  console.log('\nEntities with name <= 3 chars:', shortNames.length);
  shortNames.slice(0, 10).forEach(e => {
    console.log(`  "${e.canonical_name || e.name}" (${e.country_code}, ${e.parser_id})`);
  });
}

main();
