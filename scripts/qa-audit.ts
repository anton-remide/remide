/**
 * QA Audit Script — Comprehensive data quality check against Supabase.
 *
 * Checks 20 audit dimensions across entities, stablecoins, CBDCs,
 * jurisdictions, issuers, and cross-referential integrity.
 *
 * Usage:
 *   cd /Users/antontitov/Vasp\ Tracker/remide && npx tsx scripts/qa-audit.ts
 *
 * Output: console + /tmp/qa-audit-results.txt
 */

import { getSupabase } from '../shared/supabase.js';
import * as fs from 'fs';

const sb = getSupabase();
const lines: string[] = [];

function log(msg: string = '') {
  console.log(msg);
  lines.push(msg);
}

function hr(char = '=', len = 80) {
  log(char.repeat(len));
}

function heading(title: string) {
  log('');
  hr();
  log(`  ${title}`);
  hr();
}

function subHeading(title: string) {
  log('');
  log(`  --- ${title} ---`);
}

/** Fetch all rows from a table in batches (Supabase 1000 limit). */
async function fetchAll<T>(table: string, select: string): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;
  const batchSize = 1000;
  while (true) {
    const { data, error } = await sb
      .from(table)
      .select(select)
      .range(offset, offset + batchSize - 1);
    if (error) {
      log(`  [ERROR] Fetching ${table}: ${error.message}`);
      break;
    }
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    offset += data.length;
    if (data.length < batchSize) break;
  }
  return all;
}

// ── Region mapping (ISO alpha-2 → region) ──

const REGION_MAP: Record<string, string> = {};
const regionDefs: Record<string, string[]> = {
  'Europe': [
    'AL','AD','AT','BY','BE','BA','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU',
    'IS','IE','IT','XK','LV','LI','LT','LU','MT','MD','MC','ME','NL','MK','NO','PL','PT',
    'RO','RU','SM','RS','SK','SI','ES','SE','CH','UA','GB','VA','GI','IM','JE','GG','FO',
  ],
  'North America': ['US','CA','MX','BM','BS','BB','JM','TT','HT','DO','CU','PR','VI','KY','TC','AG','KN','LC','VC','GD','DM','BZ','GT','HN','SV','NI','CR','PA','AW','CW','SX','BQ','GP','MQ','MF','BL','AI','MS','VG'],
  'South America': ['BR','AR','CL','CO','PE','VE','EC','BO','PY','UY','GY','SR','GF','FK'],
  'Asia-Pacific': [
    'CN','JP','KR','IN','ID','TH','VN','PH','MY','SG','MM','KH','LA','BN','TL','MN','TW',
    'HK','MO','AU','NZ','FJ','PG','WS','TO','VU','SB','KI','MH','FM','PW','NR','TV','CK','NU',
    'BD','NP','LK','BT','MV','AF','PK',
  ],
  'Middle East': ['AE','SA','QA','BH','KW','OM','IQ','IR','IL','JO','LB','SY','YE','PS','TR'],
  'Africa': [
    'ZA','NG','KE','GH','ET','TZ','UG','RW','SN','CI','CM','CD','CG','GA','BF','ML','NE',
    'TD','MR','GN','SL','LR','BJ','TG','GW','CV','ST','GQ','MG','MU','SC','MZ','ZW','BW',
    'NA','ZM','MW','AO','LS','SZ','DJ','ER','SO','KM','SS','CF','BI','DZ','MA','TN','LY','EG','SD',
  ],
  'Central Asia': ['KZ','UZ','TM','KG','TJ','GE','AM','AZ'],
};
for (const [region, codes] of Object.entries(regionDefs)) {
  for (const code of codes) REGION_MAP[code] = region;
}

