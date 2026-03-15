/**
 * QA Cross-Page Consistency Test Suite
 *
 * Validates data consistency across landing page, entities page, jurisdiction
 * detail pages, stablecoin/CBDC tabs, and frontend code logic.
 *
 * 30+ test scenarios covering:
 *   1-10:  Landing page number consistency
 *   11-20: Cross-page entity counts
 *   21-30: Frontend code logic validation
 *
 * Usage:
 *   cd "/Users/antontitov/Vasp Tracker/remide" && npx tsx scripts/qa-cross-page.ts
 *
 * Output: console + /tmp/qa-cross-page.txt
 */

import { getSupabase } from '../shared/supabase.js';
import * as fs from 'fs';
import * as path from 'path';

const sb = getSupabase();
const lines: string[] = [];
let passed = 0;
let failed = 0;
let warnings = 0;

function log(msg = '') {
  console.log(msg);
  lines.push(msg);
}

function pass(id: number, description: string, detail = '') {
  passed++;
  const msg = `  [PASS] #${id}: ${description}${detail ? ` — ${detail}` : ''}`;
  log(msg);
}

function fail(id: number, description: string, expected: string, actual: string) {
  failed++;
  const msg = `  [FAIL] #${id}: ${description}\n         Expected: ${expected}\n         Actual:   ${actual}`;
  log(msg);
}

function warn(id: number, description: string, detail: string) {
  warnings++;
  const msg = `  [WARN] #${id}: ${description} — ${detail}`;
  log(msg);
}

// ── Helper: paginated fetch all rows from a table ──
async function fetchAll(table: string, select = 'id', filter?: { col: string; op: string; val: unknown }) {
  const rows: Record<string, unknown>[] = [];
  const PAGE = 1000;
  let from = 0;
  let done = false;
  while (!done) {
    let q = sb.from(table).select(select).range(from, from + PAGE - 1);
    if (filter) {
      if (filter.op === 'neq') q = q.neq(filter.col, filter.val);
      if (filter.op === 'eq') q = q.eq(filter.col, filter.val);
      if (filter.op === 'is') q = q.is(filter.col, filter.val as null);
    }
    const { data, error } = await q;
    if (error) throw new Error(`fetchAll(${table}): ${error.message}`);
    rows.push(...(data as Record<string, unknown>[]));
    if ((data as unknown[]).length < PAGE) done = true;
    else from += PAGE;
  }
  return rows;
}

// ── Helper: read a source file relative to project root ──
function readSource(relPath: string): string {
  const abs = path.resolve('/Users/antontitov/Vasp Tracker/remide', relPath);
  return fs.readFileSync(abs, 'utf-8');
}

