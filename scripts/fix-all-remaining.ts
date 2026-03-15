/**
 * Comprehensive garbage fix — flag ALL remaining junk entities:
 * 1. Quebec numbered companies (XXXX-XXXX Québec/Quebec)
 * 2. Polish list-numbered entities (1)kantor...)
 * 3. Any other XXXX-XXXX Province/State pattern
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(
  process.env.VITE_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

async function main() {
  // Fetch ALL non-garbage entities
  let all: any[] = [];
  let from = 0;
  while (true) {
    const { data } = await sb
      .from('entities')
      .select('id, name, canonical_name, country_code, parser_id, license_type')
      .eq('is_garbage', false)
      .range(from, from + 999);
    if (!data || data.length === 0) break;
    all.push(...data);
    from += 1000;
    if (data.length < 1000) break;
  }
  console.log(`Total non-garbage entities: ${all.length}`);

  // 1. Quebec numbered companies: XXXX-XXXX Québec/Quebec
  const quebec = all.filter(e => {
    const n = e.canonical_name || e.name;
    return /^\d{4}-\d{4}\s/i.test(n) && e.country_code === 'CA';
  });
  console.log(`\n1. Quebec numbered: ${quebec.length}`);
  quebec.forEach(e => console.log(`   "${e.canonical_name || e.name}"`));

  // 2. Entities starting with list numbering: "1)kantor..."
  const listNumbered = all.filter(e => {
    const n = e.canonical_name || e.name;
    return /^\d+\)/.test(n);
  });
  console.log(`\n2. List-numbered (N)...): ${listNumbered.length}`);
  listNumbered.forEach(e => console.log(`   "${(e.canonical_name || e.name).substring(0, 70)}" (${e.country_code})`));

  // 3. Remaining entities with 4+ contiguous leading digits
  const numbered4 = all.filter(e => {
    const n = e.canonical_name || e.name;
    return /^\d{4,}\s/.test(n);
  });
  console.log(`\n3. 4+ digit prefix with space: ${numbered4.length}`);
  numbered4.forEach(e => console.log(`   "${(e.canonical_name || e.name).substring(0, 70)}" (${e.country_code}, ${e.parser_id})`));

  // Collect all IDs to flag
  const toFlag = new Map<string, string>();
  for (const e of quebec) toFlag.set(e.id, 'numbered_company:quebec');
  for (const e of listNumbered) toFlag.set(e.id, 'garbage:list_numbered');
  // Don't flag 4-digit entities broadly — some like "1109X" are real
  // Only flag those that are clearly shell corps (4+ digits + province/geographic)
  const shellCorps = numbered4.filter(e => {
    const n = e.canonical_name || e.name;
    // "5656 Estore Management" — real company, keep
    // "8757 Exchange" — could be real, keep
    // Only flag if it looks like a numbered corp: digit + province/LTD/INC
    return /^\d{4,}\s+(Ontario|Alberta|Quebec|Québec|Manitoba|Saskatchewan|B\.?C\.?|British Columbia|Nova Scotia|New Brunswick|Canada|Newfoundland|PEI)/i.test(n);
  });
  console.log(`\n3b. Shell corps (digits + province): ${shellCorps.length}`);
  shellCorps.forEach(e => console.log(`   "${(e.canonical_name || e.name).substring(0, 70)}" (${e.country_code})`));
  for (const e of shellCorps) toFlag.set(e.id, 'numbered_company:province');

  console.log(`\nTotal unique entities to flag: ${toFlag.size}`);

  if (toFlag.size === 0) {
    console.log('Nothing to flag!');
    return;
  }

  // Flag in batches of 100
  const entries = [...toFlag.entries()];
  let flagged = 0;
  for (let i = 0; i < entries.length; i += 100) {
    const batch = entries.slice(i, i + 100);
    const ids = batch.map(([id]) => id);
    const { data, error } = await sb
      .from('entities')
      .update({ is_garbage: true, quality_flags: ['auto_fix_remaining'] })
      .in('id', ids)
      .select('id');
    if (error) console.error('Error:', error.message);
    flagged += data?.length ?? 0;
  }

  console.log(`Flagged: ${flagged} entities`);
}

main();
