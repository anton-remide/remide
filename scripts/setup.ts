/**
 * Full database setup — creates schema + seeds data.
 *
 * Usage: npx tsx scripts/setup.ts
 *
 * Requires SUPABASE_DB_URL in .env.local (Postgres connection string)
 * OR will construct it from VITE_SUPABASE_URL + SUPABASE_DB_PASSWORD
 */

import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { config } from 'dotenv';

config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = process.env.SUPABASE_DB_URL;

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

if (!dbUrl) {
  console.error('❌ Missing SUPABASE_DB_URL in .env.local');
  console.error('   Add: SUPABASE_DB_URL=postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres');
  console.error('   Find it in Supabase Dashboard → Connect → Connection string → URI');
  process.exit(1);
}

// ── Step 1: Run schema SQL via direct Postgres connection ──

async function runSchema() {
  console.log('🔧 Step 1: Creating database schema...\n');

  const pg = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await pg.connect();

  const schemaSQL = readFileSync(resolve(__dirname, 'schema.sql'), 'utf-8');

  // Split into individual statements and run each
  // We need to handle the plpgsql function block specially
  const statements = splitSQL(schemaSQL);

  for (const stmt of statements) {
    const trimmed = stmt.trim();
    if (!trimmed || trimmed.startsWith('--')) continue;

    try {
      await pg.query(trimmed);
      // Print a summary of what was executed
      const firstLine = trimmed.split('\n')[0].substring(0, 80);
      console.log(`  ✅ ${firstLine}${firstLine.length >= 80 ? '...' : ''}`);
    } catch (err: unknown) {
      const pgErr = err as { message: string; code?: string };
      // Ignore "already exists" errors (42710 = duplicate_object, 42P07 = duplicate_table)
      if (pgErr.code === '42710' || pgErr.code === '42P07' || pgErr.code === '42P16') {
        const firstLine = trimmed.split('\n')[0].substring(0, 60);
        console.log(`  ⏭️  Already exists: ${firstLine}...`);
      } else {
        console.error(`  ❌ Failed: ${trimmed.substring(0, 80)}...`);
        console.error(`     Error: ${pgErr.message}`);
        await pg.end();
        process.exit(1);
      }
    }
  }

  await pg.end();
  console.log('\n✅ Schema created successfully!\n');
}

/**
 * Split SQL into statements, handling $$ function blocks correctly.
 */
function splitSQL(sql: string): string[] {
  const results: string[] = [];
  let current = '';
  let inDollarBlock = false;

  const lines = sql.split('\n');
  for (const line of lines) {
    const trimmedLine = line.trim();

    // Skip pure comment lines at statement start
    if (!current.trim() && trimmedLine.startsWith('--')) continue;

    current += line + '\n';

    // Track $$ blocks (PL/pgSQL function bodies)
    const dollarCount = (line.match(/\$\$/g) || []).length;
    if (dollarCount % 2 !== 0) {
      inDollarBlock = !inDollarBlock;
    }

    // Statement ends at ; but not inside $$ blocks
    if (trimmedLine.endsWith(';') && !inDollarBlock) {
      const stmt = current.trim();
      if (stmt && !stmt.startsWith('--')) {
        results.push(stmt);
      }
      current = '';
    }
  }

  // Any remaining content
  if (current.trim()) {
    results.push(current.trim());
  }

  return results;
}

// ── Step 2: Seed data via Supabase client ──

async function seedData() {
  console.log('📦 Step 2: Seeding data...\n');

  const supabase = createClient(supabaseUrl!, serviceKey!);

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

  const countries: JsonJurisdiction[] = JSON.parse(readFileSync(countriesPath, 'utf-8'));
  const entities: JsonEntity[] = JSON.parse(readFileSync(entitiesPath, 'utf-8'));

  console.log(`  Loaded ${countries.length} jurisdictions, ${entities.length} entities\n`);

  // Seed jurisdictions
  console.log('  🌍 Seeding jurisdictions...');
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

  for (let i = 0; i < jurisdictionRows.length; i += 100) {
    const batch = jurisdictionRows.slice(i, i + 100);
    const { error } = await supabase
      .from('jurisdictions')
      .upsert(batch, { onConflict: 'code' });

    if (error) {
      console.error(`  ❌ Jurisdictions batch ${i / 100 + 1} failed:`, error.message);
      process.exit(1);
    }
    console.log(`    ✅ ${i + 1}–${Math.min(i + 100, jurisdictionRows.length)}`);
  }

  // Seed entities
  console.log('\n  🏢 Seeding entities...');
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
      console.error(`  ❌ Entities batch ${i / 100 + 1} failed:`, error.message);
      process.exit(1);
    }
    console.log(`    ✅ ${i + 1}–${Math.min(i + 100, entityRows.length)}`);
  }

  console.log('\n✅ Data seeded successfully!\n');
}

// ── Step 3: Verify ──

async function verify() {
  console.log('🔍 Step 3: Verifying...\n');

  const supabase = createClient(supabaseUrl!, serviceKey!);

  const { count: jCount } = await supabase
    .from('jurisdictions')
    .select('*', { count: 'exact', head: true });

  const { count: eCount } = await supabase
    .from('entities')
    .select('*', { count: 'exact', head: true });

  console.log(`  Jurisdictions: ${jCount}`);
  console.log(`  Entities: ${eCount}`);
  console.log('\n🎉 Setup complete! Run `npm run dev` to start the app.\n');
}

// ── Main ──

async function main() {
  console.log('\n═══════════════════════════════════════');
  console.log('  RemiDe — Database Setup');
  console.log('═══════════════════════════════════════\n');

  await runSchema();
  await seedData();
  await verify();
}

main().catch((err) => {
  console.error('\n💥 Unexpected error:', err);
  process.exit(1);
});
