import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Missing env vars'); process.exit(1); }

const sb = createClient(url, key);

async function main() {
  // Check distinct status values
  const { data: statuses } = await sb.from('entities').select('status').limit(1000);
  if (statuses) {
    const unique = [...new Set(statuses.map((s: any) => s.status))];
    console.log('Distinct status values:', unique);
  }

  // Check distinct country_code values and counts
  const { data: entities } = await sb.from('entities').select('country_code, status, license_type, regulator').limit(1000);
  if (entities) {
    const counts: Record<string, number> = {};
    entities.forEach((e: any) => { counts[e.country_code] = (counts[e.country_code] || 0) + 1; });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    console.log('\nEntities by country (top 20):');
    sorted.slice(0, 20).forEach(([c, n]) => console.log(`  ${c}: ${n}`));
    console.log(`\nTotal countries: ${Object.keys(counts).length}, Total entities: ${entities.length}`);
  }

  // Check scrape_runs table
  const { error: srErr } = await sb.from('scrape_runs').select('id').limit(1);
  console.log('\nscrape_runs table:', srErr ? `ERROR: ${srErr.message}` : 'OK');

  // Check verification_runs table
  const { error: vrErr } = await sb.from('verification_runs').select('id').limit(1);
  console.log('verification_runs table:', vrErr ? `ERROR: ${vrErr.message}` : 'OK');

  // Try inserting with different status values to find what works
  const testStatuses = ['authorized', 'Authorized', 'active', 'Active', 'licensed', 'Licensed', 'registered', 'Registered'];
  for (const testStatus of testStatuses) {
    const { error } = await sb.from('entities').insert({
      name: '__TEST__',
      country_code: 'XX',
      country: 'Test',
      license_number: `TEST-${testStatus}`,
      status: testStatus,
    });
    if (!error) {
      console.log(`\nStatus "${testStatus}" WORKS!`);
      // Delete test row
      await sb.from('entities').delete().eq('license_number', `TEST-${testStatus}`);
    } else if (error.message.includes('enum')) {
      console.log(`Status "${testStatus}" → enum error`);
    } else {
      console.log(`Status "${testStatus}" → ${error.message}`);
    }
  }
}

main().catch(console.error);
