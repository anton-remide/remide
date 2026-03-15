/**
 * QA Jurisdictions Script — Comprehensive data validation for
 * JurisdictionsPage and JurisdictionDetailPage.
 *
 * Runs 53 test scenarios against Supabase, validates data integrity,
 * distributions, cross-references, and edge cases.
 *
 * Usage:
 *   cd "/Users/antontitov/Vasp Tracker/remide" && npx tsx scripts/qa-jurisdictions.ts
 *
 * Output: console + /tmp/qa-jurisdictions.txt
 */

import { getSupabase } from '../shared/supabase.js';
import * as fs from 'fs';

const sb = getSupabase();
const lines: string[] = [];

let passCount = 0;
let failCount = 0;
let warnCount = 0;

/* ── Logging helpers ── */

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

function pass(id: number, desc: string, detail: string = '') {
  passCount++;
  const msg = `  [PASS] #${id}: ${desc}${detail ? `  -->  ${detail}` : ''}`;
  log(msg);
}

function fail(id: number, desc: string, expected: string, actual: string) {
  failCount++;
  const msg = `  [FAIL] #${id}: ${desc}\n         Expected: ${expected}\n         Actual:   ${actual}`;
  log(msg);
}

function warn(id: number, desc: string, detail: string) {
  warnCount++;
  const msg = `  [WARN] #${id}: ${desc}  -->  ${detail}`;
  log(msg);
}

function pct(n: number, total: number): string {
  if (total === 0) return '0.0%';
  return `${((n / total) * 100).toFixed(1)}%`;
}

/* ── Data fetcher (handles Supabase 1000-row limit) ── */

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

/* ── Type definitions for DB rows ── */

interface JurisdictionRow {
  code: string;
  name: string;
  regime: string;
  regulator: string;
  key_law: string;
  travel_rule: string;
  entity_count: number;
  sources: unknown;
  notes: string;
  // NOTE: 'description' column does NOT exist in jurisdictions table.
  // The frontend JurisdictionRow type expects it but Supabase returns null via select('*').
  stablecoin_stage: number | null;
  is_stablecoin_specific: boolean | null;
  yield_allowed: boolean | null;
  fiat_backed: number | null;
  fiat_alert: string | null;
  crypto_backed: number | null;
  crypto_alert: string | null;
  commodity_backed: number | null;
  commodity_alert: string | null;
  algorithm_backed: number | null;
  algorithm_alert: string | null;
  stablecoin_description: string | null;
  regulator_description: string | null;
  currency: string | null;
  stride_id: number | null;
}

interface EntityRow {
  id: string;
  name: string;
  country_code: string;
  parser_id: string | null;
  is_garbage: boolean | null;
  canonical_name: string | null;
}

interface CbdcRow {
  id: string;
  country_code: string;
  name: string;
  status: string;
}

interface LawRow {
  id: number;
  country_code: string;
  title: string;
}

interface EventRow {
  id: number;
  country_code: string;
  title: string;
}

/* ── Main ── */

