/**
 * Quick stats script — counts entities by country, registry, license type, status
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) { console.error('Missing SUPABASE env vars'); process.exit(1); }

const sb = createClient(url, key);

async function main() {
  // Total entities
  const { count: totalEntities } = await sb.from('entities').select('*', { count: 'exact', head: true });
  console.log(`\n${'='.repeat(70)}`);
  console.log(`  REMIDE DATABASE REPORT — ${new Date().toISOString().split('T')[0]}`);
  console.log(`${'='.repeat(70)}`);
  console.log(`\n  TOTAL ENTITIES: ${totalEntities}\n`);

  // Fetch all entities in batches (Supabase limit = 1000)
  type Row = { country_code: string; parser_id: string; license_type: string; status: string };
  const allEntities: Row[] = [];
  let offset = 0;
  const batchSize = 1000;
  while (true) {
    const { data, error } = await sb.from('entities').select('country_code, parser_id, license_type, status').range(offset, offset + batchSize - 1);
    if (error) { console.error('Query error:', error.message); break; }
    if (!data || data.length === 0) break;
    allEntities.push(...(data as Row[]));
    offset += data.length;
    if (data.length < batchSize) break;
  }
  if (allEntities.length === 0) { console.error('No data fetched. Check RLS policies or service role key.'); return; }
  console.log(`  (fetched ${allEntities.length} rows)\n`);

  const countryMap: Record<string, number> = {};
  const sourceMap: Record<string, number> = {};
  const typeMap: Record<string, number> = {};
  const statusMap: Record<string, number> = {};

  for (const e of allEntities) {
    countryMap[e.country_code || '??'] = (countryMap[e.country_code || '??'] || 0) + 1;
    sourceMap[e.parser_id || 'unknown'] = (sourceMap[e.parser_id || 'unknown'] || 0) + 1;
    typeMap[e.license_type || 'Unknown'] = (typeMap[e.license_type || 'Unknown'] || 0) + 1;
    statusMap[e.status || 'Unknown'] = (statusMap[e.status || 'Unknown'] || 0) + 1;
  }

  // Countries
  const sortedCountries = Object.entries(countryMap).sort((a, b) => b[1] - a[1]);
  console.log(`  ENTITIES BY COUNTRY (${sortedCountries.length} countries):`);
  console.log(`  ${'Code'.padEnd(6)}${'Count'.padStart(7)}  ${'Bar'}`);
  console.log(`  ${'─'.repeat(50)}`);
  const maxCount = sortedCountries[0]?.[1] || 1;
  for (const [code, count] of sortedCountries) {
    const bar = '█'.repeat(Math.max(1, Math.round((count / maxCount) * 30)));
    console.log(`  ${code.padEnd(6)}${String(count).padStart(7)}  ${bar}`);
  }

  // Source registries
  console.log(`\n  ENTITIES BY SOURCE REGISTRY (${Object.keys(sourceMap).length} registries):`);
  console.log(`  ${'Registry'.padEnd(22)}${'Count'.padStart(7)}`);
  console.log(`  ${'─'.repeat(50)}`);
  const sortedSources = Object.entries(sourceMap).sort((a, b) => b[1] - a[1]);
  for (const [src, count] of sortedSources) {
    console.log(`  ${src.padEnd(22)}${String(count).padStart(7)}`);
  }

  // License types (top 25)
  console.log(`\n  TOP LICENSE TYPES (${Object.keys(typeMap).length} total):`);
  console.log(`  ${'Type'.padEnd(42)}${'Count'.padStart(7)}`);
  console.log(`  ${'─'.repeat(50)}`);
  const sortedTypes = Object.entries(typeMap).sort((a, b) => b[1] - a[1]);
  for (const [type, count] of sortedTypes.slice(0, 25)) {
    console.log(`  ${type.substring(0, 40).padEnd(42)}${String(count).padStart(7)}`);
  }

  // Status
  console.log(`\n  ENTITIES BY STATUS:`);
  console.log(`  ${'─'.repeat(50)}`);
  const sortedStatus = Object.entries(statusMap).sort((a, b) => b[1] - a[1]);
  for (const [status, count] of sortedStatus) {
    console.log(`  ${status.padEnd(30)}${String(count).padStart(7)}`);
  }

  console.log(`\n${'='.repeat(70)}\n`);
}

main().catch(console.error);
