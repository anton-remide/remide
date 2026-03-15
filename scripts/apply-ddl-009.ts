/**
 * Apply DDL 009: user_profiles table for Stripe payments
 * Run: npx tsx scripts/apply-ddl-009.ts
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);
const ddl = readFileSync(join(import.meta.dirname, '009_stripe_payments.sql'), 'utf8');

async function main() {
  console.log('Applying DDL 009: user_profiles + Stripe payments...');

  // Split by semicolons, filter empty, execute each statement
  const statements = ddl
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const stmt of statements) {
    const preview = stmt.substring(0, 80).replace(/\n/g, ' ');
    console.log(`  → ${preview}...`);

    const { error } = await supabase.rpc('exec_sql', { sql: stmt + ';' }).single();
    if (error) {
      // Try direct query if exec_sql doesn't exist
      console.warn(`    ⚠ exec_sql failed: ${error.message}`);
      console.log('    → Paste this DDL into Supabase SQL Editor manually');
    }
  }

  // Verify
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, subscription_tier')
    .limit(5);

  if (error) {
    console.log('\n⚠ Table may not exist yet. Apply DDL via Supabase SQL Editor:');
    console.log('  → Copy scripts/009_stripe_payments.sql → Supabase Dashboard → SQL Editor → Run');
  } else {
    console.log(`\n✅ user_profiles table exists. ${data.length} profiles found.`);
  }
}

main().catch(console.error);
