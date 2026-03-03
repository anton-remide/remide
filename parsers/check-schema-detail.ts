import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sb = createClient(url, key);

async function main() {
  // Check max id
  const { data: maxRow } = await sb.from('entities').select('id').order('id', { ascending: false }).limit(1);
  console.log('Max entity id:', maxRow?.[0]?.id);

  // Check a sample entity
  const { data: sample } = await sb.from('entities').select('*').limit(1);
  if (sample?.[0]) {
    console.log('\nSample entity keys:', Object.keys(sample[0]));
    console.log('Sample id type:', typeof sample[0].id, '=', sample[0].id);
  }

  // Try insert WITH explicit id
  const testId = 99999;
  const { error: e1 } = await sb.from('entities').insert({
    id: testId,
    name: '__TEST_WITH_ID__',
    country_code: 'XX',
    country: 'Test',
    license_number: 'TEST-ID-001',
    status: 'Licensed',
    license_type: 'Test',
    entity_types: [],
    activities: [],
    regulator: 'Test',
  });
  console.log('\nInsert with explicit id:', e1 ? `ERROR: ${e1.message}` : 'OK!');

  if (!e1) {
    // Clean up
    await sb.from('entities').delete().eq('id', testId);
    console.log('Cleaned up test row');
  }

  // Check if there are entity_types and activities columns with correct types
  const { data: sample2, error: colErr } = await sb.from('entities').select('entity_types, activities').limit(1);
  console.log('\nentity_types/activities columns:', colErr ? `ERROR: ${colErr.message}` : 'OK');
  if (sample2?.[0]) {
    console.log('entity_types value:', JSON.stringify(sample2[0].entity_types));
    console.log('activities value:', JSON.stringify(sample2[0].activities));
  }

  // Try insert with NULL entity_types
  const { error: e2 } = await sb.from('entities').insert({
    id: 99998,
    name: '__TEST_NULL_ARRAYS__',
    country_code: 'XX',
    country: 'Test',
    license_number: 'TEST-NULL-001',
    status: 'Licensed',
  });
  console.log('\nInsert with minimal fields:', e2 ? `ERROR: ${e2.message}` : 'OK!');
  if (!e2) {
    await sb.from('entities').delete().eq('id', 99998);
    console.log('Cleaned up');
  }
}

main().catch(console.error);
