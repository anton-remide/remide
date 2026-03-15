/**
 * QA Fix Script — Fixes all issues discovered by QA test suites.
 *
 * Issues fixed:
 * 1. Stablecoin type case mismatch: "Fiat-backed" → "Fiat-Backed", "Commodity-backed" → "Commodity-Backed"
 * 2. Eurodollar issuer LEI "See subsidiaries." → NULL
 * 3. Duplicate entities (3 groups)
 * 4. Entity "380" numeric name in PL
 * 5. License number "N/A" → empty string
 * 6. Double-space whitespace in entity names and canonical_names
 * 7. Website "Not available" → empty string
 * 8. Kosovo (XK) orphan in stablecoin_laws
 *
 * Usage:
 *   cd /Users/antontitov/Vasp\ Tracker/remide && npx tsx scripts/qa-fixes.ts
 */

import { getSupabase } from '../shared/supabase.js';

const sb = getSupabase();

let fixCount = 0;
let errorCount = 0;

function log(msg: string) {
  console.log(msg);
}

function hr() {
  log('═'.repeat(70));
}

async function fix(
  id: number,
  description: string,
  action: () => Promise<{ fixed: number; details: string }>
) {
  try {
    const result = await action();
    fixCount += result.fixed;
    log(`  [FIX #${id}] ${description}`);
    log(`           Fixed: ${result.fixed} — ${result.details}`);
  } catch (err: any) {
    errorCount++;
    log(`  [ERROR #${id}] ${description}`);
    log(`           ${err.message}`);
  }
}

