/**
 * Quick fix: flag insurance entities as garbage.
 * Insurance is OUT OF SCOPE for RemiDe (see MEMORY.md).
 *
 * Run: npx tsx scripts/fix-insurance.ts
 */
import { getSupabase } from '../shared/supabase.js';

async function main() {
  const sb = getSupabase();
  const now = new Date().toISOString();

  // Find all entities with "Insurance" in activities (case-insensitive check)
  // PRA entities store activity as ["Insurance"] or ["Insurance - UK Branch"]
  const PAGE = 1000;
  const all: { id: string; name: string; activities: string[]; parser_id: string | null; is_garbage: boolean }[] = [];
  let from = 0;
  let done = false;

  while (!done) {
    const { data, error } = await sb
      .from('entities')
      .select('id, name, activities, parser_id, is_garbage')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Fetch error: ${error.message}`);
    const rows = data ?? [];
    all.push(...(rows as typeof all));
    if (rows.length < PAGE) done = true;
    else from += PAGE;
  }

  // Filter: entities where ANY activity contains "insurance" (case insensitive)
  const insurance = all.filter(e =>
    !e.is_garbage &&
    (e.activities ?? []).some(a => a.toLowerCase().includes('insurance'))
  );

  console.log(`Total entities: ${all.length}`);
  console.log(`Insurance entities (non-garbage): ${insurance.length}`);

  // Also flag entities where name contains "insurance" and they're from PRA
  const insuranceByName = all.filter(e =>
    !e.is_garbage &&
    e.parser_id === 'gb-pra' &&
    e.name.toLowerCase().includes('insurance') &&
    !insurance.some(ie => ie.id === e.id) // Don't double count
  );

  console.log(`Additional PRA entities with "insurance" in name: ${insuranceByName.length}`);

  const toUpdate = [...insurance, ...insuranceByName];
  console.log(`\nTotal to flag as garbage: ${toUpdate.length}`);
  toUpdate.slice(0, 10).forEach(e => console.log(`  [${e.parser_id}] ${e.name}`));

  if (toUpdate.length === 0) {
    console.log('Nothing to update.');
    return;
  }

  // Update
  let updated = 0;
  for (const entity of toUpdate) {
    const { error } = await sb.from('entities').update({
      is_garbage: true,
      quality_flags: {
        rules: ['garbage:out_of_scope_insurance'],
        garbage_reason: 'out_of_scope_insurance',
        tier: 'T1',
        cleanup_applied: [],
      },
      last_quality_at: now,
    }).eq('id', entity.id);

    if (error) {
      console.error(`Error: ${entity.id}: ${error.message}`);
    } else {
      updated++;
    }
  }

  console.log(`\nDone: ${updated}/${toUpdate.length} insurance entities flagged as garbage.`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