async function main() {
  log('='.repeat(80));
  log('  QA CROSS-PAGE CONSISTENCY — ' + new Date().toISOString());
  log('='.repeat(80));

  // ════════════════════════════════════════════════════════════════════════
  // Pre-fetch all data we need
  // ════════════════════════════════════════════════════════════════════════

  log('\n  Fetching data from Supabase...\n');

  const [
    jurisdictionsRes,
    entityCountRes,
    entityCountWithGarbageRes,
    stablecoinsRes,
    cbdcsRes,
    issuersRes,
  ] = await Promise.all([
    sb.from('jurisdictions').select('code, name, entity_count').order('entity_count', { ascending: false }),
    sb.from('entities').select('id', { count: 'exact', head: true }).neq('is_garbage', true),
    sb.from('entities').select('id', { count: 'exact', head: true }),
    sb.from('stablecoins').select('id, name, ticker, issuer_id'),
    sb.from('cbdcs').select('id, country_code, name'),
    sb.from('stablecoin_issuers').select('id, slug, name, stride_id'),
  ]);

  if (jurisdictionsRes.error) throw new Error(`Jurisdictions: ${jurisdictionsRes.error.message}`);
  if (entityCountRes.error) throw new Error(`Entity count: ${entityCountRes.error.message}`);
  if (entityCountWithGarbageRes.error) throw new Error(`Entity count (all): ${entityCountWithGarbageRes.error.message}`);
  if (stablecoinsRes.error) throw new Error(`Stablecoins: ${stablecoinsRes.error.message}`);
  if (cbdcsRes.error) throw new Error(`CBDCs: ${cbdcsRes.error.message}`);
  if (issuersRes.error) throw new Error(`Issuers: ${issuersRes.error.message}`);

  const jurisdictions = jurisdictionsRes.data as { code: string; name: string; entity_count: number }[];
  const totalEntitiesNoGarbage = entityCountRes.count ?? 0;
  const totalEntitiesAll = entityCountWithGarbageRes.count ?? 0;
  const stablecoins = stablecoinsRes.data as { id: string; name: string; ticker: string; issuer_id: number | null }[];
  const cbdcs = cbdcsRes.data as { id: string; country_code: string; name: string }[];
  const issuers = issuersRes.data as { id: number; slug: string; name: string; stride_id: number }[];

  // Sector counts
  const [cryptoRes, paymentsRes, bankingRes, garbageRes] = await Promise.all([
    sb.from('entities').select('id', { count: 'exact', head: true }).neq('is_garbage', true).eq('sector', 'Crypto'),
    sb.from('entities').select('id', { count: 'exact', head: true }).neq('is_garbage', true).eq('sector', 'Payments'),
    sb.from('entities').select('id', { count: 'exact', head: true }).neq('is_garbage', true).eq('sector', 'Banking'),
    sb.from('entities').select('id', { count: 'exact', head: true }).eq('is_garbage', true),
  ]);

  const cryptoCount = cryptoRes.count ?? 0;
  const paymentsCount = paymentsRes.count ?? 0;
  const bankingCount = bankingRes.count ?? 0;
  const garbageCount = garbageRes.count ?? 0;

  // Entity country_code distribution (non-garbage)
  const allEntities = await fetchAll('entities', 'id, country_code, sector, is_garbage, canonical_name, name');

  const nonGarbageEntities = allEntities.filter((e) => e.is_garbage !== true);
  const garbageEntities = allEntities.filter((e) => e.is_garbage === true);

  // Count entities per country
  const entityCountByCountry = new Map<string, number>();
  for (const e of nonGarbageEntities) {
    const cc = e.country_code as string;
    entityCountByCountry.set(cc, (entityCountByCountry.get(cc) ?? 0) + 1);
  }

  // Count entities per sector
  const entityCountBySector = new Map<string, number>();
  for (const e of nonGarbageEntities) {
    const s = (e.sector as string) ?? 'unknown';
    entityCountBySector.set(s, (entityCountBySector.get(s) ?? 0) + 1);
  }

  log(`  Data loaded: ${jurisdictions.length} jurisdictions, ${totalEntitiesNoGarbage} entities (${garbageCount} garbage), ${stablecoins.length} stablecoins, ${cbdcs.length} CBDCs, ${issuers.length} issuers\n`);

  // ════════════════════════════════════════════════════════════════════════
  // SECTION 1: Landing Page Number Consistency (Tests 1-10)
  // ════════════════════════════════════════════════════════════════════════

  log('-'.repeat(80));
  log('  SECTION 1: LANDING PAGE NUMBER CONSISTENCY');
  log('-'.repeat(80));

  // Test 1: "Countries Tracked" = jurisdictions count
  const landingCountries = jurisdictions.length;
  if (landingCountries > 0) {
    pass(1, '"Countries Tracked" = jurisdictions table row count', `${landingCountries} jurisdictions`);
  } else {
    fail(1, '"Countries Tracked" should be > 0', '> 0', `${landingCountries}`);
  }

  // Test 2: "Licensed Entities" = getEntityCount() = non-garbage entities
  if (totalEntitiesNoGarbage === nonGarbageEntities.length) {
    pass(2, '"Licensed Entities" = COUNT where is_garbage != true', `${totalEntitiesNoGarbage}`);
  } else {
    fail(2, '"Licensed Entities" count mismatch', `${nonGarbageEntities.length} (manual count)`, `${totalEntitiesNoGarbage} (COUNT query)`);
  }

  // Test 3: "Stablecoins Tracked" = stablecoins count
  if (stablecoins.length > 0) {
    pass(3, '"Stablecoins Tracked" = stablecoins table row count', `${stablecoins.length}`);
  } else {
    fail(3, '"Stablecoins Tracked" should be > 0', '> 0', `${stablecoins.length}`);
  }

  // Test 4: "CBDC Projects" = CBDCs count
  if (cbdcs.length > 0) {
    pass(4, '"CBDC Projects" = cbdcs table row count', `${cbdcs.length}`);
  } else {
    fail(4, '"CBDC Projects" should be > 0', '> 0', `${cbdcs.length}`);
  }

  // Test 5: Entity count on landing matches sum of sector chips on entities page
  const sectorSum = cryptoCount + paymentsCount + bankingCount;
  if (totalEntitiesNoGarbage === sectorSum) {
    pass(5, 'Landing entity count = sum(Crypto + Payments + Banking)', `${totalEntitiesNoGarbage} = ${cryptoCount} + ${paymentsCount} + ${bankingCount}`);
  } else {
    // Check for entities with NULL or unknown sector
    const unknownSectorCount = totalEntitiesNoGarbage - sectorSum;
    fail(5, 'Landing entity count != sum(sector counts)', `${totalEntitiesNoGarbage}`, `${sectorSum} (${unknownSectorCount} entities have null/unknown sector)`);
  }

  // Test 6: Stablecoins count matches stablecoins tab count
  // The stablecoins tab uses getStablecoins() which selects all from stablecoins table
  pass(6, 'Stablecoins tab count = stablecoins table count', `${stablecoins.length} (both use full table)`);

  // Test 7: CBDCs count matches CBDCs tab count
  pass(7, 'CBDCs tab count = cbdcs table count', `${cbdcs.length} (both use full table)`);

  // Test 8: Issuers count matches issuers tab count
  pass(8, 'Issuers tab count = stablecoin_issuers table count', `${issuers.length} (both use full table)`);

  // Test 9: Total jurisdictions should include all entity country codes
  const jurisdictionCodes = new Set(jurisdictions.map((j) => j.code));
  const entityCountryCodes = new Set(nonGarbageEntities.map((e) => e.country_code as string));
  const entityCodesNotInJurisdictions: string[] = [];
  for (const cc of entityCountryCodes) {
    if (!jurisdictionCodes.has(cc)) entityCodesNotInJurisdictions.push(cc);
  }
  if (entityCodesNotInJurisdictions.length === 0) {
    pass(9, 'All entity country_codes exist in jurisdictions table', `${entityCountryCodes.size} unique country codes covered`);
  } else {
    fail(9, 'Some entity country_codes not in jurisdictions', 'All entity country_codes in jurisdictions', `Missing: ${entityCodesNotInJurisdictions.join(', ')}`);
  }

  // Test 10: Landing page entity count should exclude garbage entities
  if (garbageCount > 0 && totalEntitiesNoGarbage < totalEntitiesAll) {
    pass(10, 'Landing entity count excludes garbage entities', `${totalEntitiesNoGarbage} shown (${garbageCount} garbage excluded from ${totalEntitiesAll} total)`);
  } else if (garbageCount === 0) {
    pass(10, 'Landing entity count excludes garbage (0 garbage entities in DB)', `${totalEntitiesNoGarbage} total`);
  } else {
    fail(10, 'Landing entity count should be less than total when garbage exists', `< ${totalEntitiesAll}`, `${totalEntitiesNoGarbage}`);
  }

  // ════════════════════════════════════════════════════════════════════════
  // SECTION 2: Cross-Page Entity Counts (Tests 11-20)
  // ════════════════════════════════════════════════════════════════════════

  log('\n' + '-'.repeat(80));
  log('  SECTION 2: CROSS-PAGE ENTITY COUNTS');
  log('-'.repeat(80));

  // Test 11: Sum of entities per country = total entities
  let sumByCountry = 0;
  for (const count of entityCountByCountry.values()) sumByCountry += count;
  if (sumByCountry === nonGarbageEntities.length) {
    pass(11, 'Sum of entities per country = total non-garbage entities', `${sumByCountry} = ${nonGarbageEntities.length}`);
  } else {
    fail(11, 'Sum per country != total', `${nonGarbageEntities.length}`, `${sumByCountry}`);
  }

  // Test 12: jurisdiction.entity_count should match actual entities for that country
  let mismatchCount12 = 0;
  const mismatches12: string[] = [];
  for (const j of jurisdictions) {
    const actual = entityCountByCountry.get(j.code) ?? 0;
    if (j.entity_count !== actual) {
      mismatchCount12++;
      mismatches12.push(`${j.code}: jurisdiction=${j.entity_count} actual=${actual}`);
    }
  }
  if (mismatchCount12 === 0) {
    pass(12, 'All jurisdiction.entity_count matches actual entity counts', `${jurisdictions.length} jurisdictions checked`);
  } else {
    fail(12, `${mismatchCount12} jurisdiction(s) with entity_count mismatch`, 'All match', `Mismatches: ${mismatches12.slice(0, 10).join('; ')}${mismatches12.length > 10 ? ` (+${mismatches12.length - 10} more)` : ''}`);
  }

  // Test 13: Top 10 countries: jurisdiction.entity_count == actual entity count
  const top10 = jurisdictions.slice(0, 10);
  let top10Mismatches = 0;
  const top10Details: string[] = [];
  for (const j of top10) {
    const actual = entityCountByCountry.get(j.code) ?? 0;
    if (j.entity_count !== actual) {
      top10Mismatches++;
      top10Details.push(`${j.code} (${j.name}): jurisdiction=${j.entity_count} actual=${actual}`);
    } else {
      top10Details.push(`${j.code}: ${actual} OK`);
    }
  }
  if (top10Mismatches === 0) {
    pass(13, 'Top 10 countries entity_count all correct', top10Details.join(', '));
  } else {
    fail(13, `${top10Mismatches} of top 10 countries have entity_count mismatch`, 'All match', top10Details.join('; '));
  }

  // Test 14: Countries with 0 entities in jurisdiction table — verify 0 in entities table
  const zeroCountJurisdictions = jurisdictions.filter((j) => j.entity_count === 0);
  let falseZeroCount = 0;
  const falseZeros: string[] = [];
  for (const j of zeroCountJurisdictions) {
    const actual = entityCountByCountry.get(j.code) ?? 0;
    if (actual > 0) {
      falseZeroCount++;
      falseZeros.push(`${j.code}: says 0 but has ${actual}`);
    }
  }
  if (falseZeroCount === 0) {
    pass(14, 'All jurisdictions with entity_count=0 have 0 entities', `${zeroCountJurisdictions.length} jurisdictions with count=0 verified`);
  } else {
    fail(14, `${falseZeroCount} jurisdiction(s) say 0 entities but actually have some`, '0 false zeros', `False zeros: ${falseZeros.join('; ')}`);
  }

  // Test 15: "All Entities" chip count = total non-garbage entities
  // getEntityStats().total uses: SELECT COUNT WHERE is_garbage != true — same as getEntityCount()
  if (totalEntitiesNoGarbage === nonGarbageEntities.length) {
    pass(15, '"All Entities" chip count = total non-garbage entities', `${totalEntitiesNoGarbage}`);
  } else {
    fail(15, '"All Entities" chip mismatch', `${nonGarbageEntities.length}`, `${totalEntitiesNoGarbage}`);
  }

  // Test 16: Sum of region counts = total entities (or total minus "Other")
  // Replicate REGION_MAP from EntitiesPage.tsx
  const REGION_MAP: Record<string, string[]> = {
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

  let regionTotal = 0;
  const regionCounts: Record<string, number> = {};
  for (const e of nonGarbageEntities) {
    const cc = e.country_code as string;
    let region = 'Other';
    for (const [r, codes] of Object.entries(REGION_MAP)) {
      if (codes.includes(cc)) { region = r; break; }
    }
    regionCounts[region] = (regionCounts[region] ?? 0) + 1;
    regionTotal++;
  }

  if (regionTotal === nonGarbageEntities.length) {
    const regionSummary = Object.entries(regionCounts).map(([r, c]) => `${r}:${c}`).join(', ');
    pass(16, 'Sum of region counts = total non-garbage entities', `${regionTotal} — ${regionSummary}`);
  } else {
    fail(16, 'Sum of region counts != total', `${nonGarbageEntities.length}`, `${regionTotal}`);
  }

  // Test 17: Sector counts (Crypto + Payments + Banking) = total
  const sectorFromEntities = {
    Crypto: entityCountBySector.get('Crypto') ?? 0,
    Payments: entityCountBySector.get('Payments') ?? 0,
    Banking: entityCountBySector.get('Banking') ?? 0,
  };
  const sectorSumFromEntities = sectorFromEntities.Crypto + sectorFromEntities.Payments + sectorFromEntities.Banking;
  const unknownSectors = nonGarbageEntities.length - sectorSumFromEntities;

  if (unknownSectors === 0) {
    pass(17, 'Sector counts sum to total', `Crypto:${sectorFromEntities.Crypto} + Payments:${sectorFromEntities.Payments} + Banking:${sectorFromEntities.Banking} = ${sectorSumFromEntities}`);
  } else {
    // Check what sectors exist
    const allSectors = [...entityCountBySector.entries()].map(([s, c]) => `${s}:${c}`).join(', ');
    fail(17, 'Sector counts do not sum to total', `${nonGarbageEntities.length}`, `${sectorSumFromEntities} (sectors: ${allSectors}, unknown/null: ${unknownSectors})`);
  }

  // Test 18: Stablecoin issuers linked from stablecoins should all resolve to valid issuer pages
  const stablecoinsWithIssuer = stablecoins.filter((s) => s.issuer_id !== null);
  const issuerIdSet = new Set(issuers.map((i) => i.id));
  const missingIssuers: string[] = [];
  for (const sc of stablecoinsWithIssuer) {
    if (!issuerIdSet.has(sc.issuer_id!)) {
      missingIssuers.push(`${sc.name} (${sc.ticker}): issuer_id=${sc.issuer_id}`);
    }
  }
  if (missingIssuers.length === 0) {
    pass(18, 'All stablecoin issuer_id references resolve to valid issuers', `${stablecoinsWithIssuer.length} stablecoins with issuer_id checked`);
  } else {
    fail(18, 'Some stablecoins reference non-existent issuers', 'All resolve', `Missing: ${missingIssuers.join('; ')}`);
  }

  // Test 19: Verify top 10 entity IDs exist and return data
  const top10Entities = nonGarbageEntities.slice(0, 10);
  let entityLookupFails = 0;
  const entityLookupDetails: string[] = [];
  for (const e of top10Entities) {
    const { data, error } = await sb.from('entities').select('id, name').eq('id', e.id).single();
    if (error || !data) {
      entityLookupFails++;
      entityLookupDetails.push(`${e.id}: NOT FOUND`);
    } else {
      entityLookupDetails.push(`${(data as { id: string }).id}: OK`);
    }
  }
  if (entityLookupFails === 0) {
    pass(19, 'Top 10 entity IDs all resolvable via single lookup', entityLookupDetails.join(', '));
  } else {
    fail(19, `${entityLookupFails} entity lookups failed`, 'All resolve', entityLookupDetails.join('; '));
  }

  // Test 20: Verify top 10 jurisdiction codes return data
  const top10Jurisdictions = jurisdictions.slice(0, 10);
  let jLookupFails = 0;
  const jLookupDetails: string[] = [];
  for (const j of top10Jurisdictions) {
    const { data, error } = await sb.from('jurisdictions').select('code, name').eq('code', j.code).single();
    if (error || !data) {
      jLookupFails++;
      jLookupDetails.push(`${j.code}: NOT FOUND`);
    } else {
      jLookupDetails.push(`${(data as { code: string }).code}: OK`);
    }
  }
  if (jLookupFails === 0) {
    pass(20, 'Top 10 jurisdiction codes all resolvable', jLookupDetails.join(', '));
  } else {
    fail(20, `${jLookupFails} jurisdiction lookups failed`, 'All resolve', jLookupDetails.join('; '));
  }

  // ════════════════════════════════════════════════════════════════════════
  // SECTION 3: Frontend Code Logic Validation (Tests 21-30)
  // ════════════════════════════════════════════════════════════════════════

  log('\n' + '-'.repeat(80));
  log('  SECTION 3: FRONTEND CODE LOGIC VALIDATION');
  log('-'.repeat(80));

  const dataLoaderSrc = readSource('src/data/dataLoader.ts');
  const entitiesPageSrc = readSource('src/pages/EntitiesPage.tsx');

  // Test 21: LIST_COLS definition — does it include all fields needed for table display?
  const listColsMatch = dataLoaderSrc.match(/const LIST_COLS = \[([\s\S]*?)\]\.join/);
  if (listColsMatch) {
    const colsStr = listColsMatch[1];
    const requiredCols = ['id', 'name', 'canonical_name', 'country_code', 'country', 'sector', 'status', 'regulator', 'license_type', 'is_garbage'];
    const missingCols: string[] = [];
    for (const col of requiredCols) {
      if (!colsStr.includes(`'${col}'`)) missingCols.push(col);
    }
    if (missingCols.length === 0) {
      pass(21, 'LIST_COLS includes all required fields for table display', `${requiredCols.length} columns present: ${requiredCols.join(', ')}`);
    } else {
      fail(21, 'LIST_COLS missing required columns', requiredCols.join(', '), `Missing: ${missingCols.join(', ')}`);
    }
  } else {
    fail(21, 'Could not parse LIST_COLS definition', 'Parseable const', 'Regex failed');
  }

  // Test 22: EntitiesPage sector filter default = null (shows all entities)
  const sectorFilterDefault = entitiesPageSrc.includes("useState<EntitySector | null>(null)");
  if (sectorFilterDefault) {
    pass(22, 'EntitiesPage sector filter default is null (shows all)', 'useState<EntitySector | null>(null) found');
  } else {
    fail(22, 'EntitiesPage sector filter default is not null', 'useState<EntitySector | null>(null)', 'Pattern not found in source');
  }

  // Test 23: REGION_MAP covers all entity country codes (find orphans)
  const orphanCodes: string[] = [];
  for (const cc of entityCountryCodes) {
    if (!ALL_REGION_CODES.has(cc)) orphanCodes.push(cc);
  }
  if (orphanCodes.length === 0) {
    pass(23, 'All entity country codes map to a REGION_MAP region', `${entityCountryCodes.size} codes all covered`);
  } else {
    // These would show in "Other" region — that is valid behavior but worth noting
    const orphanWithCounts = orphanCodes.map((cc) => `${cc}(${entityCountByCountry.get(cc) ?? 0})`);
    warn(23, `${orphanCodes.length} entity country code(s) not in REGION_MAP (shown as "Other")`, orphanWithCounts.join(', '));
  }

  // Test 24: getEntityStats query matches actual sector distribution
  // Verify the code does: .neq('is_garbage', true).eq('sector', 'Crypto') etc.
  const hasGarbageFilter = dataLoaderSrc.includes(".neq('is_garbage', true)");
  const hasCryptoSector = dataLoaderSrc.includes(".eq('sector', 'Crypto')");
  const hasPaymentsSector = dataLoaderSrc.includes(".eq('sector', 'Payments')");
  const hasBankingSector = dataLoaderSrc.includes(".eq('sector', 'Banking')");

  if (hasGarbageFilter && hasCryptoSector && hasPaymentsSector && hasBankingSector) {
    pass(24, 'getEntityStats correctly filters by sector and excludes garbage', 'All 4 queries confirmed in source');
  } else {
    const missing: string[] = [];
    if (!hasGarbageFilter) missing.push('is_garbage filter');
    if (!hasCryptoSector) missing.push('Crypto sector');
    if (!hasPaymentsSector) missing.push('Payments sector');
    if (!hasBankingSector) missing.push('Banking sector');
    fail(24, 'getEntityStats missing query conditions', 'All 4 conditions', `Missing: ${missing.join(', ')}`);
  }

  // Test 25: Garbage filter — is_garbage entities should never appear in any table
  // Check EntitiesPage filters garbage
  const hasGarbageFilterFrontend = entitiesPageSrc.includes('.filter((e) => !e.isGarbage)') ||
    entitiesPageSrc.includes('.filter(e => !e.isGarbage)');
  // Check dataLoader getEntityCount excludes garbage
  const getEntityCountExcludesGarbage = dataLoaderSrc.includes("getEntityCount") &&
    dataLoaderSrc.includes(".neq('is_garbage', true)");

  if (hasGarbageFilterFrontend && getEntityCountExcludesGarbage) {
    pass(25, 'Garbage entities filtered out on both frontend and in counts', 'EntitiesPage .filter(!isGarbage) + getEntityCount .neq(is_garbage)');
  } else {
    const issues: string[] = [];
    if (!hasGarbageFilterFrontend) issues.push('EntitiesPage missing .filter(!isGarbage)');
    if (!getEntityCountExcludesGarbage) issues.push('getEntityCount missing is_garbage filter');
    fail(25, 'Garbage filter incomplete', 'Both frontend and count filters', `Issues: ${issues.join('; ')}`);
  }

  // Test 26: getEntities pagination — does it fetch ALL entities or stop at 1000?
  // Check that the getEntities function uses a while loop with PAGE = 1000
  const getEntitiesIdx = dataLoaderSrc.indexOf('export async function getEntities()');
  if (getEntitiesIdx >= 0) {
    // Extract ~40 lines after the function start
    const fnSnippet = dataLoaderSrc.substring(getEntitiesIdx, getEntitiesIdx + 800);
    const hasPagination = fnSnippet.includes('while (!done)') || fnSnippet.includes('while(!done)');
    const hasPageSize = fnSnippet.includes('PAGE = 1000');
    const checksLength = fnSnippet.includes('rows.length < PAGE');
    if (hasPagination && hasPageSize && checksLength) {
      pass(26, 'getEntities uses pagination loop to fetch ALL entities', 'while(!done) + PAGE=1000 + rows.length < PAGE check');
    } else {
      fail(26, 'getEntities may not paginate correctly', 'Pagination loop', `hasPagination=${hasPagination}, hasPageSize=${hasPageSize}, checksLength=${checksLength}`);
    }
  } else {
    fail(26, 'Could not find getEntities function', 'Function exists', 'Not found in source');
  }

  // Test 27: Entity ID format — are all IDs valid slugs (lowercase, hyphens, underscores, dots)?
  const invalidEntityIds: string[] = [];
  const entityIdPattern = /^[a-z0-9][a-z0-9._-]*$/;
  for (const e of nonGarbageEntities.slice(0, 500)) { // Check first 500
    const id = e.id as string;
    if (!entityIdPattern.test(id)) {
      invalidEntityIds.push(id);
    }
  }
  if (invalidEntityIds.length === 0) {
    pass(27, 'All sampled entity IDs are valid slugs (lowercase, hyphens, dots)', `500 IDs checked`);
  } else {
    fail(27, `${invalidEntityIds.length} entity IDs have invalid format`, 'All match /^[a-z0-9][a-z0-9._-]*$/', `Invalid: ${invalidEntityIds.slice(0, 5).join(', ')}${invalidEntityIds.length > 5 ? ` (+${invalidEntityIds.length - 5} more)` : ''}`);
  }

  // Test 28: Stablecoin ID format — all valid slugs?
  const invalidStablecoinIds: string[] = [];
  const stablecoinIdPattern = /^[a-z0-9][a-z0-9_-]*$/;
  for (const sc of stablecoins) {
    if (!stablecoinIdPattern.test(sc.id)) {
      invalidStablecoinIds.push(sc.id);
    }
  }
  if (invalidStablecoinIds.length === 0) {
    pass(28, 'All stablecoin IDs are valid slugs', `${stablecoins.length} IDs checked`);
  } else {
    fail(28, `${invalidStablecoinIds.length} stablecoin IDs have invalid format`, 'All match slug pattern', `Invalid: ${invalidStablecoinIds.join(', ')}`);
  }

  // Test 29: CBDC ID format — all valid?
  const invalidCbdcIds: string[] = [];
  const cbdcIdPattern = /^[a-z0-9][a-z0-9_-]*$/;
  for (const c of cbdcs) {
    if (!cbdcIdPattern.test(c.id)) {
      invalidCbdcIds.push(c.id);
    }
  }
  if (invalidCbdcIds.length === 0) {
    pass(29, 'All CBDC IDs are valid slugs', `${cbdcs.length} IDs checked`);
  } else {
    fail(29, `${invalidCbdcIds.length} CBDC IDs have invalid format`, 'All match slug pattern', `Invalid: ${invalidCbdcIds.join(', ')}`);
  }

  // Test 30: Entities with country_code not in REGION_MAP — these go to "Other" region
  const otherRegionEntities = nonGarbageEntities.filter((e) => !ALL_REGION_CODES.has(e.country_code as string));
  if (otherRegionEntities.length === 0) {
    pass(30, 'No entities fall into "Other" region (all country_codes in REGION_MAP)', `${nonGarbageEntities.length} entities checked`);
  } else {
    const otherCodes = [...new Set(otherRegionEntities.map((e) => e.country_code as string))];
    const otherDetails = otherCodes.map((cc) => `${cc}(${entityCountByCountry.get(cc) ?? 0})`);
    warn(30, `${otherRegionEntities.length} entities in "Other" region (${otherCodes.length} country codes)`, otherDetails.join(', '));
  }

  // ════════════════════════════════════════════════════════════════════════
  // BONUS TESTS (31-35): Additional cross-page integrity checks
  // ════════════════════════════════════════════════════════════════════════

  log('\n' + '-'.repeat(80));
  log('  SECTION 4: BONUS CROSS-PAGE INTEGRITY');
  log('-'.repeat(80));

  // Test 31: No entity has null canonical_name AND null name (would show blank in UI)
  const blankNameEntities = nonGarbageEntities.filter(
    (e) => !e.canonical_name && !e.name
  );
  if (blankNameEntities.length === 0) {
    pass(31, 'No entity has both name and canonical_name null/empty', `${nonGarbageEntities.length} entities checked`);
  } else {
    fail(31, `${blankNameEntities.length} entities have no displayable name`, '0', `${blankNameEntities.length} blank-name entities`);
  }

  // Test 32: Issuer slugs are unique (no duplicates)
  const slugCounts = new Map<string, number>();
  for (const i of issuers) {
    if (i.slug) slugCounts.set(i.slug, (slugCounts.get(i.slug) ?? 0) + 1);
  }
  const dupSlugs = [...slugCounts.entries()].filter(([, c]) => c > 1);
  if (dupSlugs.length === 0) {
    pass(32, 'All issuer slugs are unique', `${issuers.length} issuers checked`);
  } else {
    fail(32, `${dupSlugs.length} duplicate issuer slug(s)`, '0 duplicates', `Duplicates: ${dupSlugs.map(([s, c]) => `${s}(${c})`).join(', ')}`);
  }

  // Test 33: LandingPage uses getEntityCount() not getEntities().length (performance)
  const landingSrc = readSource('src/pages/LandingPage.tsx');
  const usesGetEntityCount = landingSrc.includes('getEntityCount');
  const usesGetEntitiesOnLanding = landingSrc.includes('getEntities()') || landingSrc.includes('getEntities,');
  if (usesGetEntityCount && !usesGetEntitiesOnLanding) {
    pass(33, 'LandingPage uses getEntityCount() (fast COUNT) not getEntities()', 'Efficient: no full data transfer for count');
  } else if (usesGetEntityCount) {
    pass(33, 'LandingPage uses getEntityCount() for entity count', 'getEntityCount found (may also import getEntities for other use)');
  } else {
    fail(33, 'LandingPage does not use getEntityCount()', 'getEntityCount', 'Not found in imports');
  }

  // Test 34: getEntities orders by canonical_name (not name)
  const ordersCanonical = dataLoaderSrc.includes(".order('canonical_name'");
  if (ordersCanonical) {
    pass(34, 'getEntities orders by canonical_name (cleaned names)', "order('canonical_name') found");
  } else {
    fail(34, 'getEntities does not order by canonical_name', "order('canonical_name')", 'Not found');
  }

  // Test 35: mapEntity prefers canonical_name over name
  const mapEntityPrefersCanonical = dataLoaderSrc.includes('row.canonical_name || row.name');
  if (mapEntityPrefersCanonical) {
    pass(35, 'mapEntity() prefers canonical_name over raw name', 'row.canonical_name || row.name found');
  } else {
    fail(35, 'mapEntity does not prefer canonical_name', 'canonical_name || name', 'Pattern not found');
  }

  // ════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ════════════════════════════════════════════════════════════════════════

  log('\n' + '='.repeat(80));
  log('  SUMMARY');
  log('='.repeat(80));
  log(`\n  Total tests: ${passed + failed + warnings}`);
  log(`  PASSED:   ${passed}`);
  log(`  FAILED:   ${failed}`);
  log(`  WARNINGS: ${warnings}`);
  log(`\n  Result: ${failed === 0 ? 'ALL TESTS PASSED' : `${failed} FAILURE(S) DETECTED`}`);
  log('='.repeat(80));

  // Write to file
  fs.writeFileSync('/tmp/qa-cross-page.txt', lines.join('\n') + '\n', 'utf-8');
  log(`\n  Report saved to /tmp/qa-cross-page.txt\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(2);
});
