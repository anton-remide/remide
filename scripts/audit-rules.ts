/**
 * COMPREHENSIVE RULES AUDIT
 *
 * Runs detectGarbage() from rules.ts against ALL entities and compares
 * with current DB state. Identifies:
 * 1. Entities the rules WOULD flag but DB says is_garbage=false (MISSED)
 * 2. Entities the rules would NOT flag but DB says is_garbage=true (OVER-FLAGGED)
 * 3. Breakdown by reason
 */
import { createClient } from '@supabase/supabase-js';
import { detectGarbage, cleanName, type QualityInput } from '../workers/quality/rules.js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(
  process.env.VITE_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

async function main() {
  console.log('=== QUALITY RULES AUDIT ===\n');
  console.log('Fetching all entities...');

  let all: any[] = [];
  let from = 0;
  while (true) {
    const { data } = await sb
      .from('entities')
      .select('id, name, canonical_name, country_code, parser_id, license_type, license_number, entity_types, activities, status, regulator, website, description, linkedin_url, crypto_status, is_garbage, quality_score')
      .range(from, from + 999);
    if (!data || data.length === 0) break;
    all.push(...data);
    from += 1000;
    if (data.length < 1000) break;
  }

  console.log(`Total entities: ${all.length}`);
  console.log(`Currently garbage: ${all.filter(e => e.is_garbage).length}`);
  console.log(`Currently clean: ${all.filter(e => !e.is_garbage).length}\n`);

  // Run rules on every entity
  const missed: { entity: any; reason: string }[] = [];
  const overFlagged: { entity: any }[] = [];
  const correctlyFlagged: Map<string, number> = new Map();
  const correctlyClean = { count: 0 };

  for (const e of all) {
    // Use canonical_name if available, fall back to name (same as worker does)
    const nameToCheck = e.canonical_name || e.name;
    const input: QualityInput = {
      ...e,
      name: nameToCheck,
      entity_types: e.entity_types ?? [],
      activities: e.activities ?? [],
    };

    const result = detectGarbage(input);

    if (result.isGarbage && !e.is_garbage) {
      // Rules say garbage, DB says clean → MISSED
      missed.push({ entity: e, reason: result.reason! });
    } else if (!result.isGarbage && e.is_garbage) {
      // Rules say clean, DB says garbage → OVER-FLAGGED (by direct DB fix, not rules)
      overFlagged.push({ entity: e });
    } else if (result.isGarbage && e.is_garbage) {
      // Correctly flagged
      const r = result.reason!.split(':')[0];
      correctlyFlagged.set(r, (correctlyFlagged.get(r) || 0) + 1);
    } else {
      correctlyClean.count++;
    }
  }

  // Report MISSED
  console.log(`\n═══ MISSED (rules would flag, DB says clean): ${missed.length} ═══`);
  const byReason = new Map<string, typeof missed>();
  for (const m of missed) {
    const r = m.reason;
    if (!byReason.has(r)) byReason.set(r, []);
    byReason.get(r)!.push(m);
  }
  for (const [reason, entities] of [...byReason.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n  [${reason}] — ${entities.length} entities`);
    entities.slice(0, 5).forEach(m => {
      const n = m.entity.canonical_name || m.entity.name;
      console.log(`    "${n.substring(0, 60)}" (${m.entity.country_code}, ${m.entity.parser_id})`);
    });
    if (entities.length > 5) console.log(`    ... and ${entities.length - 5} more`);
  }

  // Report OVER-FLAGGED
  console.log(`\n═══ OVER-FLAGGED (rules say clean, DB says garbage): ${overFlagged.length} ═══`);
  overFlagged.slice(0, 20).forEach(o => {
    const n = o.entity.canonical_name || o.entity.name;
    console.log(`  "${n.substring(0, 60)}" (${o.entity.country_code}, ${o.entity.parser_id})`);
  });
  if (overFlagged.length > 20) console.log(`  ... and ${overFlagged.length - 20} more`);

  // Summary
  console.log(`\n═══ SUMMARY ═══`);
  console.log(`Total entities:     ${all.length}`);
  console.log(`Correctly clean:    ${correctlyClean.count}`);
  console.log(`Correctly flagged:  ${[...correctlyFlagged.values()].reduce((a, b) => a + b, 0)}`);
  console.log(`MISSED by rules:    ${missed.length} ⚠️`);
  console.log(`OVER-FLAGGED:       ${overFlagged.length} ⚠️`);
  console.log(`\nCorrectly flagged by reason:`);
  for (const [r, n] of [...correctlyFlagged.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${r}: ${n}`);
  }

  console.log(`\n═══ VERDICT ═══`);
  if (missed.length === 0) {
    console.log('✅ ALL garbage entities would be caught by rules.ts on next worker run');
  } else {
    console.log(`⚠️  ${missed.length} entities would NOT be caught — rules.ts needs updates!`);
  }
  if (overFlagged.length > 0) {
    console.log(`⚠️  ${overFlagged.length} entities were manually flagged but rules wouldn't catch them`);
    console.log(`   These will be UN-FLAGGED on next worker run unless rules are updated!`);
  }
}

main();
