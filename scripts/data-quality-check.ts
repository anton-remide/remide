/**
 * Data quality analysis script.
 * Analyzes entity data completeness and identifies gaps.
 *
 * Usage: npx tsx scripts/data-quality-check.ts
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, '../.env.local') });

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('❌ Missing env vars');
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

interface EntityRow {
  id: string;
  name: string;
  country_code: string;
  country: string;
  license_number: string;
  license_type: string;
  entity_types: string[];
  activities: string[];
  status: string;
  regulator: string;
  website: string;
  description: string;
  registry_url: string;
  linkedin_url: string;
  raw_data: Record<string, unknown> | null;
}

interface JurisdictionRow {
  code: string;
  name: string;
  regime: string;
  entity_count: number;
  regulator: string;
  travel_rule: string;
}

async function analyze() {
  console.log('\n═══════════════════════════════════════');
  console.log('  RemiDe Data Quality Report');
  console.log('═══════════════════════════════════════\n');

  // ── 1. Entity counts ──
  const { count: totalEntities } = await supabase
    .from('entities')
    .select('*', { count: 'exact', head: true });

  const { count: totalJurisdictions } = await supabase
    .from('jurisdictions')
    .select('*', { count: 'exact', head: true });

  console.log(`📊 Overview:`);
  console.log(`  Total entities:      ${totalEntities}`);
  console.log(`  Total jurisdictions: ${totalJurisdictions}`);

  // ── 2. Entities by country ──
  const allEntities: EntityRow[] = [];
  let from = 0;
  const PAGE = 1000;
  let done = false;
  while (!done) {
    const { data, error } = await supabase
      .from('entities')
      .select('*')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    allEntities.push(...(data as EntityRow[]));
    if ((data as EntityRow[]).length < PAGE) done = true;
    else from += PAGE;
  }

  console.log(`\n  Fetched ${allEntities.length} entities for analysis`);

  const countryMap = new Map<string, { count: number; name: string }>();
  allEntities.forEach((e) => {
    const existing = countryMap.get(e.country_code) || { count: 0, name: e.country };
    existing.count++;
    countryMap.set(e.country_code, existing);
  });

  const sorted = [...countryMap.entries()].sort((a, b) => b[1].count - a[1].count);
  console.log(`\n🌍 Top 20 countries by entity count:`);
  sorted.slice(0, 20).forEach(([code, d]) => {
    console.log(`  ${code} (${d.name}): ${d.count}`);
  });
  console.log(`  ... ${sorted.length} countries with entities total`);

  // ── 3. Countries WITHOUT entities ──
  const { data: jurisdictions } = await supabase
    .from('jurisdictions')
    .select('code, name, regime, entity_count, regulator, travel_rule')
    .order('entity_count', { ascending: false });

  const allJ = (jurisdictions ?? []) as JurisdictionRow[];
  const withEntities = new Set(sorted.map(([code]) => code));
  const withoutEntities = allJ.filter((j) => !withEntities.has(j.code));

  console.log(`\n🔴 Countries WITHOUT entities (${withoutEntities.length}):`);
  const noEntitiesLicensing = withoutEntities.filter((j) => j.regime === 'Licensing');
  const noEntitiesRegistration = withoutEntities.filter((j) => j.regime === 'Registration');
  const noEntitiesSandbox = withoutEntities.filter((j) => j.regime === 'Sandbox');
  console.log(`  Licensing regime (should have entities): ${noEntitiesLicensing.length}`);
  noEntitiesLicensing.forEach((j) => console.log(`    ${j.code} ${j.name} — ${j.regulator}`));
  console.log(`  Registration regime: ${noEntitiesRegistration.length}`);
  noEntitiesRegistration.forEach((j) => console.log(`    ${j.code} ${j.name} — ${j.regulator}`));
  console.log(`  Sandbox regime: ${noEntitiesSandbox.length}`);

  // ── 4. Completeness analysis ──
  let noDescription = 0;
  let noWebsite = 0;
  let noLinkedin = 0;
  let noLicenseNumber = 0;
  let noActivities = 0;
  let noEntityTypes = 0;
  let noRegistryUrl = 0;
  let duplicateNames = 0;
  let enrichedViaRawData = 0;

  const nameMap = new Map<string, number>();
  allEntities.forEach((e) => {
    const key = `${e.name}::${e.country_code}`;
    nameMap.set(key, (nameMap.get(key) || 0) + 1);
    // Check dedicated columns first, then raw_data fallback
    const rd = (e as Record<string, unknown>).raw_data as Record<string, unknown> | null;
    const hasDesc = (e.description && e.description.trim() !== '') || (rd?.enrichment_description);
    const hasLinkedin = (e.linkedin_url && e.linkedin_url.trim() !== '') || (rd?.enrichment_linkedin_url);
    const hasRegistryUrl = (e.registry_url && e.registry_url.trim() !== '') || (rd?.enrichment_registry_url);
    if (!hasDesc) noDescription++;
    if (!e.website || e.website.trim() === '') noWebsite++;
    if (!hasLinkedin) noLinkedin++;
    if (!e.license_number || e.license_number.trim() === '') noLicenseNumber++;
    if (!e.activities || e.activities.length === 0) noActivities++;
    if (!e.entity_types || e.entity_types.length === 0) noEntityTypes++;
    if (!hasRegistryUrl) noRegistryUrl++;
    if (rd?.enrichment_description) enrichedViaRawData++;
  });

  [...nameMap.entries()].forEach(([, count]) => {
    if (count > 1) duplicateNames += count;
  });

  const total = allEntities.length;
  const pct = (n: number) => `${n}/${total} (${((n / total) * 100).toFixed(1)}%)`;

  console.log(`\n📋 Data Completeness:`);
  console.log(`  Missing description:    ${pct(noDescription)}`);
  console.log(`  Missing website:        ${pct(noWebsite)}`);
  console.log(`  Missing LinkedIn:       ${pct(noLinkedin)}`);
  console.log(`  Missing license_number: ${pct(noLicenseNumber)}`);
  console.log(`  Missing activities:     ${pct(noActivities)}`);
  console.log(`  Missing entity_types:   ${pct(noEntityTypes)}`);
  console.log(`  Missing registry_url:   ${pct(noRegistryUrl)}`);
  console.log(`  Enriched via raw_data:  ${enrichedViaRawData} entities (Firecrawl worker)`);
  console.log(`  Potential duplicates:   ${duplicateNames} entities (same name+country)`);

  // ── 5. Status distribution ──
  const statusMap = new Map<string, number>();
  allEntities.forEach((e) => {
    statusMap.set(e.status, (statusMap.get(e.status) || 0) + 1);
  });
  console.log(`\n📈 Entity status distribution:`);
  [...statusMap.entries()].sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });

  // ── 6. Regime distribution ──
  const regimeMap = new Map<string, number>();
  allJ.forEach((j) => {
    regimeMap.set(j.regime, (regimeMap.get(j.regime) || 0) + 1);
  });
  console.log(`\n🏛️  Jurisdiction regime distribution:`);
  [...regimeMap.entries()].sort((a, b) => b[1] - a[1]).forEach(([regime, count]) => {
    console.log(`  ${regime}: ${count}`);
  });

  // ── 7. Travel Rule distribution ──
  const trMap = new Map<string, number>();
  allJ.forEach((j) => {
    trMap.set(j.travel_rule, (trMap.get(j.travel_rule) || 0) + 1);
  });
  console.log(`\n✈️  Travel Rule distribution:`);
  [...trMap.entries()].sort((a, b) => b[1] - a[1]).forEach(([tr, count]) => {
    console.log(`  ${tr}: ${count}`);
  });

  // ── 8. Enrichment opportunities ──
  const enrichable = allEntities.filter(
    (e) =>
      (!e.description || e.description.trim() === '') &&
      e.website &&
      e.website.trim() !== '',
  );
  const websiteMissing = allEntities.filter(
    (e) => (!e.website || e.website.trim() === '') && e.name,
  );

  console.log(`\n🔧 Enrichment Opportunities:`);
  console.log(`  Entities with website but no description (Firecrawl target): ${enrichable.length}`);
  console.log(`  Entities without website (search needed): ${websiteMissing.length}`);
  console.log(`  Entities without LinkedIn (LinkedIn search): ${noLinkedin}`);

  // ── 9. entity_count mismatch check ──
  console.log(`\n⚠️  Entity count mismatches (jurisdiction.entity_count vs actual):`);
  let mismatches = 0;
  allJ.forEach((j) => {
    const actual = countryMap.get(j.code)?.count || 0;
    if (j.entity_count !== actual) {
      console.log(`  ${j.code} (${j.name}): jurisdiction says ${j.entity_count}, actual = ${actual}`);
      mismatches++;
    }
  });
  if (mismatches === 0) console.log('  ✅ All match!');

  console.log('\n═══════════════════════════════════════');
  console.log('  Data Quality Report Complete');
  console.log('═══════════════════════════════════════\n');
}

analyze().catch((err) => {
  console.error('💥 Error:', err);
  process.exit(1);
});
