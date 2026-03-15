/**
 * Quick fix: flag numbered companies as garbage in Supabase.
 * These are entities like "1000224522 ONTARIO INC." from FINTRAC —
 * legitimate registrations but useless shell corps for display.
 *
 * Run: npx tsx scripts/fix-numbered-companies.ts
 */
import { getSupabase } from '../shared/supabase.js';

async function main() {
  const sb = getSupabase();

  // Fetch all entities (paginated)
  const PAGE = 1000;
  const all: { id: string; name: string }[] = [];
  let from = 0;
  let done = false;

  while (!done) {
    const { data, error } = await sb
      .from('entities')
      .select('id, name')
      .range(from, from + PAGE - 1);

    if (error) throw new Error(`Fetch error: ${error.message}`);
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < PAGE) done = true;
    else from += PAGE;
  }

  console.log(`Total entities: ${all.length}`);

  // Filter: 6+ leading digits followed by a letter
  const numbered = all.filter(e => /^\d{6,}\s+[A-Za-z]/.test(e.name));
  console.log(`Numbered companies found: ${numbered.length}`);
  numbered.slice(0, 10).forEach(e => console.log(`  ${e.name}`));

  if (numbered.length === 0) {
    console.log('Nothing to update.');
    return;
  }

  // Update them as garbage
  let updated = 0;
  const now = new Date().toISOString();

  for (const entity of numbered) {
    const { error } = await sb.from('entities').update({
      is_garbage: true,
      quality_flags: {
        rules: ['garbage:numbered_company'],
        garbage_reason: 'numbered_company',
        tier: 'T1',
        cleanup_applied: [],
      },
      last_quality_at: now,
    }).eq('id', entity.id);

    if (error) {
      console.error(`Error updating ${entity.id}: ${error.message}`);
    } else {
      updated++;
    }
  }

  console.log(`\nDone: ${updated}/${numbered.length} entities flagged as garbage.`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
