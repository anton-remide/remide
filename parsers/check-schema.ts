/**
 * Quick script to verify Supabase schema is ready for parsers.
 * Usage: npx tsx parsers/check-schema.ts
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || 'https://cydzgjrvcclkigcizddc.supabase.co';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!key) {
  console.error('No Supabase key found');
  process.exit(1);
}

const sb = createClient(url, key);

async function main() {
  // 1. Check entities count
  const { count, error: entErr } = await sb
    .from('entities')
    .select('*', { count: 'exact', head: true });
  console.log(`✓ entities table: ${count} rows`, entErr ? `ERROR: ${entErr.message}` : '');

  // 2. Check parser-specific columns exist
  const { data: sample, error: colErr } = await sb
    .from('entities')
    .select('parser_id, parsed_at, source_url, entity_types, activities, raw_data')
    .limit(1);

  if (colErr) {
    console.log('✗ Parser columns missing:', colErr.message);
    console.log('  → Need to run migration: parsers/migrations/001_parser_schema.sql');
  } else {
    console.log('✓ Parser columns exist');
  }

  // 3. Check scrape_runs table
  const { count: srCount, error: srErr } = await sb
    .from('scrape_runs')
    .select('*', { count: 'exact', head: true });

  if (srErr) {
    console.log('✗ scrape_runs table missing:', srErr.message);
    console.log('  → Need to run migration: parsers/migrations/001_parser_schema.sql');
  } else {
    console.log(`✓ scrape_runs table: ${srCount} rows`);
  }

  // 4. Check verification_runs table
  const { count: vrCount, error: vrErr } = await sb
    .from('verification_runs')
    .select('*', { count: 'exact', head: true });

  if (vrErr) {
    console.log('✗ verification_runs table missing:', vrErr.message);
  } else {
    console.log(`✓ verification_runs table: ${vrCount} rows`);
  }

  // 5. Check unique constraint
  const { data: _test, error: upsertErr } = await sb
    .from('entities')
    .upsert(
      {
        name: '__SCHEMA_CHECK_TEST__',
        country_code: 'XX',
        country: 'Test',
        license_number: 'TEST-SCHEMA-CHECK',
        parser_id: 'schema-check',
      },
      { onConflict: 'license_number,country_code' }
    )
    .select();

  if (upsertErr) {
    console.log('✗ Upsert constraint issue:', upsertErr.message);
  } else {
    console.log('✓ Upsert constraint works');
    // Clean up
    await sb.from('entities').delete().eq('license_number', 'TEST-SCHEMA-CHECK').eq('country_code', 'XX');
  }
}

main().catch(console.error);