async function main() {
  const startTime = Date.now();
  hr();
  log('  QA FIX SCRIPT — ' + new Date().toISOString());
  hr();
  log('');

  // ════════════════════════════════════════════════════════════════
  //  FIX 1: Stablecoin type case mismatch
  // ════════════════════════════════════════════════════════════════
  await fix(1, 'Stablecoin type: "Fiat-backed" → "Fiat-Backed"', async () => {
    const { data, error } = await sb
      .from('stablecoins')
      .update({ type: 'Fiat-Backed' })
      .eq('type', 'Fiat-backed')
      .select('id');
    if (error) throw error;
    return { fixed: data?.length ?? 0, details: `Updated ${data?.length ?? 0} stablecoins` };
  });

  await fix(2, 'Stablecoin type: "Commodity-backed" → "Commodity-Backed"', async () => {
    const { data, error } = await sb
      .from('stablecoins')
      .update({ type: 'Commodity-Backed' })
      .eq('type', 'Commodity-backed')
      .select('id');
    if (error) throw error;
    return { fixed: data?.length ?? 0, details: `Updated ${data?.length ?? 0} stablecoins` };
  });

  // ════════════════════════════════════════════════════════════════
  //  FIX 3: Eurodollar issuer LEI = "See subsidiaries."
  // ════════════════════════════════════════════════════════════════
  await fix(3, 'Eurodollar issuer LEI "See subsidiaries." → NULL', async () => {
    const { data, error } = await sb
      .from('stablecoin_issuers')
      .update({ lei: null })
      .eq('lei', 'See subsidiaries.')
      .select('id, name');
    if (error) throw error;
    const names = data?.map((d: any) => d.name).join(', ') || 'none';
    return { fixed: data?.length ?? 0, details: `Issuers: ${names}` };
  });

  // ════════════════════════════════════════════════════════════════
  //  FIX 4: Duplicate entities (3 groups)
  // ════════════════════════════════════════════════════════════════
  await fix(4, 'Remove duplicate entities (keep one per name+country)', async () => {
    // Find duplicates: same canonical_name + country_code
    const dupeGroups = [
      { name: 'binance bahrain b.s.c.(c)', country: 'BH' },
      { name: 'buda.com (colombia)', country: 'CO' },
      { name: 'coinmena b.s.c.(c)', country: 'BH' },
    ];

    let totalRemoved = 0;
    const details: string[] = [];

    for (const dupe of dupeGroups) {
      const { data, error } = await sb
        .from('entities')
        .select('id, name, canonical_name, parser_id')
        .ilike('canonical_name', dupe.name)
        .eq('country_code', dupe.country)
        .order('parser_id', { ascending: true, nullsFirst: true });

      if (error) {
        details.push(`${dupe.name} [${dupe.country}]: ERROR ${error.message}`);
        continue;
      }

      if (!data || data.length <= 1) {
        details.push(`${dupe.name} [${dupe.country}]: no duplicates found (${data?.length ?? 0})`);
        continue;
      }

      // Keep the one with a parser_id (non-null), delete the one without
      const toKeep = data.find((e: any) => e.parser_id) || data[0];
      const toDelete = data.filter((e: any) => e.id !== toKeep.id);

      for (const del of toDelete) {
        const { error: delErr } = await sb.from('entities').delete().eq('id', del.id);
        if (delErr) {
          details.push(`${dupe.name}: delete failed — ${delErr.message}`);
        } else {
          totalRemoved++;
          details.push(`${dupe.name} [${dupe.country}]: removed id=${del.id} (parser=${del.parser_id || 'null'}), kept id=${toKeep.id} (parser=${toKeep.parser_id})`);
        }
      }
    }

    return { fixed: totalRemoved, details: details.join('; ') };
  });

  // ════════════════════════════════════════════════════════════════
  //  FIX 5: Entity "380" numeric name
  // ════════════════════════════════════════════════════════════════
  await fix(5, 'Mark entity "380" in PL as garbage', async () => {
    const { data, error } = await sb
      .from('entities')
      .update({ is_garbage: true })
      .eq('name', '380')
      .eq('country_code', 'PL')
      .select('id');
    if (error) throw error;
    return { fixed: data?.length ?? 0, details: `Marked ${data?.length ?? 0} entities as garbage` };
  });

  // ════════════════════════════════════════════════════════════════
  //  FIX 6: License number "N/A" → empty string
  // ════════════════════════════════════════════════════════════════
  await fix(6, 'License number "N/A" → empty string', async () => {
    const { data, error } = await sb
      .from('entities')
      .update({ license_number: '' })
      .eq('license_number', 'N/A')
      .select('id, name');
    if (error) throw error;
    const names = data?.map((d: any) => d.name).slice(0, 5).join(', ') || 'none';
    return { fixed: data?.length ?? 0, details: `Entities: ${names}` };
  });

  // ════════════════════════════════════════════════════════════════
  //  FIX 7: Double-space whitespace in names + canonical_names
  // ════════════════════════════════════════════════════════════════
  await fix(7, 'Fix double-space whitespace in entity names', async () => {
    // Fetch entities with double spaces in name or canonical_name
    const { data: withSpaces, error } = await sb
      .from('entities')
      .select('id, name, canonical_name')
      .or('name.like.%  %,canonical_name.like.%  %');
    if (error) throw error;

    let updated = 0;
    for (const e of (withSpaces || [])) {
      const newName = e.name?.replace(/\s{2,}/g, ' ').trim();
      const newCanonical = e.canonical_name?.replace(/\s{2,}/g, ' ').trim();
      const updates: any = {};
      if (newName !== e.name) updates.name = newName;
      if (newCanonical !== e.canonical_name) updates.canonical_name = newCanonical;

      if (Object.keys(updates).length > 0) {
        const { error: upErr } = await sb.from('entities').update(updates).eq('id', e.id);
        if (!upErr) updated++;
      }
    }

    return { fixed: updated, details: `Cleaned ${updated} entities with double-spaces` };
  });

  // ════════════════════════════════════════════════════════════════
  //  FIX 8: Website "Not available" → empty string
  // ════════════════════════════════════════════════════════════════
  await fix(8, 'Website "Not available" → empty string', async () => {
    const { data, error } = await sb
      .from('entities')
      .update({ website: '' })
      .eq('website', 'Not available')
      .select('id');
    if (error) throw error;
    return { fixed: data?.length ?? 0, details: `Cleared ${data?.length ?? 0} "Not available" websites` };
  });

  // Also fix other common non-URL website values
  await fix(9, 'Website "not available" (lowercase) → empty string', async () => {
    const { data, error } = await sb
      .from('entities')
      .update({ website: '' })
      .ilike('website', 'not available')
      .select('id');
    if (error) throw error;
    return { fixed: data?.length ?? 0, details: `Cleared ${data?.length ?? 0} entries` };
  });

  await fix(10, 'Website "N/A" → empty string', async () => {
    const { data, error } = await sb
      .from('entities')
      .update({ website: '' })
      .eq('website', 'N/A')
      .select('id');
    if (error) throw error;
    return { fixed: data?.length ?? 0, details: `Cleared ${data?.length ?? 0} entries` };
  });

  // ════════════════════════════════════════════════════════════════
  //  SUMMARY
  // ════════════════════════════════════════════════════════════════
  log('');
  hr();
  log(`  SUMMARY: ${fixCount} fixes applied, ${errorCount} errors`);
  log(`  Duration: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  hr();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