async function main() {
  const startTime = Date.now();

  heading('QA JURISDICTIONS — Comprehensive Data Validation');
  log(`  Timestamp: ${new Date().toISOString()}`);
  log('');

  // ── Fetch all data ──
  log('  Loading data from Supabase...');

  // Explicitly list columns instead of using select('*') which could fail
  // if the schema doesn't match expectations. The 'description' column does
  // not exist on jurisdictions.
  const JURISDICTION_COLS = [
    'code', 'name', 'regime', 'regulator', 'key_law', 'travel_rule',
    'entity_count', 'sources', 'notes',
    'stablecoin_stage', 'is_stablecoin_specific', 'yield_allowed',
    'fiat_backed', 'fiat_alert', 'crypto_backed', 'crypto_alert',
    'commodity_backed', 'commodity_alert', 'algorithm_backed', 'algorithm_alert',
    'stablecoin_description', 'regulator_description', 'currency', 'stride_id',
  ].join(',');

  const jurisdictions = await fetchAll<JurisdictionRow>('jurisdictions', JURISDICTION_COLS);

  const entities = await fetchAll<EntityRow>(
    'entities',
    'id,name,country_code,parser_id,is_garbage,canonical_name'
  );

  const cbdcs = await fetchAll<CbdcRow>('cbdcs', 'id,country_code,name,status');
  const laws = await fetchAll<LawRow>('stablecoin_laws', 'id,country_code,title');
  const events = await fetchAll<EventRow>('stablecoin_events', 'id,country_code,title');

  log(`  Loaded: ${jurisdictions.length} jurisdictions, ${entities.length} entities, ${cbdcs.length} CBDCs, ${laws.length} laws, ${events.length} events`);

  // Build lookup maps
  const jMap = new Map(jurisdictions.map(j => [j.code, j]));

  // Entity counts per country (excluding garbage)
  const entityCountByCountry = new Map<string, number>();
  const entityParsersByCountry = new Map<string, Set<string>>();
  for (const e of entities) {
    if (e.is_garbage) continue;
    entityCountByCountry.set(e.country_code, (entityCountByCountry.get(e.country_code) ?? 0) + 1);
    if (e.parser_id) {
      if (!entityParsersByCountry.has(e.country_code)) {
        entityParsersByCountry.set(e.country_code, new Set());
      }
      entityParsersByCountry.get(e.country_code)!.add(e.parser_id);
    }
  }

  // CBDC countries
  const cbdcCountries = new Set(cbdcs.map(c => c.country_code));

  // Laws and events by country
  const lawsByCountry = new Map<string, LawRow[]>();
  for (const l of laws) {
    if (!lawsByCountry.has(l.country_code)) lawsByCountry.set(l.country_code, []);
    lawsByCountry.get(l.country_code)!.push(l);
  }
  const eventsByCountry = new Map<string, EventRow[]>();
  for (const e of events) {
    if (!eventsByCountry.has(e.country_code)) eventsByCountry.set(e.country_code, []);
    eventsByCountry.get(e.country_code)!.push(e);
  }

  // ════════════════════════════════════════════════════════════════
  //  SECTION 1: JURISDICTIONS LIST PAGE TESTS (1-15)
  // ════════════════════════════════════════════════════════════════

  heading('SECTION 1: Jurisdictions List Page');

  // #1 — All jurisdictions have non-empty country_name
  {
    const empty = jurisdictions.filter(j => !j.name || j.name.trim() === '');
    if (empty.length === 0) {
      pass(1, 'All jurisdictions have non-empty country_name', `${jurisdictions.length} checked`);
    } else {
      fail(1, 'Some jurisdictions have empty name', '0 empty names', `${empty.length} empty: ${empty.map(j => j.code).join(', ')}`);
    }
  }

  // #2 — All have 2-char country code
  {
    const bad = jurisdictions.filter(j => !j.code || j.code.length !== 2);
    if (bad.length === 0) {
      pass(2, 'All jurisdictions have 2-char country code', `${jurisdictions.length} checked`);
    } else {
      fail(2, 'Some jurisdictions have invalid code length', 'All codes 2 chars', `Invalid: ${bad.map(j => `${j.code}(${j.code?.length})`).join(', ')}`);
    }
  }

  // #3 — Regime distribution: valid values only
  {
    const validRegimes = new Set(['Licensing', 'Registration', 'Sandbox', 'Ban', 'None', 'Unclear']);
    const invalid = jurisdictions.filter(j => !validRegimes.has(j.regime));
    const dist: Record<string, number> = {};
    for (const j of jurisdictions) {
      dist[j.regime] = (dist[j.regime] ?? 0) + 1;
    }
    if (invalid.length === 0) {
      pass(3, 'Regime distribution: all values valid', Object.entries(dist).map(([k, v]) => `${k}=${v}`).join(', '));
    } else {
      fail(3, 'Invalid regime values found', 'All in valid set', `Invalid: ${invalid.map(j => `${j.code}="${j.regime}"`).join(', ')}`);
    }
  }

  // #4 — Regime distribution: % breakdown
  {
    const dist: Record<string, number> = {};
    for (const j of jurisdictions) {
      dist[j.regime] = (dist[j.regime] ?? 0) + 1;
    }
    const total = jurisdictions.length;
    const breakdown = Object.entries(dist)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}: ${v} (${pct(v, total)})`)
      .join(', ');
    pass(4, 'Regime % breakdown', breakdown);
  }

  // #5 — Travel rule distribution: valid values only
  {
    const validTR = new Set(['Enforced', 'Legislated', 'In Progress', 'Not Implemented', 'N/A']);
    const invalid = jurisdictions.filter(j => !validTR.has(j.travel_rule));
    const dist: Record<string, number> = {};
    for (const j of jurisdictions) {
      dist[j.travel_rule] = (dist[j.travel_rule] ?? 0) + 1;
    }
    if (invalid.length === 0) {
      pass(5, 'Travel rule: all values valid', Object.entries(dist).map(([k, v]) => `${k}=${v}`).join(', '));
    } else {
      fail(5, 'Invalid travel_rule values found', 'All in valid set', `Invalid: ${invalid.map(j => `${j.code}="${j.travel_rule}"`).join(', ')}`);
    }
  }

  // #6 — Travel rule: how many Enforced?
  {
    const enforced = jurisdictions.filter(j => j.travel_rule === 'Enforced');
    pass(6, 'Travel rule Enforced count', `${enforced.length} jurisdictions (${pct(enforced.length, jurisdictions.length)}): ${enforced.map(j => j.code).slice(0, 20).join(', ')}${enforced.length > 20 ? '...' : ''}`);
  }

  // #7 — Entity count field: matches actual entity count per country?
  {
    let mismatches = 0;
    const mismatchList: string[] = [];
    for (const j of jurisdictions) {
      const actual = entityCountByCountry.get(j.code) ?? 0;
      if (j.entity_count !== actual) {
        mismatches++;
        if (mismatchList.length < 15) {
          mismatchList.push(`${j.code}: stored=${j.entity_count} actual=${actual}`);
        }
      }
    }
    if (mismatches === 0) {
      pass(7, 'Entity count matches actual for all jurisdictions', `${jurisdictions.length} checked`);
    } else {
      warn(7, `Entity count mismatch in ${mismatches} jurisdictions`, mismatchList.join('; '));
    }
  }

  // #8 — Entity count: top 10 by stored count vs actual
  {
    const top = [...jurisdictions]
      .sort((a, b) => b.entity_count - a.entity_count)
      .slice(0, 10);
    const details = top.map(j => {
      const actual = entityCountByCountry.get(j.code) ?? 0;
      const match = j.entity_count === actual ? 'OK' : `MISMATCH(actual=${actual})`;
      return `${j.code}(${j.name}): ${j.entity_count} ${match}`;
    });
    pass(8, 'Top 10 jurisdictions by entity count', details.join(', '));
  }

  // #9 — Entity count: any negative values?
  {
    const negative = jurisdictions.filter(j => j.entity_count < 0);
    if (negative.length === 0) {
      pass(9, 'No jurisdictions with negative entity_count', `All >= 0`);
    } else {
      fail(9, 'Negative entity_count found', '0 negative', `${negative.length}: ${negative.map(j => `${j.code}=${j.entity_count}`).join(', ')}`);
    }
  }

  // #10 — Regulator field: what % non-empty?
  {
    const filled = jurisdictions.filter(j => j.regulator && j.regulator.trim() !== '');
    pass(10, `Regulator field coverage`, `${filled.length}/${jurisdictions.length} non-empty (${pct(filled.length, jurisdictions.length)})`);
  }

  // #11 — Key law field: what % non-empty?
  {
    const filled = jurisdictions.filter(j => j.key_law && j.key_law.trim() !== '');
    pass(11, `Key law field coverage`, `${filled.length}/${jurisdictions.length} non-empty (${pct(filled.length, jurisdictions.length)})`);
  }

  // #12 — 'description' column check: does it exist in the DB?
  // NOTE: The frontend JurisdictionRow type expects 'description' but it does NOT
  // exist as a column in the actual Supabase jurisdictions table. We verify this.
  {
    const { data: testRow } = await sb.from('jurisdictions').select('*').limit(1);
    const cols = testRow && testRow.length > 0 ? Object.keys(testRow[0]) : [];
    const hasDescription = cols.includes('description');
    if (hasDescription) {
      pass(12, 'Description column exists in jurisdictions table', 'Column present');
    } else {
      warn(12, 'Description column MISSING from jurisdictions table',
        `Frontend code expects it (JurisdictionRow.description) but DB lacks it. ` +
        `Columns present: ${cols.length}. This may cause frontend to show empty descriptions.`);
    }
  }

  // #13 — Notes field: what % non-empty?
  {
    const filled = jurisdictions.filter(j => j.notes && j.notes.trim() !== '');
    pass(13, `Notes field coverage`, `${filled.length}/${jurisdictions.length} non-empty (${pct(filled.length, jurisdictions.length)})`);
  }

  // #14 — Any jurisdiction with entity_count=0 but we have entities for that country?
  {
    const phantom: string[] = [];
    for (const j of jurisdictions) {
      if (j.entity_count === 0) {
        const actual = entityCountByCountry.get(j.code) ?? 0;
        if (actual > 0) {
          phantom.push(`${j.code}(stored=0, actual=${actual})`);
        }
      }
    }
    if (phantom.length === 0) {
      pass(14, 'No phantom entities (entity_count=0 but actual>0)', 'All consistent');
    } else {
      fail(14, 'Phantom entities found: count=0 but actual entities exist', '0 mismatches', `${phantom.length}: ${phantom.slice(0, 15).join(', ')}`);
    }
  }

  // #15 — Any jurisdiction with entity_count>0 but we have 0 entities for that country?
  {
    const ghost: string[] = [];
    for (const j of jurisdictions) {
      if (j.entity_count > 0) {
        const actual = entityCountByCountry.get(j.code) ?? 0;
        if (actual === 0) {
          ghost.push(`${j.code}(stored=${j.entity_count}, actual=0)`);
        }
      }
    }
    if (ghost.length === 0) {
      pass(15, 'No ghost counts (entity_count>0 but actual=0)', 'All consistent');
    } else {
      fail(15, 'Ghost entity counts found', '0 mismatches', `${ghost.length}: ${ghost.slice(0, 10).join(', ')}`);
    }
  }

  // ════════════════════════════════════════════════════════════════
  //  SECTION 2: STABLECOIN REGULATORY DATA TESTS (16-25)
  // ════════════════════════════════════════════════════════════════

  heading('SECTION 2: Stablecoin Regulatory Data');

  // #16 — Stablecoin stage distribution
  {
    const dist: Record<string, number> = { 'null': 0, '0': 0, '1': 0, '2': 0, '3': 0, 'other': 0 };
    for (const j of jurisdictions) {
      if (j.stablecoin_stage === null || j.stablecoin_stage === undefined) {
        dist['null']++;
      } else if ([0, 1, 2, 3].includes(j.stablecoin_stage)) {
        dist[String(j.stablecoin_stage)]++;
      } else {
        dist['other']++;
      }
    }
    const detail = `Stage 0(No Framework)=${dist['0']}, Stage 1(Developing)=${dist['1']}, Stage 2(In Progress)=${dist['2']}, Stage 3(Live)=${dist['3']}, null=${dist['null']}, other=${dist['other']}`;
    if (dist['other'] === 0) {
      pass(16, 'Stablecoin stage distribution: all valid (0-3 or null)', detail);
    } else {
      fail(16, 'Invalid stablecoin_stage values', 'Only 0-3 or null', detail);
    }
  }

  // #17 — Backing types: valid values (0/1/2/null)?
  {
    const backingFields = ['fiat_backed', 'crypto_backed', 'commodity_backed', 'algorithm_backed'] as const;
    let allValid = true;
    const fieldDetails: string[] = [];

    for (const field of backingFields) {
      const dist: Record<string, number> = { '0': 0, '1': 0, '2': 0, 'null': 0, 'other': 0 };
      for (const j of jurisdictions) {
        const val = j[field];
        if (val === null || val === undefined) {
          dist['null']++;
        } else if ([0, 1, 2].includes(val)) {
          dist[String(val)]++;
        } else {
          dist['other']++;
          allValid = false;
        }
      }
      fieldDetails.push(`${field}: Prohibited(0)=${dist['0']}, Permitted(1)=${dist['1']}, Unclear(2)=${dist['2']}, null=${dist['null']}${dist['other'] > 0 ? `, INVALID=${dist['other']}` : ''}`);
    }

    if (allValid) {
      pass(17, 'All backing types have valid values (0/1/2/null)', fieldDetails.join('; '));
    } else {
      fail(17, 'Invalid backing values found', 'Only 0/1/2/null', fieldDetails.join('; '));
    }
  }

  // #18 — Yield allowed distribution
  {
    const trueCount = jurisdictions.filter(j => j.yield_allowed === true).length;
    const falseCount = jurisdictions.filter(j => j.yield_allowed === false).length;
    const nullCount = jurisdictions.filter(j => j.yield_allowed === null || j.yield_allowed === undefined).length;
    pass(18, 'Yield allowed distribution', `true=${trueCount}, false=${falseCount}, null=${nullCount}`);
  }

  // #19 — Stablecoin description: what % non-empty?
  {
    const filled = jurisdictions.filter(j => j.stablecoin_description && j.stablecoin_description.trim().length > 0);
    pass(19, 'Stablecoin description coverage', `${filled.length}/${jurisdictions.length} non-empty (${pct(filled.length, jurisdictions.length)})`);
  }

  // #20 — Alert fields: what % non-empty?
  {
    const alertFields = ['fiat_alert', 'crypto_alert', 'commodity_alert', 'algorithm_alert'] as const;
    const details: string[] = [];
    for (const field of alertFields) {
      const filled = jurisdictions.filter(j => {
        const val = j[field];
        return val && typeof val === 'string' && val.trim().length > 0;
      });
      details.push(`${field}: ${filled.length} (${pct(filled.length, jurisdictions.length)})`);
    }
    pass(20, 'Alert fields coverage', details.join(', '));
  }

  // #21 — Any jurisdiction with stablecoin_stage=3 (Live) but all backing=0 (Prohibited)?
  {
    const contradictions: string[] = [];
    for (const j of jurisdictions) {
      if (j.stablecoin_stage === 3) {
        const allProhibited = (j.fiat_backed === 0 && j.crypto_backed === 0 && j.commodity_backed === 0 && j.algorithm_backed === 0);
        if (allProhibited) {
          contradictions.push(j.code);
        }
      }
    }
    if (contradictions.length === 0) {
      const liveCount = jurisdictions.filter(j => j.stablecoin_stage === 3).length;
      pass(21, 'No contradiction: stage=3(Live) with all backing=0(Prohibited)', `${liveCount} Live jurisdictions checked`);
    } else {
      fail(21, 'Contradiction: stage=3 but all backing prohibited', '0 contradictions', `Found: ${contradictions.join(', ')}`);
    }
  }

  // #22 — Any jurisdiction with stablecoin_stage=0 (No Framework) but has backing data?
  {
    const contradictions: string[] = [];
    for (const j of jurisdictions) {
      if (j.stablecoin_stage === 0) {
        const hasExplicitBacking = [j.fiat_backed, j.crypto_backed, j.commodity_backed, j.algorithm_backed]
          .some(v => v !== null && v !== undefined && v !== 0);
        if (hasExplicitBacking) {
          contradictions.push(`${j.code}(fiat=${j.fiat_backed},crypto=${j.crypto_backed},comm=${j.commodity_backed},algo=${j.algorithm_backed})`);
        }
      }
    }
    if (contradictions.length === 0) {
      const noFramework = jurisdictions.filter(j => j.stablecoin_stage === 0).length;
      pass(22, 'No contradiction: stage=0(No Framework) with explicit backing data', `${noFramework} No-Framework jurisdictions checked`);
    } else {
      warn(22, `Possible contradiction: stage=0 but has backing data`, `${contradictions.length}: ${contradictions.slice(0, 10).join(', ')}`);
    }
  }

  // #23 — Currency field: what % non-empty?
  {
    const filled = jurisdictions.filter(j => j.currency && j.currency.trim().length > 0);
    pass(23, 'Currency field coverage', `${filled.length}/${jurisdictions.length} non-empty (${pct(filled.length, jurisdictions.length)})`);
  }

  // #24 — Regulator description: what % non-empty?
  {
    const filled = jurisdictions.filter(j => j.regulator_description && j.regulator_description.trim().length > 0);
    pass(24, 'Regulator description coverage', `${filled.length}/${jurisdictions.length} non-empty (${pct(filled.length, jurisdictions.length)})`);
  }

  // #25 — Is stablecoin specific: distribution
  {
    const trueCount = jurisdictions.filter(j => j.is_stablecoin_specific === true).length;
    const falseCount = jurisdictions.filter(j => j.is_stablecoin_specific === false).length;
    const nullCount = jurisdictions.filter(j => j.is_stablecoin_specific === null || j.is_stablecoin_specific === undefined).length;
    pass(25, 'is_stablecoin_specific distribution', `true=${trueCount}, false=${falseCount}, null=${nullCount}`);
  }

  // ════════════════════════════════════════════════════════════════
  //  SECTION 3: MAP / COLOR MODE TESTS (26-30)
  // ════════════════════════════════════════════════════════════════

  heading('SECTION 3: Map / Color Mode Data');

  // #26 — Regime mode: all jurisdictions should have a valid regime (no nulls)
  {
    const validRegimes = new Set(['Licensing', 'Registration', 'Sandbox', 'Ban', 'None', 'Unclear']);
    const nullRegime = jurisdictions.filter(j => !j.regime || !validRegimes.has(j.regime));
    if (nullRegime.length === 0) {
      pass(26, 'Regime mode: all jurisdictions have valid regime (no nulls)', `${jurisdictions.length} checked`);
    } else {
      fail(26, 'Regime mode: null or invalid regimes found', '0 null/invalid', `${nullRegime.length}: ${nullRegime.map(j => `${j.code}="${j.regime}"`).join(', ')}`);
    }
  }

  // #27 — Travel rule mode: all should have valid value
  {
    const validTR = new Set(['Enforced', 'Legislated', 'In Progress', 'Not Implemented', 'N/A']);
    const nullTR = jurisdictions.filter(j => !j.travel_rule || !validTR.has(j.travel_rule));
    if (nullTR.length === 0) {
      pass(27, 'Travel rule mode: all jurisdictions have valid travel_rule', `${jurisdictions.length} checked`);
    } else {
      fail(27, 'Travel rule mode: null/invalid values', '0 null/invalid', `${nullTR.length}: ${nullTR.map(j => `${j.code}="${j.travel_rule}"`).join(', ')}`);
    }
  }

  // #28 — Stablecoin mode: jurisdictions with stage data
  {
    const withStage = jurisdictions.filter(j => j.stablecoin_stage !== null && j.stablecoin_stage !== undefined);
    const withoutStage = jurisdictions.length - withStage.length;
    pass(28, 'Stablecoin mode: jurisdictions with stage data', `${withStage.length} have stage data (${pct(withStage.length, jurisdictions.length)}), ${withoutStage} without`);
  }

  // #29 — CBDC mode: jurisdictions with CBDC data, cross-ref with CBDCs table
  {
    const cbdcCountryList = [...cbdcCountries].sort();
    const cbdcWithJurisdiction = cbdcCountryList.filter(c => jMap.has(c));
    const cbdcMissingJurisdiction = cbdcCountryList.filter(c => !jMap.has(c));

    if (cbdcMissingJurisdiction.length === 0) {
      pass(29, 'CBDC mode: all CBDC countries have matching jurisdictions', `${cbdcCountryList.length} CBDC countries, all found in jurisdictions table`);
    } else {
      // Only count non-pseudo jurisdictions as missing (EU is pseudo, expected)
      const realMissing = cbdcMissingJurisdiction.filter(c => c !== 'EU');
      if (realMissing.length === 0) {
        pass(29, 'CBDC mode: all CBDC countries have matching jurisdictions (EU pseudo excluded)', `${cbdcCountryList.length} CBDC countries. EU excluded.`);
      } else {
        warn(29, 'CBDC countries missing in jurisdictions table', `Missing: ${cbdcMissingJurisdiction.join(', ')}`);
      }
    }
    log(`         CBDC countries: ${cbdcCountryList.length} total, ${cbdcs.length} CBDC records`);
  }

  // #30 — Count of jurisdictions with ALL 4 data points
  {
    const complete = jurisdictions.filter(j =>
      j.regime && j.regime !== 'None' && j.regime !== 'Unclear' &&
      j.travel_rule && j.travel_rule !== 'N/A' &&
      j.stablecoin_stage !== null && j.stablecoin_stage !== undefined &&
      cbdcCountries.has(j.code)
    );
    pass(30, 'Jurisdictions with ALL 4 data points (regime + travel rule + stablecoin + CBDC)', `${complete.length} (${pct(complete.length, jurisdictions.length)}): ${complete.map(j => j.code).slice(0, 20).join(', ')}${complete.length > 20 ? '...' : ''}`);

    const hasRegime = jurisdictions.filter(j => j.regime && j.regime !== 'None' && j.regime !== 'Unclear').length;
    const hasTR = jurisdictions.filter(j => j.travel_rule && j.travel_rule !== 'N/A').length;
    const hasStable = jurisdictions.filter(j => j.stablecoin_stage !== null && j.stablecoin_stage !== undefined).length;
    const hasCbdc = jurisdictions.filter(j => cbdcCountries.has(j.code)).length;
    log(`         Partial: regime=${hasRegime}, travel_rule=${hasTR}, stablecoin_stage=${hasStable}, CBDC=${hasCbdc}`);
  }

  // ════════════════════════════════════════════════════════════════
  //  SECTION 4: JURISDICTION DETAIL PAGE TESTS (31-40)
  // ════════════════════════════════════════════════════════════════

  heading('SECTION 4: Jurisdiction Detail Page');

  // Helper to check a specific jurisdiction
  function checkJurisdiction(
    id: number,
    code: string,
    checks: {
      name?: string;
      regime?: string;
      minEntities?: number;
      maxEntities?: number;
      expectedParsers?: string[];
      checkCleanNames?: boolean;
    }
  ) {
    const j = jMap.get(code);
    if (!j) {
      fail(id, `Jurisdiction ${code} exists`, 'Found in DB', 'NOT FOUND');
      return;
    }

    const actualCount = entityCountByCountry.get(code) ?? 0;
    const parsers = entityParsersByCountry.get(code);
    const parserList = parsers ? [...parsers].sort() : [];

    const details: string[] = [];
    let testPassed = true;

    details.push(`name="${j.name}", regime=${j.regime}, entities(stored=${j.entity_count}, actual=${actualCount})`);

    if (checks.regime && j.regime !== checks.regime) {
      details.push(`REGIME MISMATCH: expected=${checks.regime}, got=${j.regime}`);
      testPassed = false;
    }

    if (checks.minEntities !== undefined && actualCount < checks.minEntities) {
      details.push(`ENTITY COUNT LOW: expected>=${checks.minEntities}, got=${actualCount}`);
      testPassed = false;
    }

    if (checks.maxEntities !== undefined && actualCount > checks.maxEntities) {
      details.push(`ENTITY COUNT HIGH: expected<=${checks.maxEntities}, got=${actualCount}`);
      testPassed = false;
    }

    if (checks.expectedParsers) {
      const found: string[] = [];
      const missing: string[] = [];
      for (const p of checks.expectedParsers) {
        if (parserList.some(pp => pp.includes(p))) {
          found.push(p);
        } else {
          missing.push(p);
        }
      }
      details.push(`parsers: [${parserList.join(', ')}]`);
      if (missing.length > 0) {
        details.push(`MISSING PARSERS: ${missing.join(', ')}`);
        testPassed = false;
      }
    }

    if (checks.checkCleanNames) {
      const countryEntities = entities.filter(e => e.country_code === code && !e.is_garbage);
      const withQuotes = countryEntities.filter(e => {
        const displayName = e.canonical_name || e.name;
        return /^["']|["']$/.test(displayName);
      });
      if (withQuotes.length > 0) {
        details.push(`UNCLEAN NAMES (quotes): ${withQuotes.length} entities, e.g. "${withQuotes[0].canonical_name || withQuotes[0].name}"`);
        testPassed = false;
      } else {
        details.push(`All ${countryEntities.length} names clean (no leading/trailing quotes)`);
      }
    }

    // Additional info
    if (j.stablecoin_stage !== null) details.push(`stablecoin_stage=${j.stablecoin_stage}`);
    const countryLaws = lawsByCountry.get(code) ?? [];
    const countryEvents = eventsByCountry.get(code) ?? [];
    if (countryLaws.length > 0) details.push(`laws=${countryLaws.length}`);
    if (countryEvents.length > 0) details.push(`events=${countryEvents.length}`);

    if (testPassed) {
      pass(id, `${code} (${j.name}) detail page data`, details.join(' | '));
    } else {
      fail(id, `${code} (${j.name}) detail page data`, 'All checks pass', details.join(' | '));
    }
  }

  // #31 — US: entity count, regime=Licensing, entities include FDIC + NYDFS parsers
  checkJurisdiction(31, 'US', {
    regime: 'Licensing',
    minEntities: 3800,
    expectedParsers: ['fdic', 'nydfs'],
  });

  // #32 — GB: entity count ~1200, regime, entities include PRA
  checkJurisdiction(32, 'GB', {
    minEntities: 1000,
    maxEntities: 2000,
    expectedParsers: ['pra'],
  });

  // #33 — DE: check ESMA + EBA entities present
  checkJurisdiction(33, 'DE', {
    minEntities: 10,
    expectedParsers: ['esma', 'eba'],
  });

  // #34 — SG: check MAS entities present
  checkJurisdiction(34, 'SG', {
    minEntities: 5,
    expectedParsers: ['mas'],
  });

  // #35 — AE: check VARA + ADGM + DFSA entities
  checkJurisdiction(35, 'AE', {
    minEntities: 5,
    expectedParsers: ['vara', 'adgm', 'dfsa'],
  });

  // #36 — PL: check KNF entities, verify names cleaned (no quotes)
  checkJurisdiction(36, 'PL', {
    minEntities: 5,
    expectedParsers: ['knf'],
    checkCleanNames: true,
  });

  // #37 — JP: check FSA entities
  checkJurisdiction(37, 'JP', {
    minEntities: 5,
    expectedParsers: ['fsa'],
  });

  // #38 — Check EU pseudo-jurisdiction if exists
  {
    const eu = jMap.get('EU');
    if (eu) {
      pass(38, 'EU pseudo-jurisdiction exists', `name="${eu.name}", regime=${eu.regime}, entity_count=${eu.entity_count}`);
    } else {
      warn(38, 'EU pseudo-jurisdiction does not exist', 'code "EU" not in jurisdictions table (may be expected if DDL 005 not fully applied)');
    }
  }

  // #39 — Stablecoin laws: any jurisdiction with laws?
  {
    const countriesWithLaws = [...lawsByCountry.keys()].sort();
    if (countriesWithLaws.length > 0) {
      pass(39, `Stablecoin laws exist for ${countriesWithLaws.length} jurisdictions`, `Total: ${laws.length} laws. Countries: ${countriesWithLaws.slice(0, 20).join(', ')}${countriesWithLaws.length > 20 ? '...' : ''}`);
    } else {
      warn(39, 'No stablecoin laws in database', '0 records in stablecoin_laws table');
    }
  }

  // #40 — Stablecoin events: any jurisdiction with events?
  {
    const countriesWithEvents = [...eventsByCountry.keys()].sort();
    if (countriesWithEvents.length > 0) {
      pass(40, `Stablecoin events exist for ${countriesWithEvents.length} jurisdictions`, `Total: ${events.length} events. Countries: ${countriesWithEvents.slice(0, 20).join(', ')}${countriesWithEvents.length > 20 ? '...' : ''}`);
    } else {
      warn(40, 'No stablecoin events in database', '0 records in stablecoin_events table');
    }
  }

  // ════════════════════════════════════════════════════════════════
  //  SECTION 5: ADDITIONAL INTEGRITY TESTS (41-53)
  // ════════════════════════════════════════════════════════════════

  heading('SECTION 5: Additional Integrity Tests');

  // #41 — Check AU: AUSTRAC parser
  checkJurisdiction(41, 'AU', {
    minEntities: 100,
    expectedParsers: ['austrac'],
  });

  // #42 — Check HK: SFC parser
  checkJurisdiction(42, 'HK', {
    minEntities: 10,
    expectedParsers: ['sfc'],
  });

  // #43 — Sources field: is it valid JSON array for all jurisdictions?
  {
    let invalidSources = 0;
    const invalidList: string[] = [];
    for (const j of jurisdictions) {
      if (j.sources === null || j.sources === undefined) continue;
      if (!Array.isArray(j.sources)) {
        // might be a string that needs parsing
        if (typeof j.sources === 'string') {
          try { JSON.parse(j.sources as string); } catch {
            invalidSources++;
            if (invalidList.length < 5) invalidList.push(`${j.code}: unparseable string`);
          }
        } else {
          invalidSources++;
          if (invalidList.length < 5) invalidList.push(`${j.code}: type=${typeof j.sources}`);
        }
      }
    }
    if (invalidSources === 0) {
      pass(43, 'Sources field: valid JSON array (or parseable string) for all jurisdictions', `${jurisdictions.length} checked`);
    } else {
      fail(43, 'Invalid sources field', 'All arrays or parseable', `${invalidSources} invalid: ${invalidList.join(', ')}`);
    }
  }

  // #44 — No duplicate jurisdiction codes
  {
    const codes = jurisdictions.map(j => j.code);
    const dupes = codes.filter((c, i) => codes.indexOf(c) !== i);
    if (dupes.length === 0) {
      pass(44, 'No duplicate jurisdiction codes', `${jurisdictions.length} unique codes`);
    } else {
      fail(44, 'Duplicate jurisdiction codes', '0 duplicates', `${dupes.length}: ${dupes.join(', ')}`);
    }
  }

  // #45 — Entities reference valid jurisdiction codes
  {
    const validCodes = new Set(jurisdictions.map(j => j.code));
    const orphans = entities.filter(e => !validCodes.has(e.country_code));
    const orphanCodes = [...new Set(orphans.map(e => e.country_code))];
    if (orphanCodes.length === 0) {
      pass(45, 'All entities reference valid jurisdiction codes', `${entities.length} checked`);
    } else {
      // This should not happen since country_code is a FK, but the FK might reference codes
      // that exist in jurisdictions but just weren't loaded.
      fail(45, 'Orphan entities referencing codes not in jurisdictions', '0 orphans',
        `${orphans.length} entities with codes not in loaded jurisdictions: ${orphanCodes.join(', ')}`);
    }
  }

  // #46 — Check stablecoin_stage vs has-laws correlation
  {
    const stage3WithLaws: string[] = [];
    const stage3NoLaws: string[] = [];
    for (const j of jurisdictions) {
      if (j.stablecoin_stage === 3) {
        const hasLaws = (lawsByCountry.get(j.code) ?? []).length > 0;
        if (hasLaws) stage3WithLaws.push(j.code);
        else stage3NoLaws.push(j.code);
      }
    }
    pass(46, 'Stage 3 (Live) vs laws correlation', `With laws: ${stage3WithLaws.length} (${stage3WithLaws.slice(0, 10).join(', ')}), Without laws: ${stage3NoLaws.length} (${stage3NoLaws.slice(0, 10).join(', ')})`);
  }

  // #47 — CBDC count per status
  {
    const statusDist: Record<string, number> = {};
    for (const c of cbdcs) {
      statusDist[c.status] = (statusDist[c.status] ?? 0) + 1;
    }
    pass(47, 'CBDC status distribution', Object.entries(statusDist).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(', ') || 'empty');
  }

  // #48 — Jurisdictions with non-empty notes but regime=None
  {
    const richNoRegime = jurisdictions.filter(j =>
      j.notes && j.notes.length > 10 && j.regime === 'None'
    );
    pass(48, 'Jurisdictions with notes but regime=None', `${richNoRegime.length}: ${richNoRegime.map(j => j.code).slice(0, 15).join(', ')}`);
  }

  // #49 — Check that country names don't contain weird characters
  {
    // Allow: word chars, spaces, hyphens, apostrophes, periods, commas, parens, ampersand, accented chars
    const weird = jurisdictions.filter(j => /[^\w\s\-'.,()&éèêëàâäùûüôöîïçñÉÈÊËÀÂÄÙÛÜÔÖÎÏÇÑ]/i.test(j.name));
    if (weird.length === 0) {
      pass(49, 'Country names are clean (no unusual characters)', `${jurisdictions.length} checked`);
    } else {
      warn(49, 'Country names with unusual characters', `${weird.length}: ${weird.map(j => `${j.code}="${j.name}"`).slice(0, 10).join(', ')}`);
    }
  }

  // #50 — Stablecoin regulatory data completeness
  {
    const stablecoinFields = (j: JurisdictionRow) =>
      (j.stablecoin_stage !== null ? 1 : 0) +
      (j.is_stablecoin_specific !== null ? 1 : 0) +
      (j.yield_allowed !== null ? 1 : 0) +
      (j.fiat_backed !== null ? 1 : 0) +
      (j.crypto_backed !== null ? 1 : 0) +
      (j.commodity_backed !== null ? 1 : 0) +
      (j.algorithm_backed !== null ? 1 : 0) +
      (j.stablecoin_description && j.stablecoin_description.trim().length > 0 ? 1 : 0) +
      (j.currency && j.currency.trim().length > 0 ? 1 : 0);

    const buckets: Record<string, number> = {};
    for (const j of jurisdictions) {
      const count = stablecoinFields(j);
      const bucket = count === 0 ? '0 fields' : count <= 3 ? '1-3 fields' : count <= 6 ? '4-6 fields' : '7-9 fields';
      buckets[bucket] = (buckets[bucket] ?? 0) + 1;
    }
    const totalWithData = jurisdictions.filter(j => stablecoinFields(j) > 0).length;
    pass(50, `Stablecoin data completeness: ${totalWithData}/${jurisdictions.length} have at least 1 field`, Object.entries(buckets).map(([k, v]) => `${k}=${v}`).join(', '));
  }

  // #51 — Check KR (South Korea) detail
  checkJurisdiction(51, 'KR', {
    minEntities: 20,
    expectedParsers: ['fiu'],
  });

  // #52 — Check BR (Brazil) detail
  checkJurisdiction(52, 'BR', {
    minEntities: 10,
    expectedParsers: ['bcb'],
  });

  // #53 — Check LI (Liechtenstein): FMA parser
  checkJurisdiction(53, 'LI', {
    minEntities: 10,
    expectedParsers: ['fma'],
  });

  // ════════════════════════════════════════════════════════════════
  //  SUMMARY
  // ════════════════════════════════════════════════════════════════

  heading('SUMMARY');
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  log(`  Total tests:  ${passCount + failCount + warnCount}`);
  log(`  PASS:         ${passCount}`);
  log(`  FAIL:         ${failCount}`);
  log(`  WARN:         ${warnCount}`);
  log(`  Duration:     ${elapsed}s`);
  log('');

  if (failCount > 0) {
    log('  FAILURES DETECTED — review details above.');
  } else if (warnCount > 0) {
    log('  All tests passed. Some warnings to review.');
  } else {
    log('  All tests passed cleanly.');
  }

  hr();

  // Write results to file
  fs.writeFileSync('/tmp/qa-jurisdictions.txt', lines.join('\n'), 'utf-8');
  log('');
  log('  Results written to /tmp/qa-jurisdictions.txt');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
