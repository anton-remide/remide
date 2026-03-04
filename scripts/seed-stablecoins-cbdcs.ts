/**
 * Seed script — migrates stablecoins.json + cbdcs.json → Supabase.
 *
 * Prerequisites:
 *   1. Run 002_stablecoins_cbdcs.sql in Supabase SQL Editor first (creates tables + RLS)
 *   2. Set SUPABASE_SERVICE_ROLE_KEY in .env.local
 *
 * Usage: npx tsx scripts/seed-stablecoins-cbdcs.ts
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

// ── JSON types (camelCase) ──

interface JsonStablecoin {
  id: string;
  name: string;
  ticker: string;
  type: string;
  pegCurrency: string;
  issuer: string;
  issuerCountry: string;
  launchDate: string;
  marketCapBn: number;
  chains: string[];
  reserveType: string;
  auditStatus: string;
  regulatoryStatus: string;
  website: string;
  notes: string;
  majorJurisdictions: {
    code: string;
    status: string;
    notes: string;
  }[];
}

interface JsonCbdc {
  id: string;
  countryCode: string;
  country: string;
  name: string;
  currency: string;
  status: string;
  phase: string;
  centralBank: string;
  launchDate: string | null;
  technology: string;
  retailOrWholesale: string;
  crossBorder: boolean;
  crossBorderProjects: string[];
  programmable: boolean;
  privacyModel: string;
  interestBearing: boolean;
  offlineCapable: boolean;
  notes: string;
  sources: { name: string; url: string }[];
}

async function seed() {
  console.log('\n═══════════════════════════════════════');
  console.log('  Stablecoins & CBDCs → Supabase');
  console.log('═══════════════════════════════════════\n');

  // Load JSON
  const stablecoinsPath = resolve(__dirname, '../src/data/stablecoins.json');
  const cbdcsPath = resolve(__dirname, '../src/data/cbdcs.json');

  const stablecoins: JsonStablecoin[] = JSON.parse(readFileSync(stablecoinsPath, 'utf-8'));
  const cbdcs: JsonCbdc[] = JSON.parse(readFileSync(cbdcsPath, 'utf-8'));

  console.log(`📦 Loaded ${stablecoins.length} stablecoins, ${cbdcs.length} CBDCs\n`);

  // ── 1. Seed stablecoins ──
  console.log('🪙  Seeding stablecoins...');

  const stablecoinRows = stablecoins.map((s) => ({
    id: s.id,
    name: s.name,
    ticker: s.ticker,
    type: s.type,
    peg_currency: s.pegCurrency,
    issuer: s.issuer,
    issuer_country: s.issuerCountry,
    launch_date: s.launchDate || null,
    market_cap_bn: s.marketCapBn,
    chains: s.chains,
    reserve_type: s.reserveType,
    audit_status: s.auditStatus,
    regulatory_status: s.regulatoryStatus,
    website: s.website,
    notes: s.notes,
  }));

  const { error: scErr } = await supabase
    .from('stablecoins')
    .upsert(stablecoinRows, { onConflict: 'id' });

  if (scErr) {
    console.error('❌ Stablecoins insert failed:', scErr.message);
    console.error('   Hint: Did you run 002_stablecoins_cbdcs.sql in Supabase SQL Editor first?');
    process.exit(1);
  }
  console.log(`  ✅ ${stablecoinRows.length} stablecoins upserted`);

  // ── 2. Seed stablecoin_jurisdictions ──
  console.log('\n🌍 Seeding stablecoin_jurisdictions...');

  // Flatten all majorJurisdictions into junction rows
  const junctionRows: { stablecoin_id: string; country_code: string; status: string; notes: string | null }[] = [];

  for (const s of stablecoins) {
    for (const j of s.majorJurisdictions) {
      junctionRows.push({
        stablecoin_id: s.id,
        country_code: j.code.toUpperCase(),
        status: j.status,
        notes: j.notes || null,
      });
    }
  }

  // Upsert in batches of 100
  for (let i = 0; i < junctionRows.length; i += 100) {
    const batch = junctionRows.slice(i, i + 100);
    const { error } = await supabase
      .from('stablecoin_jurisdictions')
      .upsert(batch, { onConflict: 'stablecoin_id,country_code' });

    if (error) {
      console.error(`❌ stablecoin_jurisdictions batch ${i / 100 + 1} failed:`, error.message);
      process.exit(1);
    }
  }
  console.log(`  ✅ ${junctionRows.length} jurisdiction rows upserted`);

  // ── 3. Seed CBDCs ──
  console.log('\n🏦 Seeding CBDCs...');

  const cbdcRows = cbdcs.map((c) => ({
    id: c.id,
    country_code: c.countryCode,
    country: c.country,
    name: c.name,
    currency: c.currency,
    status: c.status,
    phase: c.phase,
    central_bank: c.centralBank,
    launch_date: c.launchDate || null,
    technology: c.technology,
    retail_or_wholesale: c.retailOrWholesale,
    cross_border: c.crossBorder,
    cross_border_projects: c.crossBorderProjects,
    programmable: c.programmable,
    privacy_model: c.privacyModel,
    interest_bearing: c.interestBearing,
    offline_capable: c.offlineCapable,
    notes: c.notes,
    sources: JSON.stringify(c.sources),
  }));

  const { error: cbdcErr } = await supabase
    .from('cbdcs')
    .upsert(cbdcRows, { onConflict: 'id' });

  if (cbdcErr) {
    console.error('❌ CBDCs insert failed:', cbdcErr.message);
    process.exit(1);
  }
  console.log(`  ✅ ${cbdcRows.length} CBDCs upserted`);

  // ── 4. Verify ──
  console.log('\n🔍 Verifying...');

  const { count: scCount } = await supabase
    .from('stablecoins')
    .select('*', { count: 'exact', head: true });

  const { count: sjCount } = await supabase
    .from('stablecoin_jurisdictions')
    .select('*', { count: 'exact', head: true });

  const { count: cbdcCount } = await supabase
    .from('cbdcs')
    .select('*', { count: 'exact', head: true });

  console.log(`  Stablecoins:              ${scCount}`);
  console.log(`  Stablecoin Jurisdictions: ${sjCount}`);
  console.log(`  CBDCs:                    ${cbdcCount}`);
  console.log('\n🎉 Seed complete!\n');
}

seed().catch((err) => {
  console.error('\n💥 Unexpected error:', err);
  process.exit(1);
});