async function main() {
  const startTime = Date.now();
  
  heading(`REMIDE QA AUDIT — ${new Date().toISOString()}`);

  // ══════════════════════════════════════════
  // Fetch all entities
  // ══════════════════════════════════════════

  log('\n  Fetching all entities...');
  interface EntityRow {
    id: string;
    name: string;
    canonical_name: string | null;
    country_code: string | null;
    country: string | null;
    license_number: string | null;
    license_type: string | null;
    sector: string | null;
    status: string | null;
    parser_id: string | null;
    quality_score: number | null;
    is_garbage: boolean | null;
    dns_status: string | null;
    crypto_status: string | null;
    crypto_related: boolean | null;
    website: string | null;
    regulator: string | null;
  }

  const entities = await fetchAll<EntityRow>(
    'entities',
    'id, name, canonical_name, country_code, country, license_number, license_type, sector, status, parser_id, quality_score, is_garbage, dns_status, crypto_status, crypto_related, website, regulator'
  );

  log(`  Fetched ${entities.length} entities.\n`);

  // ══════════════════════════════════════════
  // CHECK 1: Total entity count by sector
  // ══════════════════════════════════════════
  heading('CHECK 1: Entity Count by Sector');

  const sectorCounts: Record<string, number> = {};
  for (const e of entities) {
    const s = e.sector || '(null)';
    sectorCounts[s] = (sectorCounts[s] || 0) + 1;
  }
  const sortedSectors = Object.entries(sectorCounts).sort((a, b) => b[1] - a[1]);
  log(`  ${'Sector'.padEnd(20)} ${'Count'.padStart(8)} ${'%'.padStart(8)}`);
  log(`  ${'─'.repeat(38)}`);
  for (const [sector, count] of sortedSectors) {
    const pct = ((count / entities.length) * 100).toFixed(1);
    log(`  ${sector.padEnd(20)} ${String(count).padStart(8)} ${(pct + '%').padStart(8)}`);
  }
  log(`  ${'─'.repeat(38)}`);
  log(`  ${'TOTAL'.padEnd(20)} ${String(entities.length).padStart(8)}`);

  // ══════════════════════════════════════════
  // CHECK 2: NULL or empty name
  // ══════════════════════════════════════════
  heading('CHECK 2: Entities with NULL or Empty Name');

  const nullNames = entities.filter(e => !e.name || e.name.trim() === '');
  log(`  Count: ${nullNames.length}`);
  if (nullNames.length > 0 && nullNames.length <= 20) {
    for (const e of nullNames) {
      log(`    - ID: ${e.id}, country: ${e.country_code}, parser: ${e.parser_id}`);
    }
  } else if (nullNames.length > 20) {
    log(`  (Showing first 20)`);
    for (const e of nullNames.slice(0, 20)) {
      log(`    - ID: ${e.id}, country: ${e.country_code}, parser: ${e.parser_id}`);
    }
  }
  log(nullNames.length === 0 ? '  PASS: All entities have names.' : `  FAIL: ${nullNames.length} entities with missing name.`);

  // ══════════════════════════════════════════
  // CHECK 3: NULL country_code
  // ══════════════════════════════════════════
  heading('CHECK 3: Entities with NULL country_code');

  const nullCountry = entities.filter(e => !e.country_code || e.country_code.trim() === '');
  log(`  Count: ${nullCountry.length}`);
  if (nullCountry.length > 0 && nullCountry.length <= 20) {
    for (const e of nullCountry) {
      log(`    - ID: ${e.id}, name: ${e.name}, parser: ${e.parser_id}`);
    }
  }
  log(nullCountry.length === 0 ? '  PASS: All entities have country_code.' : `  FAIL: ${nullCountry.length} entities missing country_code.`);

  // ══════════════════════════════════════════
  // CHECK 4: NULL license_number
  // ══════════════════════════════════════════
  heading('CHECK 4: Entities with NULL license_number');

  const nullLicense = entities.filter(e => e.license_number === null || e.license_number === undefined);
  const emptyLicense = entities.filter(e => e.license_number !== null && e.license_number !== undefined && e.license_number.trim() === '');
  const hasLicense = entities.length - nullLicense.length - emptyLicense.length;
  log(`  NULL license_number:  ${nullLicense.length}`);
  log(`  Empty string '':      ${emptyLicense.length}`);
  log(`  Has license_number:   ${hasLicense}`);
  log(`  Note: Empty string is the default — only strict NULLs are anomalous.`);

  // ══════════════════════════════════════════
  // CHECK 5: Duplicate entities (same name + country_code)
  // ══════════════════════════════════════════
  heading('CHECK 5: Duplicate Entities (same name + same country_code)');

  const dupeMap = new Map<string, EntityRow[]>();
  for (const e of entities) {
    const key = `${(e.name || '').toLowerCase().trim()}|${e.country_code}`;
    if (!dupeMap.has(key)) dupeMap.set(key, []);
    dupeMap.get(key)!.push(e);
  }
  const dupes = [...dupeMap.entries()].filter(([, arr]) => arr.length > 1);
  log(`  Duplicate groups: ${dupes.length}`);
  let totalDupeEntities = 0;
  if (dupes.length > 0) {
    const sortedDupes = dupes.sort((a, b) => b[1].length - a[1].length);
    const showCount = Math.min(sortedDupes.length, 30);
    log(`  (Showing top ${showCount} duplicate groups)`);
    for (const [key, arr] of sortedDupes.slice(0, showCount)) {
      totalDupeEntities += arr.length - 1;
      const [name, cc] = key.split('|');
      log(`    "${name}" [${cc}] x${arr.length} — parsers: ${[...new Set(arr.map(e => e.parser_id))].join(', ')}`);
    }
    log(`  Total excess duplicate entities: ${dupes.reduce((sum, [, arr]) => sum + arr.length - 1, 0)}`);
  }
  log(dupes.length === 0 ? '  PASS: No duplicate entities.' : `  WARNING: ${dupes.length} duplicate groups found.`);

  // ══════════════════════════════════════════
  // CHECK 6: Entities per country — top 20 and bottom 20
  // ══════════════════════════════════════════
  heading('CHECK 6: Entities per Country');

  const countryMap: Record<string, number> = {};
  for (const e of entities) {
    const cc = e.country_code || '(null)';
    countryMap[cc] = (countryMap[cc] || 0) + 1;
  }
  const sortedCountries = Object.entries(countryMap).sort((a, b) => b[1] - a[1]);
  const totalCountries = sortedCountries.length;

  subHeading(`Top 20 (of ${totalCountries} countries)`);
  log(`  ${'Country'.padEnd(8)} ${'Count'.padStart(8)} ${'Bar'}`);
  log(`  ${'─'.repeat(55)}`);
  const maxC = sortedCountries[0]?.[1] || 1;
  for (const [cc, count] of sortedCountries.slice(0, 20)) {
    const bar = '#'.repeat(Math.max(1, Math.round((count / maxC) * 40)));
    log(`  ${cc.padEnd(8)} ${String(count).padStart(8)} ${bar}`);
  }

  subHeading(`Bottom 20 (of ${totalCountries} countries)`);
  const bottom = sortedCountries.slice(-20);
  for (const [cc, count] of bottom) {
    log(`  ${cc.padEnd(8)} ${String(count).padStart(8)}`);
  }

  // ══════════════════════════════════════════
  // CHECK 7: Entities per parser_id
  // ══════════════════════════════════════════
  heading('CHECK 7: Entities per Parser');

  const parserMap: Record<string, number> = {};
  for (const e of entities) {
    const p = e.parser_id || '(null)';
    parserMap[p] = (parserMap[p] || 0) + 1;
  }
  const sortedParsers = Object.entries(parserMap).sort((a, b) => b[1] - a[1]);
  log(`  ${'Parser'.padEnd(25)} ${'Count'.padStart(8)}`);
  log(`  ${'─'.repeat(35)}`);
  for (const [pid, count] of sortedParsers) {
    log(`  ${pid.padEnd(25)} ${String(count).padStart(8)}`);
  }

  // Check for known parsers with 0 entities
  const knownParsers = [
    'au-austrac', 'ca-fintrac', 'jp-jfsa', 'sg-mas', 'ch-finma', 'us-fincen',
    'ae-vara', 'ae-adgm', 'ae-dfsareg', 'za-fsca', 'bm-bma',
    'esma-unified', 'us-fdic', 'gb-pra', 'us-nydfs', 'hk-sfc', 'kr-fiu',
    'br-bcb', 'ar-cnv', 'ph-bsp', 'ng-sec', 'sv-cnad',
    'th-sec', 'my-sc', 'sc-fsa', 'gi-gfsc', 'im-fsa',
    'li-fma', 'tw-fsc', 'ky-cima', 'id-ojk',
  ];
  const missingParsers = knownParsers.filter(p => !parserMap[p]);
  if (missingParsers.length > 0) {
    log(`\n  WARNING: Known parsers with 0 entities in DB:`);
    for (const p of missingParsers) {
      log(`    - ${p}`);
    }
  } else {
    log(`\n  PASS: All ${knownParsers.length} known parsers have entities.`);
  }

  // ══════════════════════════════════════════
  // CHECK 8: Stablecoins
  // ══════════════════════════════════════════
  heading('CHECK 8: Stablecoins');

  interface StablecoinRow { id: string; name: string | null; ticker: string | null; type: string | null; issuer: string | null; }
  const stablecoins = await fetchAll<StablecoinRow>('stablecoins', 'id, name, ticker, type, issuer');
  log(`  Total stablecoins: ${stablecoins.length}`);

  const nullStablecoinName = stablecoins.filter(s => !s.name || s.name.trim() === '');
  const nullTicker = stablecoins.filter(s => !s.ticker || s.ticker.trim() === '');
  log(`  NULL/empty name:   ${nullStablecoinName.length}`);
  log(`  NULL/empty ticker: ${nullTicker.length}`);
  if (nullStablecoinName.length > 0) {
    for (const s of nullStablecoinName) log(`    - ID: ${s.id}, ticker: ${s.ticker}`);
  }
  if (nullTicker.length > 0) {
    for (const s of nullTicker) log(`    - ID: ${s.id}, name: ${s.name}`);
  }
  log(nullStablecoinName.length === 0 && nullTicker.length === 0 ? '  PASS' : '  FAIL');

  // ══════════════════════════════════════════
  // CHECK 9: CBDCs
  // ══════════════════════════════════════════
  heading('CHECK 9: CBDCs');

  interface CbdcRow { id: string; name: string | null; country_code: string | null; status: string | null; }
  const cbdcs = await fetchAll<CbdcRow>('cbdcs', 'id, name, country_code, status');
  log(`  Total CBDCs: ${cbdcs.length}`);

  const nullCbdcName = cbdcs.filter(c => !c.name || c.name.trim() === '');
  log(`  NULL/empty name: ${nullCbdcName.length}`);
  if (nullCbdcName.length > 0) {
    for (const c of nullCbdcName) log(`    - ID: ${c.id}, country: ${c.country_code}`);
  }
  log(nullCbdcName.length === 0 ? '  PASS' : '  FAIL');

  // ══════════════════════════════════════════
  // CHECK 10: Jurisdictions
  // ══════════════════════════════════════════
  heading('CHECK 10: Jurisdictions');

  interface JurisdictionRow { code: string; name: string | null; regime: string | null; }
  const jurisdictions = await fetchAll<JurisdictionRow>('jurisdictions', 'code, name, regime');
  log(`  Total jurisdictions: ${jurisdictions.length}`);

  const nullJurName = jurisdictions.filter(j => !j.name || j.name.trim() === '');
  log(`  NULL/empty country_name: ${nullJurName.length}`);
  if (nullJurName.length > 0) {
    for (const j of nullJurName) log(`    - Code: ${j.code}`);
  }
  log(nullJurName.length === 0 ? '  PASS' : '  FAIL');

  // ══════════════════════════════════════════
  // CHECK 11: Stablecoin Issuers
  // ══════════════════════════════════════════
  heading('CHECK 11: Stablecoin Issuers');

  interface IssuerRow { id: number; name: string | null; slug: string | null; country_code: string | null; }
  const issuers = await fetchAll<IssuerRow>('stablecoin_issuers', 'id, name, slug, country_code');
  log(`  Total issuers: ${issuers.length}`);

  const nullIssuerName = issuers.filter(i => !i.name || i.name.trim() === '');
  log(`  NULL/empty name: ${nullIssuerName.length}`);
  if (nullIssuerName.length > 0) {
    for (const i of nullIssuerName) log(`    - ID: ${i.id}, slug: ${i.slug}`);
  }
  log(nullIssuerName.length === 0 ? '  PASS' : '  FAIL');

  // ══════════════════════════════════════════
  // CHECK 12: Cross-reference: entity country_code vs jurisdictions
  // ══════════════════════════════════════════
  heading('CHECK 12: Entity country_codes Not in Jurisdictions');

  const jurCodes = new Set(jurisdictions.map(j => j.code));
  const entityCodes = new Set(entities.map(e => e.country_code).filter(Boolean));
  const orphanCodes = [...entityCodes].filter(c => !jurCodes.has(c!));
  log(`  Entity country codes: ${entityCodes.size}`);
  log(`  Jurisdiction codes:   ${jurCodes.size}`);
  log(`  Orphan codes (in entities but not in jurisdictions): ${orphanCodes.length}`);
  if (orphanCodes.length > 0) {
    for (const code of orphanCodes) {
      const count = entities.filter(e => e.country_code === code).length;
      log(`    - ${code} (${count} entities)`);
    }
  }
  log(orphanCodes.length === 0 ? '  PASS' : '  WARNING: Some entity country_codes have no matching jurisdiction.');

  // ══════════════════════════════════════════
  // CHECK 13: Entity name anomalies
  // ══════════════════════════════════════════
  heading('CHECK 13: Entity Name Anomalies');

  const displayName = (e: EntityRow) => e.canonical_name || e.name || '';
  const shortNames = entities.filter(e => displayName(e).length > 0 && displayName(e).length < 2);
  const longNames = entities.filter(e => displayName(e).length > 200);
  const numericNames = entities.filter(e => /^\d+$/.test(displayName(e).trim()));

  log(`  Names shorter than 2 chars: ${shortNames.length}`);
  if (shortNames.length > 0) {
    for (const e of shortNames.slice(0, 10)) {
      log(`    - "${displayName(e)}" [${e.country_code}] parser=${e.parser_id}`);
    }
  }

  log(`  Names longer than 200 chars: ${longNames.length}`);
  if (longNames.length > 0) {
    for (const e of longNames.slice(0, 10)) {
      log(`    - "${displayName(e).substring(0, 80)}..." (${displayName(e).length} chars) [${e.country_code}]`);
    }
  }

  log(`  Names that are just numbers: ${numericNames.length}`);
  if (numericNames.length > 0) {
    for (const e of numericNames.slice(0, 10)) {
      log(`    - "${displayName(e)}" [${e.country_code}] parser=${e.parser_id}`);
    }
  }

  const totalAnomalies = shortNames.length + longNames.length + numericNames.length;
  log(totalAnomalies === 0 ? '  PASS: No name anomalies.' : `  WARNING: ${totalAnomalies} name anomalies.`);

  // ══════════════════════════════════════════
  // CHECK 14: License number anomalies
  // ══════════════════════════════════════════
  heading('CHECK 14: License Number Anomalies');

  // Empty strings (different from NULL — default is '')
  const emptyStringLicenses = entities.filter(e => e.license_number === '');
  log(`  Empty string license_number: ${emptyStringLicenses.length} (expected — default value)`);

  // Duplicates within same country
  const licDupeMap = new Map<string, EntityRow[]>();
  for (const e of entities) {
    if (!e.license_number || e.license_number.trim() === '') continue;
    const key = `${e.country_code}|${e.license_number.trim().toLowerCase()}`;
    if (!licDupeMap.has(key)) licDupeMap.set(key, []);
    licDupeMap.get(key)!.push(e);
  }
  const licDupes = [...licDupeMap.entries()].filter(([, arr]) => arr.length > 1);
  log(`  Duplicate license numbers within same country: ${licDupes.length} groups`);
  if (licDupes.length > 0) {
    const showCount = Math.min(licDupes.length, 20);
    log(`  (Showing top ${showCount})`);
    for (const [key, arr] of licDupes.sort((a, b) => b[1].length - a[1].length).slice(0, showCount)) {
      const [cc, lic] = key.split('|');
      log(`    ${cc} | "${lic}" x${arr.length}: ${arr.map(e => e.name?.substring(0, 40)).join(', ')}`);
    }
  }

  // ══════════════════════════════════════════
  // CHECK 15: quality_score distribution
  // ══════════════════════════════════════════
  heading('CHECK 15: Quality Score Distribution');

  const tiers = { T1: 0, T2: 0, T3: 0, T4: 0, null_score: 0 };
  for (const e of entities) {
    if (e.quality_score === null || e.quality_score === undefined) {
      tiers.null_score++;
    } else if (e.quality_score <= 25) {
      tiers.T1++;
    } else if (e.quality_score <= 50) {
      tiers.T2++;
    } else if (e.quality_score <= 75) {
      tiers.T3++;
    } else {
      tiers.T4++;
    }
  }
  log(`  ${'Tier'.padEnd(15)} ${'Range'.padEnd(10)} ${'Count'.padStart(8)} ${'%'.padStart(8)}`);
  log(`  ${'─'.repeat(43)}`);
  log(`  ${'T1 (Low)'.padEnd(15)} ${'0-25'.padEnd(10)} ${String(tiers.T1).padStart(8)} ${((tiers.T1/entities.length)*100).toFixed(1).padStart(7)}%`);
  log(`  ${'T2 (Medium)'.padEnd(15)} ${'26-50'.padEnd(10)} ${String(tiers.T2).padStart(8)} ${((tiers.T2/entities.length)*100).toFixed(1).padStart(7)}%`);
  log(`  ${'T3 (Good)'.padEnd(15)} ${'51-75'.padEnd(10)} ${String(tiers.T3).padStart(8)} ${((tiers.T3/entities.length)*100).toFixed(1).padStart(7)}%`);
  log(`  ${'T4 (Excellent)'.padEnd(15)} ${'76-100'.padEnd(10)} ${String(tiers.T4).padStart(8)} ${((tiers.T4/entities.length)*100).toFixed(1).padStart(7)}%`);
  log(`  ${'(null)'.padEnd(15)} ${'N/A'.padEnd(10)} ${String(tiers.null_score).padStart(8)} ${((tiers.null_score/entities.length)*100).toFixed(1).padStart(7)}%`);

  // Min/max/avg
  const scored = entities.filter(e => e.quality_score !== null && e.quality_score !== undefined);
  if (scored.length > 0) {
    const scores = scored.map(e => e.quality_score!);
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const avg = (scores.reduce((s, v) => s + v, 0) / scores.length).toFixed(1);
    log(`\n  Min: ${min}  Max: ${max}  Avg: ${avg}  Scored: ${scored.length}/${entities.length}`);
  }

  // ══════════════════════════════════════════
  // CHECK 16: is_garbage count
  // ══════════════════════════════════════════
  heading('CHECK 16: Garbage Entities (is_garbage = true)');

  const garbageEntities = entities.filter(e => e.is_garbage === true);
  log(`  Garbage count: ${garbageEntities.length} / ${entities.length} (${((garbageEntities.length/entities.length)*100).toFixed(2)}%)`);
  if (garbageEntities.length > 0 && garbageEntities.length <= 20) {
    for (const e of garbageEntities) {
      log(`    - "${(e.canonical_name || e.name || '').substring(0, 60)}" [${e.country_code}] parser=${e.parser_id}`);
    }
  } else if (garbageEntities.length > 20) {
    log(`  (Showing first 20 of ${garbageEntities.length})`);
    for (const e of garbageEntities.slice(0, 20)) {
      log(`    - "${(e.canonical_name || e.name || '').substring(0, 60)}" [${e.country_code}] parser=${e.parser_id}`);
    }
  }

  // ══════════════════════════════════════════
  // CHECK 17: dns_status distribution
  // ══════════════════════════════════════════
  heading('CHECK 17: DNS Status Distribution');

  const dnsMap: Record<string, number> = {};
  for (const e of entities) {
    const s = e.dns_status || '(null)';
    dnsMap[s] = (dnsMap[s] || 0) + 1;
  }
  log(`  ${'DNS Status'.padEnd(15)} ${'Count'.padStart(8)} ${'%'.padStart(8)}`);
  log(`  ${'─'.repeat(33)}`);
  for (const [status, count] of Object.entries(dnsMap).sort((a, b) => b[1] - a[1])) {
    log(`  ${status.padEnd(15)} ${String(count).padStart(8)} ${((count/entities.length)*100).toFixed(1).padStart(7)}%`);
  }

  // ══════════════════════════════════════════
  // CHECK 18: crypto_status distribution
  // ══════════════════════════════════════════
  heading('CHECK 18: Crypto Status Distribution');

  const cryptoMap: Record<string, number> = {};
  for (const e of entities) {
    const s = e.crypto_status || '(null)';
    cryptoMap[s] = (cryptoMap[s] || 0) + 1;
  }
  log(`  ${'Crypto Status'.padEnd(20)} ${'Count'.padStart(8)} ${'%'.padStart(8)}`);
  log(`  ${'─'.repeat(38)}`);
  for (const [status, count] of Object.entries(cryptoMap).sort((a, b) => b[1] - a[1])) {
    log(`  ${status.padEnd(20)} ${String(count).padStart(8)} ${((count/entities.length)*100).toFixed(1).padStart(7)}%`);
  }

  // ══════════════════════════════════════════
  // CHECK 19: Stablecoin jurisdictions
  // ══════════════════════════════════════════
  heading('CHECK 19: Stablecoin Jurisdictions');

  interface SJRow { stablecoin_id: string; country_code: string; status: string | null; }
  const stablecoinJurisdictions = await fetchAll<SJRow>('stablecoin_jurisdictions', 'stablecoin_id, country_code, status');
  log(`  Total stablecoin_jurisdictions rows: ${stablecoinJurisdictions.length}`);

  const sjStatusMap: Record<string, number> = {};
  for (const sj of stablecoinJurisdictions) {
    const s = sj.status || '(null)';
    sjStatusMap[s] = (sjStatusMap[s] || 0) + 1;
  }
  if (stablecoinJurisdictions.length > 0) {
    log(`\n  Status distribution:`);
    for (const [status, count] of Object.entries(sjStatusMap).sort((a, b) => b[1] - a[1])) {
      log(`    ${status.padEnd(18)} ${String(count).padStart(6)}`);
    }
  }

  // Unique stablecoins and unique countries covered
  const uniqueSJStablecoins = new Set(stablecoinJurisdictions.map(s => s.stablecoin_id));
  const uniqueSJCountries = new Set(stablecoinJurisdictions.map(s => s.country_code));
  log(`\n  Unique stablecoins with jurisdiction data: ${uniqueSJStablecoins.size}`);
  log(`  Unique countries covered: ${uniqueSJCountries.size}`);

  // ══════════════════════════════════════════
  // CHECK 20: Region distribution
  // ══════════════════════════════════════════
  heading('CHECK 20: Entity Distribution by Region');

  const regionCountMap: Record<string, number> = {};
  const regionCountryMap: Record<string, Set<string>> = {};
  for (const e of entities) {
    const cc = e.country_code || '';
    const region = REGION_MAP[cc] || 'Unknown/Other';
    regionCountMap[region] = (regionCountMap[region] || 0) + 1;
    if (!regionCountryMap[region]) regionCountryMap[region] = new Set();
    regionCountryMap[region].add(cc);
  }
  const sortedRegions = Object.entries(regionCountMap).sort((a, b) => b[1] - a[1]);
  log(`  ${'Region'.padEnd(22)} ${'Entities'.padStart(10)} ${'Countries'.padStart(11)} ${'%'.padStart(8)}`);
  log(`  ${'─'.repeat(53)}`);
  for (const [region, count] of sortedRegions) {
    const countries = regionCountryMap[region]?.size || 0;
    log(`  ${region.padEnd(22)} ${String(count).padStart(10)} ${String(countries).padStart(11)} ${((count/entities.length)*100).toFixed(1).padStart(7)}%`);
  }

  // ══════════════════════════════════════════
  // SUMMARY
  // ══════════════════════════════════════════
  heading('AUDIT SUMMARY');

  const checks = [
    { name: 'Entity count by sector', pass: true, detail: `${entities.length} total` },
    { name: 'NULL/empty names', pass: nullNames.length === 0, detail: `${nullNames.length} issues` },
    { name: 'NULL country_code', pass: nullCountry.length === 0, detail: `${nullCountry.length} issues` },
    { name: 'NULL license_number', pass: true, detail: `${nullLicense.length} NULL, ${emptyLicense.length} empty (default)` },
    { name: 'Duplicate entities', pass: dupes.length === 0, detail: `${dupes.length} groups` },
    { name: 'Country coverage', pass: true, detail: `${totalCountries} countries` },
    { name: 'Parser coverage', pass: missingParsers.length === 0, detail: `${sortedParsers.length} parsers, ${missingParsers.length} missing` },
    { name: 'Stablecoins', pass: nullStablecoinName.length === 0 && nullTicker.length === 0, detail: `${stablecoins.length} total` },
    { name: 'CBDCs', pass: nullCbdcName.length === 0, detail: `${cbdcs.length} total` },
    { name: 'Jurisdictions', pass: nullJurName.length === 0, detail: `${jurisdictions.length} total` },
    { name: 'Issuers', pass: nullIssuerName.length === 0, detail: `${issuers.length} total` },
    { name: 'Country cross-ref', pass: orphanCodes.length === 0, detail: `${orphanCodes.length} orphans` },
    { name: 'Name anomalies', pass: totalAnomalies === 0, detail: `${totalAnomalies} issues` },
    { name: 'License anomalies', pass: licDupes.length === 0, detail: `${licDupes.length} dup license groups` },
    { name: 'Quality scores', pass: tiers.null_score === 0, detail: `T1:${tiers.T1} T2:${tiers.T2} T3:${tiers.T3} T4:${tiers.T4}` },
    { name: 'Garbage flagged', pass: true, detail: `${garbageEntities.length} (${((garbageEntities.length/entities.length)*100).toFixed(2)}%)` },
    { name: 'DNS status', pass: true, detail: `${Object.keys(dnsMap).length} statuses` },
    { name: 'Crypto status', pass: true, detail: `${Object.keys(cryptoMap).length} statuses` },
    { name: 'Stablecoin jurisdictions', pass: true, detail: `${stablecoinJurisdictions.length} rows` },
    { name: 'Region distribution', pass: true, detail: `${sortedRegions.length} regions` },
  ];

  const passCount = checks.filter(c => c.pass).length;
  const failCount = checks.filter(c => !c.pass).length;

  log('');
  log(`  ${'#'.padStart(3)} ${'Check'.padEnd(28)} ${'Result'.padEnd(10)} Detail`);
  log(`  ${'─'.repeat(75)}`);
  for (let i = 0; i < checks.length; i++) {
    const c = checks[i];
    const result = c.pass ? 'PASS' : 'FAIL';
    log(`  ${String(i + 1).padStart(3)} ${c.name.padEnd(28)} ${result.padEnd(10)} ${c.detail}`);
  }
  log(`  ${'─'.repeat(75)}`);
  log(`  PASS: ${passCount} / ${checks.length}    FAIL: ${failCount} / ${checks.length}`);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  log(`\n  Audit completed in ${elapsed}s`);
  log(`  Output saved to: /tmp/qa-audit-results.txt`);
  hr();

  // Write to file
  fs.writeFileSync('/tmp/qa-audit-results.txt', lines.join('\n'), 'utf-8');
}

main().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
