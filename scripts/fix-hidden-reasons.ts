/**
 * Fix hidden_reason for all entities that are is_hidden=true but missing hidden_reason.
 * Maps license_type to the correct reason code.
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const REASON_MAP: Record<string, string> = {
  'E-Money Payment Institution (EPI)': 'epi_micro',
  'Exempt EMI': 'exempt_emi',
  'Entity National Law': 'enl_national',
};

async function fix() {
  console.log('Fixing hidden_reason for entities missing it...\n');

  for (const [licenseType, reason] of Object.entries(REASON_MAP)) {
    // Count missing
    const { count: missing } = await sb.from('entities')
      .select('*', { count: 'exact', head: true })
      .eq('license_type', licenseType)
      .eq('is_hidden', true)
      .is('hidden_reason', null);

    if (!missing || missing === 0) {
      console.log(`${licenseType}: ✅ All already have hidden_reason`);
      continue;
    }

    console.log(`${licenseType}: ${missing} missing hidden_reason → setting to '${reason}'`);

    // Fix in batches
    const { error } = await sb.from('entities')
      .update({ hidden_reason: reason })
      .eq('license_type', licenseType)
      .eq('is_hidden', true)
      .is('hidden_reason', null);

    if (error) {
      console.error(`  ❌ Error: ${error.message}`);
    } else {
      // Verify
      const { count: remaining } = await sb.from('entities')
        .select('*', { count: 'exact', head: true })
        .eq('license_type', licenseType)
        .eq('is_hidden', true)
        .is('hidden_reason', null);
      console.log(`  ✅ Done. Remaining without reason: ${remaining}`);
    }
  }

  // Final tally
  console.log('\n=== Final State ===');
  const { count: totalHidden } = await sb.from('entities')
    .select('*', { count: 'exact', head: true })
    .eq('is_hidden', true);
  const { count: withReason } = await sb.from('entities')
    .select('*', { count: 'exact', head: true })
    .eq('is_hidden', true)
    .not('hidden_reason', 'is', null);
  const { count: noReason } = await sb.from('entities')
    .select('*', { count: 'exact', head: true })
    .eq('is_hidden', true)
    .is('hidden_reason', null);
  console.log(`Total hidden: ${totalHidden}`);
  console.log(`With reason: ${withReason}`);
  console.log(`Without reason: ${noReason}`);
}

fix().catch(console.error);
