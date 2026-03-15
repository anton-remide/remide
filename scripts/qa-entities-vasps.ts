/**
 * QA: EntitiesPage VASPs Tab — Comprehensive Filter & Data Validation
 *
 * Tests 55+ scenarios covering sector filters, region filters, data quality,
 * cross-filters, and edge cases. Queries Supabase directly and validates
 * against the same logic used in the EntitiesPage frontend.
 *
 * Usage:
 *   cd "/Users/antontitov/Vasp Tracker/remide" && npx tsx scripts/qa-entities-vasps.ts
 *
 * Output: console + /tmp/qa-entities-vasps.txt
 */

import { getSupabase } from '../shared/supabase.js';
import * as fs from 'fs';

const sb = getSupabase();
const lines: string[] = [];
let passCount = 0;
let failCount = 0;
let warnCount = 0;

/* ── Logging ── */

function log(msg = '') {
  console.log(msg);
  lines.push(msg);
}

function hr(char = '=', len = 80) { log(char.repeat(len)); }

function heading(title: string) {
  log(''); hr(); log(`  ${title}`); hr();
}

function pass(id: number, desc: string, detail = '') {
  passCount++;
  const line = `  [PASS] #${id}: ${desc}${detail ? ` — ${detail}` : ''}`;
  log(line);
}

function fail(id: number, desc: string, expected: string, actual: string) {
  failCount++;
  const line = `  [FAIL] #${id}: ${desc}\n         Expected: ${expected}\n         Actual:   ${actual}`;
  log(line);
}

function warn(id: number, desc: string, detail: string) {
  warnCount++;
  const line = `  [WARN] #${id}: ${desc} — ${detail}`;
  log(line);
}

/* ── Data Fetcher (Supabase 1000-row limit bypass) ── */

interface EntityRow {
  id: string;
  name: string;
  canonical_name: string | null;
  country_code: string;
  country: string;
  license_number: string | null;
  license_type: string | null;
  status: string | null;
  regulator: string | null;
  website: string | null;
  description: string | null;
  sector: string | null;
  quality_score: number | null;
  is_garbage: boolean | null;
  dns_status: string | null;
  crypto_status: string | null;
  parser_id: string | null;
}

const ENTITY_SELECT = 'id,name,canonical_name,country_code,country,license_number,license_type,status,regulator,website,description,sector,quality_score,is_garbage,dns_status,crypto_status,parser_id';

async function fetchAll(): Promise<EntityRow[]> {
  const all: EntityRow[] = [];
  let offset = 0;
  const batch = 1000;
  while (true) {
    const { data, error } = await sb
      .from('entities')
      .select(ENTITY_SELECT)
      .range(offset, offset + batch - 1);
    if (error) { log(`  [ERROR] Fetching entities: ${error.message}`); break; }
    if (!data || data.length === 0) break;
    all.push(...(data as EntityRow[]));
    offset += data.length;
    if (data.length < batch) break;
  }
  return all;
}

/* ── Region Mapping (mirrors EntitiesPage.tsx exactly) ── */

type RegionKey = 'Europe' | 'UK' | 'North America' | 'Asia-Pacific' | 'MENA' | 'Africa' | 'LATAM' | 'Caribbean & Offshore';

const REGION_MAP: Record<RegionKey, string[]> = {
  'Europe': ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE','CH','NO','IS','LI','AD','MC','SM','UA','MD','RS','BA','ME','MK','AL','XK'],
  'UK': ['GB','GG','JE','IM','GI'],
  'North America': ['US','CA'],
  'Asia-Pacific': ['JP','SG','HK','KR','AU','NZ','TH','MY','ID','PH','TW','IN','CN','VN','KH','MM','LA','BD','LK','PK','NP','MN','FJ','PG','WS','TO','MO'],
  'MENA': ['AE','SA','BH','QA','KW','OM','IL','JO','LB','EG','MA','TN','DZ','IQ','IR','TR','PS','YE','LY','SY'],
  'Africa': ['ZA','NG','KE','GH','MU','SC','TZ','UG','RW','ET','CI','SN','CM','BW','NA','MZ','ZW','MG','MW','ZM'],
  'LATAM': ['BR','AR','MX','CL','CO','PE','EC','UY','PY','BO','VE','CR','GT','HN','NI','DO','SV','PA','CU','HT'],
  'Caribbean & Offshore': ['KY','VG','BS','BM','CW','BB','JM','TT','AG','LC','VC','GD','DM','KN','TC','AI','MS','BZ','SR','GY','AW','SX','BQ','MF','BL'],
};

