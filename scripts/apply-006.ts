/**
 * Apply DDL 006: Entity Categorization
 * Adds sector + crypto_related columns, then classifies all entities by parser_id
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
if (url === undefined || key === undefined) { console.error('Missing env'); process.exit(1); }

const sb = createClient(url, key);

// Parser → Sector mapping
const CRYPTO_PARSERS = [
  'esma-de', 'esma-nl', 'esma-fr', 'esma-es', 'esma-it', 'esma-at',
  'esma-cz', 'esma-fi', 'esma-ie', 'esma-lt', 'esma-lu', 'esma-lv',
  'esma-mt', 'esma-pl', 'esma-sk', 'esma-si', 'esma-cy', 'esma-bg',
  'esma-se', 'esma-be', 'esma-hr', 'esma-pt', 'esma-ro', 'esma-hu',
  'esma-gr', 'esma-ee', 'esma-dk', 'esma-li', 'esma-no', 'esma-is',
  'au-austrac', 'ca-fintrac', 'jp-jfsa', 'sg-mas',
  'ch-finma', 'us-fincen', 'ae-vara', 'ae-adgm', 'ae-dfsareg',
  'za-fsca', 'ng-sec', 'ke-cma', 'bm-bma',
  'th-sec', 'my-sc', 'sc-fsa', 'gi-gfsc', 'im-fsa',
  'li-fma', 'tw-fsc', 'ky-cima', 'id-ojk',
  'hk-sfc', 'kr-fiu', 'br-bcb', 'ar-cnv', 'ph-bsp', 'sv-cnad',
  'us-nydfs',
];

const BANKING_PARSERS = ['us-fdic', 'gb-pra'];

// EBA parsers are identified by prefix 'eba-'

async function main() {
  // Step 1: Check if sector column already exists
  const { error: checkErr } = await sb.from('entities').select('sector').limit(1);
  if (checkErr) {
    console.log('❌ sector column does not exist yet.');
    console.log('Please run this SQL in Supabase Dashboard → SQL Editor:\n');
    console.log('ALTER TABLE entities ADD COLUMN IF NOT EXISTS sector TEXT;');
    console.log('ALTER TABLE entities ADD COLUMN IF NOT EXISTS crypto_related BOOLEAN DEFAULT false;');
    console.log('CREATE INDEX IF NOT EXISTS idx_entities_sector ON entities(sector);');
    console.log('CREATE INDEX IF NOT EXISTS idx_entities_crypto_related ON entities(crypto_related);');
    console.log('\nThen re-run this script to populate the data.');
    process.exit(1);
  }
  console.log('✅ sector column exists');

  // Step 2: Classify Crypto entities
  console.log('\n--- Classifying Crypto entities ---');
  let cryptoTotal = 0;
  for (const pid of CRYPTO_PARSERS) {
    const { count, error } = await sb
      .from('entities')
      .update({ sector: 'Crypto', crypto_related: true })
      .eq('parser_id', pid)
      .select('id', { count: 'exact', head: true });
    if (error) {
      console.log(`  ⚠️ ${pid}: ${error.message}`);
    } else {
      if (count && count > 0) {
        console.log(`  ✅ ${pid}: ${count} → Crypto`);
        cryptoTotal += count;
      }
    }
  }
  console.log(`Crypto total: ${cryptoTotal}`);

  // Step 3: Classify Banking entities
  console.log('\n--- Classifying Banking entities ---');
  let bankingTotal = 0;
  for (const pid of BANKING_PARSERS) {
    const { count, error } = await sb
      .from('entities')
      .update({ sector: 'Banking', crypto_related: false })
      .eq('parser_id', pid)
      .select('id', { count: 'exact', head: true });
    if (error) {
      console.log(`  ⚠️ ${pid}: ${error.message}`);
    } else {
      if (count && count > 0) {
        console.log(`  ✅ ${pid}: ${count} → Banking`);
        bankingTotal += count;
      }
    }
  }
  console.log(`Banking total: ${bankingTotal}`);

  // Step 4: Classify Payments (EBA) entities — match parser_id LIKE 'eba-%'
  console.log('\n--- Classifying Payments (EBA) entities ---');
  const { count: ebaCount, error: ebaErr } = await sb
    .from('entities')
    .update({ sector: 'Payments', crypto_related: false })
    .like('parser_id', 'eba-%')
    .select('id', { count: 'exact', head: true });
  if (ebaErr) {
    console.log(`  ⚠️ eba-*: ${ebaErr.message}`);
  } else {
    console.log(`  ✅ eba-*: ${ebaCount} → Payments`);
  }

  // Step 5: Catch-all remaining NULL sectors → Crypto
  console.log('\n--- Catch-all: remaining NULL → Crypto ---');
  const { count: nullCount, error: nullErr } = await sb
    .from('entities')
    .update({ sector: 'Crypto', crypto_related: true })
    .is('sector', null)
    .select('id', { count: 'exact', head: true });
  if (nullErr) {
    console.log(`  ⚠️ null catch-all: ${nullErr.message}`);
  } else {
    console.log(`  ✅ Remaining null: ${nullCount} → Crypto`);
  }

  // Step 6: Summary
  console.log('\n=== SUMMARY ===');
  const totals: Record<string, number> = {};
  for (const sector of ['Crypto', 'Payments', 'Banking']) {
    const { count } = await sb
      .from('entities')
      .select('id', { count: 'exact', head: true })
      .eq('sector', sector);
    totals[sector] = count || 0;
    console.log(`${sector}: ${count}`);
  }

  const { count: cryptoRelCount } = await sb
    .from('entities')
    .select('id', { count: 'exact', head: true })
    .eq('crypto_related', true);
  console.log(`crypto_related=true: ${cryptoRelCount}`);

  const { count: stillNull } = await sb
    .from('entities')
    .select('id', { count: 'exact', head: true })
    .is('sector', null);
  console.log(`Still NULL sector: ${stillNull}`);

  console.log(`\nTotal classified: ${Object.values(totals).reduce((a, b) => a + b, 0)}`);
}

main().catch(console.error);
