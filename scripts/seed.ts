/**
 * Seed script — migrates static JSON data to Supabase.
 *
 * Usage:
 *   1. Set SUPABASE_SERVICE_ROLE_KEY in .env.local
 *   2. Run: npx tsx scripts/seed.ts
 *
 * Uses service_role key to bypass RLS. Safe to re-run (upserts).
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env from .env.local
import { config } from 'dotenv';
config({ path: resolve(__dirname, '../.env.local') });

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

// ── Load JSON data ──
const countriesPath = resolve(__dirname, '../src/data/countries.json');
const entitiesPath = resolve(__dirname, '../src/data/entities.json');

interface JsonJurisdiction {
  code: string;
  name: string;
  regime: string;
  regulator: string;
  keyLaw: string;
  travelRule: string;
  entityCount: number;
  sources: { name: string; url: string }[];
  notes: string;
}

interface JsonEntity {
  id: string;
  name: string;
  countryCode: string;
  country: string;
  licenseNumber: string;
  licenseType: string;
  entityTypes: string[];
  activities: string[];
  status: string;
  regulator: string;
  website: string;
}

async function seed() {
  const countries: JsonJurisdiction[] = JSON.parse(readFileSync(countriesPath, 'utf-8'));
  const entities: JsonEntity[] = JSON.parse(readFileSync(entitiesPath, 'utf-8'));

  console.log(`📦 Loaded ${countries.length} jurisdictions, ${entities.length} entities`);

  // ── Seed jurisdictions ──
  console.log('\n🌍 Seeding jurisdictions...');
  const jurisdictionRows = countries.map((c) => ({
    code: c.code,
    name: c.name,
    regime: c.regime,
    regulator: c.regulator,
    key_law: c.keyLaw,
    travel_rule: c.travelRule,
    entity_count: c.entityCount,
    sources: JSON.stringify(c.sources),
    notes: c.notes,
  }));

  // Batch upsert in chunks of 100
  for (let i = 0; i < jurisdictionRows.length; i += 100) {
    const batch = jurisdictionRows.slice(i, i + 100);
    const { error } = await supabase
      .from('jurisdictions')
      .upsert(batch, { onConflict: 'code' });

    if (error) {
      console.error(`❌ Jurisdictions batch ${i / 100 + 1} failed:`, error.message);
      process.exit(1);
    }
    console.log(`  ✅ Jurisdictions ${i + 1}–${Math.min(i + 100, jurisdictionRows.length)}`);
  }

  // ── Seed entities ──
  console.log('\n🏢 Seeding entities...');
  const entityRows = entities.map((e) => ({
    id: e.id,
    name: e.name,
    country_code: e.countryCode,
    country: e.country,
    license_number: e.licenseNumber,
    license_type: e.licenseType,
    entity_types: e.entityTypes,
    activities: e.activities,
    status: e.status,
    regulator: e.regulator,
    website: e.website,
  }));

  for (let i = 0; i < entityRows.length; i += 100) {
    const batch = entityRows.slice(i, i + 100);
    const { error } = await supabase
      .from('entities')
      .upsert(batch, { onConflict: 'id' });

    if (error) {
      console.error(`❌ Entities batch ${i / 100 + 1} failed:`, error.message);
      process.exit(1);
    }
    console.log(`  ✅ Entities ${i + 1}–${Math.min(i + 100, entityRows.length)}`);
  }

  console.log('\n🎉 Seed complete!');
}

seed().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