const ALL_REGION_CODES = new Set(Object.values(REGION_MAP).flat());
const REGION_ORDER: (RegionKey | 'Other')[] = ['Europe', 'UK', 'North America', 'Asia-Pacific', 'MENA', 'Africa', 'LATAM', 'Caribbean & Offshore', 'Other'];

function getRegion(cc: string): RegionKey | 'Other' {
  for (const [region, codes] of Object.entries(REGION_MAP) as [RegionKey, string[]][]) {
    if (codes.includes(cc)) return region;
  }
  return 'Other';
}

/* ── Main ── */

async function main() {
  log(`QA: EntitiesPage VASPs Tab — ${new Date().toISOString()}`);
  log(`Using Supabase service key. Fetching ALL entities...`);
  log('');

  const allRows = await fetchAll();
  log(`  Total rows in DB: ${allRows.length}`);

  // Split into garbage vs safe (mirrors frontend logic)
  const garbage = allRows.filter(r => r.is_garbage === true);
  const safe = allRows.filter(r => r.is_garbage !== true);
  log(`  Garbage: ${garbage.length}, Safe (non-garbage): ${safe.length}`);

  // ─── SECTOR FILTER TESTS ───
  heading('SECTOR FILTER TESTS');

  const crypto = safe.filter(r => r.sector === 'Crypto');
  const payments = safe.filter(r => r.sector === 'Payments');
  const banking = safe.filter(r => r.sector === 'Banking');

  // #1: Total = Crypto + Payments + Banking
  const sectorSum = crypto.length + payments.length + banking.length;
  if (sectorSum === safe.length) {
    pass(1, 'Total non-garbage = Crypto + Payments + Banking', `${safe.length} = ${crypto.length} + ${payments.length} + ${banking.length}`);
  } else {
    fail(1, 'Total non-garbage = Crypto + Payments + Banking',
      `${safe.length}`, `${sectorSum} (Crypto ${crypto.length} + Payments ${payments.length} + Banking ${banking.length})`);
    // Find entities with other sectors
    const otherSectors = safe.filter(r => !['Crypto', 'Payments', 'Banking'].includes(r.sector ?? ''));
    if (otherSectors.length > 0) {
      const sectorSet = new Set(otherSectors.map(r => r.sector));
      log(`         Other sectors found: ${[...sectorSet].join(', ')} (${otherSectors.length} entities)`);
    }
  }

  // #2: Crypto count > 0
  if (crypto.length > 0) {
    pass(2, 'Crypto count > 0', `${crypto.length}`);
  } else {
    fail(2, 'Crypto count > 0', '> 0', '0');
  }

  // #3: Payments count > 0
  if (payments.length > 0) {
    pass(3, 'Payments count > 0', `${payments.length}`);
  } else {
    fail(3, 'Payments count > 0', '> 0', '0');
  }

  // #4: Banking count > 0
  if (banking.length > 0) {
    pass(4, 'Banking count > 0', `${banking.length}`);
  } else {
    fail(4, 'Banking count > 0', '> 0', '0');
  }

  // #5: No entity has sector = NULL (among safe entities)
  const nullSector = safe.filter(r => r.sector === null || r.sector === undefined);
  if (nullSector.length === 0) {
    pass(5, 'No safe entity has sector = NULL');
  } else {
    fail(5, 'No safe entity has sector = NULL', '0', `${nullSector.length} entities with NULL sector`);
    log(`         Sample: ${nullSector.slice(0, 5).map(r => `"${r.name}" (${r.country_code})`).join(', ')}`);
  }

  // #6: No entity has sector outside valid values
  const validSectors = ['Crypto', 'Payments', 'Banking'];
  const invalidSector = safe.filter(r => r.sector && !validSectors.includes(r.sector));
  if (invalidSector.length === 0) {
    pass(6, 'No entity has sector outside [Crypto, Payments, Banking]');
  } else {
    fail(6, 'No entity has sector outside [Crypto, Payments, Banking]',
      '0 invalid', `${invalidSector.length} with invalid sectors: ${[...new Set(invalidSector.map(r => r.sector))].join(', ')}`);
  }

  // #7: Crypto entities — crypto_status should be valid
  const validCryptoStatuses = ['confirmed_crypto', 'crypto_adjacent', 'traditional', 'unknown'];
  const cryptoInvalidStatus = crypto.filter(r => r.crypto_status && !validCryptoStatuses.includes(r.crypto_status));
  if (cryptoInvalidStatus.length === 0) {
    pass(7, 'All Crypto entities have valid crypto_status', `Distribution: ${summarize(crypto, 'crypto_status')}`);
  } else {
    fail(7, 'All Crypto entities have valid crypto_status',
      'All valid', `${cryptoInvalidStatus.length} invalid: ${[...new Set(cryptoInvalidStatus.map(r => r.crypto_status))].join(', ')}`);
  }

  // #8: Banking entities — how many have crypto_status=confirmed_crypto
  const bankingCrypto = banking.filter(r => r.crypto_status === 'confirmed_crypto');
  if (bankingCrypto.length === 0) {
    pass(8, 'No Banking entity has crypto_status=confirmed_crypto');
  } else {
    // This is a warning — some banks legitimately do crypto
    warn(8, 'Banking entities with crypto_status=confirmed_crypto', 
      `${bankingCrypto.length} found. Sample: ${bankingCrypto.slice(0, 5).map(r => `"${r.name}" (${r.country_code})`).join(', ')}`);
  }

  // #9: Payments entities with "bank" or "credit union" in name (possible misclassification)
  const paymentsBankish = payments.filter(r => {
    const n = (r.canonical_name || r.name).toLowerCase();
    return n.includes('bank') || n.includes('credit union') || n.includes('savings');
  });
  if (paymentsBankish.length < 10) {
    pass(9, 'Few Payments entities have bank-like names', `${paymentsBankish.length} found`);
  } else {
    warn(9, 'Payments entities with bank-like names',
      `${paymentsBankish.length} found. Sample: ${paymentsBankish.slice(0, 5).map(r => `"${r.canonical_name || r.name}" (${r.country_code})`).join(', ')}`);
  }

  // #10: Stats query counts match actual filtered counts
  const { count: dbTotal } = await sb.from('entities').select('id', { count: 'exact', head: true }).neq('is_garbage', true);
  const { count: dbCrypto } = await sb.from('entities').select('id', { count: 'exact', head: true }).neq('is_garbage', true).eq('sector', 'Crypto');
  const { count: dbPayments } = await sb.from('entities').select('id', { count: 'exact', head: true }).neq('is_garbage', true).eq('sector', 'Payments');
  const { count: dbBanking } = await sb.from('entities').select('id', { count: 'exact', head: true }).neq('is_garbage', true).eq('sector', 'Banking');

  const statsMatch = dbTotal === safe.length && dbCrypto === crypto.length && dbPayments === payments.length && dbBanking === banking.length;
  if (statsMatch) {
    pass(10, 'Stats query counts match fetched data', `Total=${dbTotal}, Crypto=${dbCrypto}, Payments=${dbPayments}, Banking=${dbBanking}`);
  } else {
    fail(10, 'Stats query counts match fetched data',
      `T=${safe.length} C=${crypto.length} P=${payments.length} B=${banking.length}`,
      `T=${dbTotal} C=${dbCrypto} P=${dbPayments} B=${dbBanking}`);
  }

  // ─── REGION FILTER TESTS ───
  heading('REGION FILTER TESTS');

  // Compute region counts
  const regionCounts: Record<string, number> = {};
  for (const r of REGION_ORDER) regionCounts[r] = 0;
  for (const e of safe) {
    const r = getRegion(e.country_code);
    regionCounts[r] = (regionCounts[r] || 0) + 1;
  }

  // #11: All region counts sum to total
  const regionSum = Object.values(regionCounts).reduce((a, b) => a + b, 0);
  if (regionSum === safe.length) {
    pass(11, 'All region counts sum to total', `${regionSum} = ${safe.length}`);
  } else {
    fail(11, 'All region counts sum to total', `${safe.length}`, `${regionSum}`);
  }

  // #12: Europe region — check EU/EEA codes
  const euCodes = REGION_MAP['Europe'];
  const europeEntities = safe.filter(r => euCodes.includes(r.country_code));
  if (regionCounts['Europe'] === europeEntities.length && europeEntities.length > 0) {
    pass(12, 'Europe region correctly maps EU/EEA codes', `${europeEntities.length} entities, ${new Set(europeEntities.map(r => r.country_code)).size} unique countries`);
  } else {
    fail(12, 'Europe region correctly maps EU/EEA codes', `${europeEntities.length}`, `${regionCounts['Europe']}`);
  }

  // #13: UK region — only GB + Crown Dependencies
  const ukCodes = REGION_MAP['UK'];
  const ukEntities = safe.filter(r => ukCodes.includes(r.country_code));
  const ukCountries = [...new Set(ukEntities.map(r => r.country_code))];
  if (regionCounts['UK'] === ukEntities.length) {
    pass(13, 'UK region maps GB + Crown Dependencies', `${ukEntities.length} entities, codes: ${ukCountries.join(', ')}`);
  } else {
    fail(13, 'UK region maps GB + Crown Dependencies', `${ukEntities.length}`, `${regionCounts['UK']}`);
  }

  // #14: North America — US, CA
  const naCodes = REGION_MAP['North America'];
  const naEntities = safe.filter(r => naCodes.includes(r.country_code));
  if (regionCounts['North America'] === naEntities.length && naEntities.length > 0) {
    pass(14, 'North America = US + CA', `${naEntities.length} entities`);
  } else {
    fail(14, 'North America = US + CA', `>0`, `${naEntities.length}`);
  }

  // #15: MENA — check correct codes
  const menaCodes = REGION_MAP['MENA'];
  const menaEntities = safe.filter(r => menaCodes.includes(r.country_code));
  const menaCountries = [...new Set(menaEntities.map(r => r.country_code))];
  if (menaEntities.length > 0) {
    pass(15, 'MENA region has entities', `${menaEntities.length} entities in ${menaCountries.length} countries: ${menaCountries.join(', ')}`);
  } else {
    warn(15, 'MENA region has entities', 'No MENA entities found');
  }

  // #16: Entities not in any region go to "Other"
  const otherEntities = safe.filter(r => !ALL_REGION_CODES.has(r.country_code));
  if (regionCounts['Other'] === otherEntities.length) {
    pass(16, '"Other" region catches unmatched codes', `${otherEntities.length} entities, codes: ${[...new Set(otherEntities.map(r => r.country_code))].slice(0, 10).join(', ')}`);
  } else {
    fail(16, '"Other" region catches unmatched codes', `${otherEntities.length}`, `${regionCounts['Other']}`);
  }

  // #17: Region with most entities
  const maxRegion = Object.entries(regionCounts).sort((a, b) => b[1] - a[1])[0];
  if (['North America', 'Europe'].includes(maxRegion[0])) {
    pass(17, 'Largest region is North America or Europe', `${maxRegion[0]}: ${maxRegion[1]}`);
  } else {
    warn(17, 'Largest region is not North America or Europe', `${maxRegion[0]}: ${maxRegion[1]}`);
  }

  // #18: Each region should have at least 1 entity (excluding Other)
  const emptyRegions = REGION_ORDER.filter(r => r !== 'Other' && (regionCounts[r] || 0) === 0);
  if (emptyRegions.length === 0) {
    pass(18, 'All defined regions have at least 1 entity', Object.entries(regionCounts).map(([k, v]) => `${k}:${v}`).join(', '));
  } else {
    fail(18, 'All defined regions have at least 1 entity', '0 empty regions', `Empty: ${emptyRegions.join(', ')}`);
  }

  // #19: Asia-Pacific includes expected countries
  const apacCodes = REGION_MAP['Asia-Pacific'];
  const expectedApac = ['JP', 'SG', 'AU', 'HK', 'KR'];
  const apacMissing = expectedApac.filter(c => !apacCodes.includes(c));
  const apacEntities = safe.filter(r => apacCodes.includes(r.country_code));
  if (apacMissing.length === 0 && apacEntities.length > 0) {
    pass(19, 'Asia-Pacific includes JP, SG, AU, HK, KR', `${apacEntities.length} entities`);
  } else {
    fail(19, 'Asia-Pacific includes JP, SG, AU, HK, KR',
      'All present', `Missing: ${apacMissing.join(', ')}, Entities: ${apacEntities.length}`);
  }

  // #20: Africa includes expected countries
  const africaCodes = REGION_MAP['Africa'];
  const expectedAfrica = ['ZA', 'NG', 'KE'];
  const africaMissing = expectedAfrica.filter(c => !africaCodes.includes(c));
  const africaEntities = safe.filter(r => africaCodes.includes(r.country_code));
  if (africaMissing.length === 0 && africaEntities.length > 0) {
    pass(20, 'Africa includes ZA, NG, KE', `${africaEntities.length} entities`);
  } else {
    fail(20, 'Africa includes ZA, NG, KE',
      'All present with entities', `Missing: ${africaMissing.join(', ')}, Entities: ${africaEntities.length}`);
  }

  // ─── DATA QUALITY TESTS ───
  heading('DATA QUALITY TESTS');

  // #21: Every entity has non-empty name
  const emptyName = safe.filter(r => !r.name || r.name.trim() === '');
  if (emptyName.length === 0) {
    pass(21, 'Every entity has non-empty name');
  } else {
    fail(21, 'Every entity has non-empty name', '0 empty', `${emptyName.length} empty names`);
  }

  // #22: Every entity has 2-char country_code
  const badCC = safe.filter(r => !r.country_code || r.country_code.length !== 2);
  if (badCC.length === 0) {
    pass(22, 'Every entity has 2-char country_code');
  } else {
    fail(22, 'Every entity has 2-char country_code', '0 invalid', `${badCC.length} invalid. Sample: ${badCC.slice(0, 5).map(r => `"${r.country_code}"`).join(', ')}`);
  }

  // #23: canonical_name NULL rate
  const nullCanonical = safe.filter(r => r.canonical_name === null || r.canonical_name === undefined);
  const nullPct = ((nullCanonical.length / safe.length) * 100).toFixed(1);
  if (nullCanonical.length / safe.length < 0.05) {
    pass(23, 'canonical_name NULL < 5%', `${nullCanonical.length} null (${nullPct}%)`);
  } else {
    warn(23, 'canonical_name NULL rate', `${nullCanonical.length} null (${nullPct}%) — threshold is 5%`);
  }

  // #24: quality_score stats
  const scores = safe.map(r => r.quality_score).filter((s): s is number => s !== null);
  if (scores.length > 0) {
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((sum, s) => sum + (s - avg) ** 2, 0) / scores.length;
    const stddev = Math.sqrt(variance);
    pass(24, 'quality_score stats', `min=${min}, max=${max}, avg=${avg.toFixed(1)}, stddev=${stddev.toFixed(1)}, scored=${scores.length}/${safe.length}`);
  } else {
    fail(24, 'quality_score stats', 'Some scored entities', '0 entities have quality_score');
  }

  // #25: is_garbage excluded from safe count
  const garbageInSafe = safe.filter(r => r.is_garbage === true);
  if (garbageInSafe.length === 0) {
    pass(25, 'No is_garbage=true entities in safe set', `${garbage.length} garbage properly excluded`);
  } else {
    fail(25, 'No is_garbage=true entities in safe set', '0', `${garbageInSafe.length}`);
  }

  // #26: Check for HTML/script/SQL in names
  const htmlPattern = /<[^>]+>|<script|SELECT\s+\*|INSERT\s+INTO|DROP\s+TABLE/i;
  const htmlNames = safe.filter(r => htmlPattern.test(r.name) || htmlPattern.test(r.canonical_name ?? ''));
  if (htmlNames.length === 0) {
    pass(26, 'No HTML/script/SQL injection in entity names');
  } else {
    fail(26, 'No HTML/script/SQL injection in entity names', '0', `${htmlNames.length}. Sample: ${htmlNames.slice(0, 3).map(r => `"${r.name}"`).join(', ')}`);
  }

  // #27: Check for excessive whitespace
  const whitespaceIssues = safe.filter(r => {
    const n = r.canonical_name || r.name;
    return n !== n.trim() || /\s{2,}/.test(n);
  });
  if (whitespaceIssues.length === 0) {
    pass(27, 'No leading/trailing/excessive whitespace in names');
  } else {
    warn(27, 'Whitespace issues in entity names',
      `${whitespaceIssues.length} found. Sample: ${whitespaceIssues.slice(0, 5).map(r => JSON.stringify(r.canonical_name || r.name)).join(', ')}`);
  }

  // #28: License numbers — obviously invalid
  const invalidLicense = safe.filter(r => {
    if (!r.license_number) return false;
    const l = r.license_number.trim().toLowerCase();
    return ['n/a', 'tbd', 'unknown', 'none', '-', 'na', 'null'].includes(l);
  });
  if (invalidLicense.length === 0) {
    pass(28, 'No obviously invalid license numbers (N/A, TBD, Unknown)');
  } else {
    warn(28, 'Invalid license numbers found',
      `${invalidLicense.length} entities. Sample: ${invalidLicense.slice(0, 5).map(r => `"${r.license_number}" (${r.name})`).join(', ')}`);
  }

  // #29: Website URLs format
  const withWebsite = safe.filter(r => r.website && r.website.trim() !== '');
  const badUrls = withWebsite.filter(r => {
    const w = r.website!.trim();
    return !w.startsWith('http://') && !w.startsWith('https://');
  });
  if (badUrls.length === 0) {
    pass(29, 'All websites start with http:// or https://', `${withWebsite.length} entities have websites`);
  } else {
    warn(29, 'Websites without http(s):// prefix',
      `${badUrls.length} found. Sample: ${badUrls.slice(0, 5).map(r => `"${r.website}"`).join(', ')}`);
  }

  // #30: Status distribution
  const statusDist: Record<string, number> = {};
  for (const e of safe) {
    const s = e.status || 'NULL';
    statusDist[s] = (statusDist[s] || 0) + 1;
  }
  const statusStr = Object.entries(statusDist).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v} (${((v / safe.length) * 100).toFixed(1)}%)`).join(', ');
  pass(30, 'Status distribution', statusStr);

  // #31: Regulator field coverage
  const hasRegulator = safe.filter(r => r.regulator && r.regulator.trim() !== '');
  const regPct = ((hasRegulator.length / safe.length) * 100).toFixed(1);
  pass(31, 'Regulator field coverage', `${hasRegulator.length}/${safe.length} (${regPct}%)`);

  // #32: License type coverage
  const hasLicenseType = safe.filter(r => r.license_type && r.license_type.trim() !== '');
  const ltPct = ((hasLicenseType.length / safe.length) * 100).toFixed(1);
  pass(32, 'License type field coverage', `${hasLicenseType.length}/${safe.length} (${ltPct}%)`);

  // #33: Meaningful descriptions (>50 chars)
  const hasDesc = safe.filter(r => r.description && r.description.trim().length > 50);
  const descPct = ((hasDesc.length / safe.length) * 100).toFixed(1);
  pass(33, 'Entities with meaningful description (>50 chars)', `${hasDesc.length}/${safe.length} (${descPct}%)`);

  // #34: Dead entities still showing as Licensed (business logic concern)
  const deadLicensed = safe.filter(r => r.dns_status === 'dead' && r.status === 'Licensed');
  if (deadLicensed.length === 0) {
    pass(34, 'No dead (dns_status) entities still marked Licensed');
  } else {
    warn(34, 'Dead entities still marked Licensed',
      `${deadLicensed.length} found. Sample: ${deadLicensed.slice(0, 5).map(r => `"${r.canonical_name || r.name}" (${r.country_code})`).join(', ')}`);
  }

  // #35: Garbage sample validation
  if (garbage.length > 0) {
    const sample = garbage.slice(0, 20);
    const garbageNames = sample.map(r => `"${r.name}" [${r.country_code}]`).join('\n         ');
    pass(35, `Garbage entities sample (${garbage.length} total)`, `\n         ${garbageNames}`);
  } else {
    pass(35, 'No garbage entities in DB (unexpected but ok)');
  }

  // ─── CROSS-FILTER TESTS ───
  heading('CROSS-FILTER TESTS');

  function crossFilter(sector: string | null, region: RegionKey | 'Other' | null): EntityRow[] {
    let filtered = safe;
    if (sector) filtered = filtered.filter(r => r.sector === sector);
    if (region) {
      if (region === 'Other') {
        filtered = filtered.filter(r => !ALL_REGION_CODES.has(r.country_code));
      } else {
        const codes = REGION_MAP[region];
        filtered = filtered.filter(r => codes.includes(r.country_code));
      }
    }
    return filtered;
  }

  // #36: Crypto + Europe > 0
  const cryptoEurope = crossFilter('Crypto', 'Europe');
  if (cryptoEurope.length > 0) {
    pass(36, 'Crypto + Europe > 0', `${cryptoEurope.length}`);
  } else {
    fail(36, 'Crypto + Europe > 0', '> 0', '0');
  }

  // #37: Crypto + North America > 0
  const cryptoNA = crossFilter('Crypto', 'North America');
  if (cryptoNA.length > 0) {
    pass(37, 'Crypto + North America > 0', `${cryptoNA.length}`);
  } else {
    fail(37, 'Crypto + North America > 0', '> 0', '0');
  }

  // #38: Banking + Europe — should be 0 (all banking from US-FDIC and GB-PRA)
  const bankingEurope = crossFilter('Banking', 'Europe');
  if (bankingEurope.length === 0) {
    pass(38, 'Banking + Europe = 0 (all banking from US-FDIC, GB-PRA)', '0');
  } else {
    warn(38, 'Banking + Europe count', `${bankingEurope.length} found (expected 0). Countries: ${[...new Set(bankingEurope.map(r => r.country_code))].join(', ')}`);
  }

  // #39: Banking + UK should be ~1200 (GB-PRA)
  const bankingUK = crossFilter('Banking', 'UK');
  if (bankingUK.length > 500 && bankingUK.length < 2000) {
    pass(39, 'Banking + UK ~ 1200 (GB-PRA)', `${bankingUK.length}`);
  } else {
    warn(39, 'Banking + UK count', `${bankingUK.length} (expected ~1200)`);
  }

  // #40: Payments + Europe should be ~4400 (EBA EUCLID)
  const paymentsEurope = crossFilter('Payments', 'Europe');
  if (paymentsEurope.length > 2000) {
    pass(40, 'Payments + Europe > 2000 (EBA EUCLID)', `${paymentsEurope.length}`);
  } else {
    warn(40, 'Payments + Europe count', `${paymentsEurope.length} (expected ~4400)`);
  }

  // #41: Crypto + Africa > 0
  const cryptoAfrica = crossFilter('Crypto', 'Africa');
  if (cryptoAfrica.length > 0) {
    pass(41, 'Crypto + Africa > 0', `${cryptoAfrica.length}`);
  } else {
    warn(41, 'Crypto + Africa', '0 entities found');
  }

  // #42: Crypto + MENA > 0
  const cryptoMENA = crossFilter('Crypto', 'MENA');
  if (cryptoMENA.length > 0) {
    pass(42, 'Crypto + MENA > 0', `${cryptoMENA.length}`);
  } else {
    warn(42, 'Crypto + MENA', '0 entities found');
  }

  // #43: Payments + North America — should be low or 0
  const paymentsNA = crossFilter('Payments', 'North America');
  if (paymentsNA.length < 50) {
    pass(43, 'Payments + North America is low', `${paymentsNA.length} (expected low — no EBA in US/CA)`);
  } else {
    warn(43, 'Payments + North America unexpectedly high', `${paymentsNA.length}`);
  }

  // #44: Caribbean & Offshore — entities exist
  const caribAll = crossFilter(null, 'Caribbean & Offshore');
  if (caribAll.length > 0) {
    pass(44, 'Caribbean & Offshore has entities', `${caribAll.length} — countries: ${[...new Set(caribAll.map(r => r.country_code))].join(', ')}`);
  } else {
    warn(44, 'Caribbean & Offshore', '0 entities found');
  }

  // #45: Search "binance" across entities
  const binance = safe.filter(r => {
    const n = (r.canonical_name || r.name).toLowerCase();
    return n.includes('binance');
  });
  if (binance.length > 0) {
    const binanceCountries = [...new Set(binance.map(r => r.country_code))];
    if (binanceCountries.length > 1) {
      pass(45, 'Search "binance" returns entities in multiple countries', `${binance.length} entities in ${binanceCountries.length} countries: ${binanceCountries.join(', ')}`);
    } else {
      pass(45, 'Search "binance" returns entities', `${binance.length} entities in ${binanceCountries.join(', ')}`);
    }
  } else {
    warn(45, 'Search "binance"', 'No entities found');
  }

  // ─── EDGE CASE TESTS ───
  heading('EDGE CASE TESTS');

  // #46: Longest entity name
  const longestEntity = safe.reduce((max, r) => {
    const n = r.canonical_name || r.name;
    return n.length > (max.canonical_name || max.name).length ? r : max;
  }, safe[0]);
  const longestName = longestEntity.canonical_name || longestEntity.name;
  if (longestName.length < 300) {
    pass(46, 'Longest entity name is reasonable', `${longestName.length} chars: "${longestName.substring(0, 100)}${longestName.length > 100 ? '...' : ''}"`);
  } else {
    warn(46, 'Longest entity name is very long', `${longestName.length} chars: "${longestName.substring(0, 100)}..."`);
  }

  // #47: Country with most entities
  const countryCounts: Record<string, number> = {};
  for (const e of safe) countryCounts[e.country_code] = (countryCounts[e.country_code] || 0) + 1;
  const topCountry = Object.entries(countryCounts).sort((a, b) => b[1] - a[1])[0];
  if (topCountry[1] < 10000) {
    pass(47, 'Country with most entities is reasonable', `${topCountry[0]}: ${topCountry[1]} entities`);
  } else {
    warn(47, 'Country with most entities is very high', `${topCountry[0]}: ${topCountry[1]}`);
  }

  // #48: Entity with quality_score=0
  const zeroScore = safe.filter(r => r.quality_score === 0);
  if (zeroScore.length === 0) {
    pass(48, 'No entity has quality_score = 0');
  } else {
    const sample = zeroScore.slice(0, 5).map(r => `"${r.canonical_name || r.name}" (${r.country_code})`).join(', ');
    warn(48, 'Entities with quality_score = 0', `${zeroScore.length} found. Sample: ${sample}`);
  }

  // #49: Entities where canonical_name differs significantly from name
  const significantDiff = safe.filter(r => {
    if (!r.canonical_name) return false;
    const cn = r.canonical_name.toLowerCase();
    const n = r.name.toLowerCase();
    // Check if they differ by more than just case/whitespace
    return cn.replace(/\s+/g, '') !== n.replace(/\s+/g, '') && cn.length > 0;
  });
  const diffPct = ((significantDiff.length / safe.length) * 100).toFixed(1);
  pass(49, 'Entities with significantly different canonical_name', `${significantDiff.length} (${diffPct}%). Sample: ${significantDiff.slice(0, 3).map(r => `"${r.name}" -> "${r.canonical_name}"`).join('; ')}`);

  // #50: Entities with emojis or special unicode
  const emojiPattern = /[\u{1F600}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F000}-\u{1FFFF}]/u;
  const emojiEntities = safe.filter(r => {
    const n = r.canonical_name || r.name;
    return emojiPattern.test(n);
  });
  if (emojiEntities.length === 0) {
    pass(50, 'No entities with emojis in name');
  } else {
    warn(50, 'Entities with emojis in name', `${emojiEntities.length}. Sample: ${emojiEntities.slice(0, 5).map(r => `"${r.canonical_name || r.name}"`).join(', ')}`);
  }

  // ─── ADDITIONAL TESTS (51-55) ───
  heading('ADDITIONAL TESTS');

  // #51: Every country_code maps to a non-empty country name
  const emptyCountryName = safe.filter(r => !r.country || r.country.trim() === '');
  if (emptyCountryName.length === 0) {
    pass(51, 'Every entity has non-empty country name');
  } else {
    fail(51, 'Every entity has non-empty country name', '0', `${emptyCountryName.length} empty`);
  }

  // #52: No duplicate IDs
  const idSet = new Set(safe.map(r => r.id));
  if (idSet.size === safe.length) {
    pass(52, 'No duplicate entity IDs');
  } else {
    fail(52, 'No duplicate entity IDs', `${safe.length}`, `${idSet.size} unique (${safe.length - idSet.size} duplicates)`);
  }

  // #53: Parser coverage — how many distinct parser_ids
  const parserIds = [...new Set(safe.map(r => r.parser_id).filter(Boolean))];
  if (parserIds.length > 10) {
    pass(53, 'Multiple parser sources', `${parserIds.length} distinct parsers: ${parserIds.join(', ')}`);
  } else {
    warn(53, 'Few parser sources', `Only ${parserIds.length}: ${parserIds.join(', ')}`);
  }

  // #54: LATAM region entities
  const latamEntities = crossFilter(null, 'LATAM');
  const latamCountries = [...new Set(latamEntities.map(r => r.country_code))];
  if (latamEntities.length > 0) {
    pass(54, 'LATAM region has entities', `${latamEntities.length} in ${latamCountries.length} countries: ${latamCountries.join(', ')}`);
  } else {
    warn(54, 'LATAM region', '0 entities found');
  }

  // #55: Cross-filter: region counts recalculated per sector match frontend logic
  log('');
  log('  #55: Cross-filter region counts per sector (mimics EntitiesPage):');
  for (const sector of ['Crypto', 'Payments', 'Banking'] as const) {
    const sectorEntities = safe.filter(r => r.sector === sector);
    const sectorRegionCounts: Record<string, number> = {};
    for (const r of REGION_ORDER) sectorRegionCounts[r] = 0;
    for (const e of sectorEntities) {
      const r = getRegion(e.country_code);
      sectorRegionCounts[r] = (sectorRegionCounts[r] || 0) + 1;
    }
    const regionStr = Object.entries(sectorRegionCounts)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${k}:${v}`)
      .join(', ');
    const sumCheck = Object.values(sectorRegionCounts).reduce((a, b) => a + b, 0);
    const match = sumCheck === sectorEntities.length;
    if (match) {
      log(`    [PASS] ${sector}: ${sectorEntities.length} total = ${regionStr}`);
      passCount++;
    } else {
      log(`    [FAIL] ${sector}: sum ${sumCheck} != ${sectorEntities.length}. ${regionStr}`);
      failCount++;
    }
  }

  // ─── SUMMARY ───
  heading('SUMMARY');

  const total = passCount + failCount + warnCount;
  log(`  Tests run:   ${total}`);
  log(`  PASS:        ${passCount}`);
  log(`  FAIL:        ${failCount}`);
  log(`  WARN:        ${warnCount}`);
  log('');

  if (failCount === 0) {
    log('  *** ALL TESTS PASSED (some warnings may need attention) ***');
  } else {
    log(`  *** ${failCount} TEST(S) FAILED — review above ***`);
  }

  log('');
  log(`  Data snapshot: ${safe.length} safe entities, ${garbage.length} garbage, ${allRows.length} total`);
  log(`  Sectors: Crypto=${crypto.length}, Payments=${payments.length}, Banking=${banking.length}`);
  log(`  Regions: ${Object.entries(regionCounts).map(([k, v]) => `${k}=${v}`).join(', ')}`);

  // Write results
  const output = lines.join('\n');
  fs.writeFileSync('/tmp/qa-entities-vasps.txt', output, 'utf-8');
  log('');
  log('  Results written to /tmp/qa-entities-vasps.txt');
}

/* ── Helpers ── */

function summarize(rows: EntityRow[], field: keyof EntityRow): string {
  const dist: Record<string, number> = {};
  for (const r of rows) {
    const v = String(r[field] ?? 'NULL');
    dist[v] = (dist[v] || 0) + 1;
  }
  return Object.entries(dist).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(', ');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
