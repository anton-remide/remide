/**
 * Check the first 500 entities as they would appear on the page
 * (sorted by canonical_name, non-garbage only)
 * Look for remaining quality issues.
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(
  process.env.VITE_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

async function main() {
  const { data, error } = await sb
    .from('entities')
    .select('id, name, canonical_name, country_code, parser_id, license_type, is_garbage')
    .eq('is_garbage', false)
    .order('canonical_name', { nullsFirst: false })
    .limit(500);

  if (error) { console.error(error.message); return; }

  console.log(`First 500 entities (sorted by canonical_name):\n`);

  const issues: string[] = [];

  for (let i = 0; i < data!.length; i++) {
    const e = data![i];
    const n = e.canonical_name || e.name;
    let flags: string[] = [];

    // Check: starts with digits
    if (/^\d/.test(n)) flags.push('DIGIT_START');
    // Check: starts with special chars
    if (/^[^A-Za-z0-9]/.test(n)) flags.push('SPECIAL_START');
    // Check: numbered list pattern (1) or 2) )
    if (/^\d+\)/.test(n)) flags.push('LIST_NUMBER');
    // Check: very long name (> 80 chars)
    if (n.length > 80) flags.push('VERY_LONG');
    // Check: ALL CAPS (3+ words)
    if (/^[A-Z\s]{10,}$/.test(n) && n.split(/\s+/).length >= 3) flags.push('ALL_CAPS');
    // Check: numbered company pattern
    if (/^\d{4,}/.test(n)) flags.push('NUMBERED');
    // Check: still has legal suffix
    if (/\b(Ltd\.?|LLC|Inc\.?|GmbH|S\.A\.|Sp\.\s*z\s*o\.?\s*o\.?)\s*$/i.test(n)) flags.push('HAS_SUFFIX');

    if (flags.length > 0) {
      issues.push(`  [${i+1}] "${n.substring(0, 70)}${n.length > 70 ? '...' : ''}" (${e.country_code}) [${flags.join(', ')}]`);
    }
  }

  console.log(`Issues found in first 500: ${issues.length}`);
  issues.forEach(line => console.log(line));

  // Also check: remaining numbered companies (any digit count)
  console.log('\n--- All entities starting with 4+ digits (non-garbage) ---');
  const numbered = data!.filter(e => /^\d{4,}/.test(e.canonical_name || e.name));
  numbered.forEach(e => console.log(`  "${e.canonical_name || e.name}" (${e.country_code}, ${e.parser_id})`));
  console.log(`Count: ${numbered.length}`);

  // Check specifically for Canadian entities with any digit prefix
  console.log('\n--- Canadian entities starting with digits (non-garbage, first 500) ---');
  const caDigit = data!.filter(e => e.country_code === 'CA' && /^\d/.test(e.canonical_name || e.name));
  caDigit.forEach(e => console.log(`  "${e.canonical_name || e.name}" (${e.parser_id})`));
  console.log(`Count: ${caDigit.length}`);
}

main();
