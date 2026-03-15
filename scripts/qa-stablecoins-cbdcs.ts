/**
 * QA Test Script — Stablecoins, CBDCs & Issuers
 *
 * Comprehensive validation of ALL data scenarios across:
 * - stablecoins (17 tests)
 * - cbdcs (10 tests)
 * - stablecoin_issuers (10 tests)
 * - cross-reference integrity (5 tests)
 *
 * Total: 42 test scenarios.
 *
 * Usage:
 *   cd /Users/antontitov/Vasp\ Tracker/remide && npx tsx scripts/qa-stablecoins-cbdcs.ts
 *
 * Output: console + /tmp/qa-stablecoins-cbdcs.txt
 */

import { getSupabase } from '../shared/supabase.js';
import * as fs from 'fs';

const sb = getSupabase();
const lines: string[] = [];

let passCount = 0;
let failCount = 0;
let warnCount = 0;

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
  const msg = `  [PASS] #${id}: ${desc}`;
  log(detail ? `${msg} — ${detail}` : msg);
}

function fail(id: number, desc: string, expected: string, actual: string) {
  failCount++;
  log(`  [FAIL] #${id}: ${desc}`);
  log(`         Expected: ${expected}`);
  log(`         Actual:   ${actual}`);
}

function warn(id: number, desc: string, detail: string) {
  warnCount++;
  log(`  [WARN] #${id}: ${desc} — ${detail}`);
}

function info(msg: string) {
  log(`         ${msg}`);
}

// ────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();
  log(`QA Test Suite: Stablecoins, CBDCs & Issuers`);
  log(`Run at: ${new Date().toISOString()}`);

  // ─── Fetch all data upfront ───
  log('');
  log('Fetching data from Supabase...');

  const { data: stablecoins, error: stErr } = await sb
    .from('stablecoins')
    .select('*');
  if (stErr) throw new Error(`stablecoins fetch: ${stErr.message}`);

  const { data: stablecoinJuris, error: sjErr } = await sb
    .from('stablecoin_jurisdictions')
    .select('*');
  if (sjErr) throw new Error(`stablecoin_jurisdictions fetch: ${sjErr.message}`);

  const { data: cbdcs, error: cbErr } = await sb
    .from('cbdcs')
    .select('*');
  if (cbErr) throw new Error(`cbdcs fetch: ${cbErr.message}`);

  const { data: issuers, error: isErr } = await sb
    .from('stablecoin_issuers')
    .select('*');
  if (isErr) throw new Error(`stablecoin_issuers fetch: ${isErr.message}`);

  const { data: blockchains, error: bcErr } = await sb
    .from('stablecoin_blockchains')
    .select('*');
  if (bcErr) throw new Error(`stablecoin_blockchains fetch: ${bcErr.message}`);

  const { data: licenses, error: lcErr } = await sb
    .from('issuer_licenses')
    .select('*');
  if (lcErr) throw new Error(`issuer_licenses fetch: ${lcErr.message}`);

  const { data: subsidiaries, error: subErr } = await sb
    .from('issuer_subsidiaries')
    .select('*');
  if (subErr) throw new Error(`issuer_subsidiaries fetch: ${subErr.message}`);

  const { data: laws, error: lawErr } = await sb
    .from('stablecoin_laws')
    .select('*');
  if (lawErr) throw new Error(`stablecoin_laws fetch: ${lawErr.message}`);

  const { data: events, error: evErr } = await sb
    .from('stablecoin_events')
    .select('*');
  if (evErr) throw new Error(`stablecoin_events fetch: ${evErr.message}`);

  log(`  Stablecoins:       ${stablecoins!.length}`);
  log(`  Stablecoin Juris:  ${stablecoinJuris!.length}`);
  log(`  CBDCs:             ${cbdcs!.length}`);
  log(`  Issuers:           ${issuers!.length}`);
  log(`  Blockchains:       ${blockchains!.length}`);
  log(`  Licenses:          ${licenses!.length}`);
  log(`  Subsidiaries:      ${subsidiaries!.length}`);
  log(`  Laws:              ${laws!.length}`);
  log(`  Events:            ${events!.length}`);

  // ══════════════════════════════════════════════════════════
  //  STABLECOIN TESTS
  // ══════════════════════════════════════════════════════════
  heading('STABLECOIN TESTS');

  const st = stablecoins!;

  // #1: All stablecoins have non-empty name
  {
    const empty = st.filter((s: any) => !s.name || s.name.trim() === '');
    if (empty.length === 0) {
      pass(1, 'All stablecoins have non-empty name', `${st.length} checked`);
    } else {
      fail(1, 'Stablecoins with empty name', '0 empty', `${empty.length} empty: ${empty.map((e: any) => e.id).join(', ')}`);
    }
  }

  // #2: All have non-empty ticker (max 10 chars)
  {
    const noTicker = st.filter((s: any) => !s.ticker || s.ticker.trim() === '');
    const longTicker = st.filter((s: any) => s.ticker && s.ticker.length > 10);
    if (noTicker.length === 0 && longTicker.length === 0) {
      pass(2, 'All stablecoins have valid ticker (non-empty, max 10 chars)', `${st.length} checked`);
    } else {
      if (noTicker.length > 0)
        fail(2, 'Stablecoins with empty ticker', '0 empty', `${noTicker.length}: ${noTicker.map((e: any) => e.id).join(', ')}`);
      if (longTicker.length > 0)
        fail(2, 'Stablecoins with ticker > 10 chars', '0 long', `${longTicker.length}: ${longTicker.map((e: any) => `${e.ticker}(${e.ticker.length})`).join(', ')}`);
    }
  }

  // #3: All have type in allowed set
  {
    const validTypes = ['Fiat-Backed', 'Crypto-Backed', 'Synthetic', 'Hybrid'];
    const invalid = st.filter((s: any) => !validTypes.includes(s.type));
    if (invalid.length === 0) {
      pass(3, 'All stablecoins have valid type', `Types used: ${[...new Set(st.map((s: any) => s.type))].join(', ')}`);
    } else {
      fail(3, 'Stablecoins with invalid type', `One of: ${validTypes.join(', ')}`, `Invalid: ${invalid.map((e: any) => `${e.ticker}=${e.type}`).join(', ')}`);
    }
  }

  // #4: Top 5 by market cap — should include USDT, USDC
  {
    const sorted = [...st].sort((a: any, b: any) => (b.market_cap_bn ?? 0) - (a.market_cap_bn ?? 0));
    const top5 = sorted.slice(0, 5);
    const top5Tickers = top5.map((s: any) => s.ticker);
    const hasUSDT = top5Tickers.includes('USDT');
    const hasUSDC = top5Tickers.includes('USDC');
    const top5Desc = top5.map((s: any) => `${s.ticker}($${s.market_cap_bn}B)`).join(', ');
    if (hasUSDT && hasUSDC) {
      pass(4, 'Top 5 by market cap includes USDT and USDC', top5Desc);
    } else {
      const missing = [];
      if (!hasUSDT) missing.push('USDT');
      if (!hasUSDC) missing.push('USDC');
      fail(4, 'Top 5 by market cap missing expected coins', 'USDT, USDC in top 5', `Missing: ${missing.join(', ')}. Top 5: ${top5Desc}`);
    }
  }

  // #5: No negative market caps; none > $200B
  {
    const negative = st.filter((s: any) => s.market_cap_bn !== null && s.market_cap_bn < 0);
    const tooHigh = st.filter((s: any) => s.market_cap_bn !== null && s.market_cap_bn > 200);
    if (negative.length === 0 && tooHigh.length === 0) {
      pass(5, 'No negative or unreasonably high market caps (>$200B)', `Range: $${Math.min(...st.map((s: any) => s.market_cap_bn ?? 0))}B – $${Math.max(...st.map((s: any) => s.market_cap_bn ?? 0))}B`);
    } else {
      if (negative.length > 0)
        fail(5, 'Negative market cap values', '0 negative', `${negative.map((e: any) => `${e.ticker}=$${e.market_cap_bn}B`).join(', ')}`);
      if (tooHigh.length > 0)
        warn(5, 'Unreasonably high market cap (>$200B)', `${tooHigh.map((e: any) => `${e.ticker}=$${e.market_cap_bn}B`).join(', ')}`);
    }
  }

  // #6: Peg currency distribution — most should be USD
  {
    const pegDist: Record<string, number> = {};
    for (const s of st) {
      const peg = (s as any).peg_currency || 'EMPTY';
      pegDist[peg] = (pegDist[peg] || 0) + 1;
    }
    const usdCount = pegDist['USD'] || 0;
    const usdPct = ((usdCount / st.length) * 100).toFixed(1);
    const distStr = Object.entries(pegDist)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}:${v}`)
      .join(', ');
    if (usdCount > st.length * 0.4) {
      pass(6, `Peg currency distribution — USD is dominant (${usdPct}%)`, distStr);
    } else {
      warn(6, 'USD is not the dominant peg currency', `USD: ${usdPct}%. Distribution: ${distStr}`);
    }
  }

  // #7: Issuer field — % non-empty
  {
    const withIssuer = st.filter((s: any) => s.issuer && s.issuer.trim() !== '');
    const pct = ((withIssuer.length / st.length) * 100).toFixed(1);
    if (withIssuer.length > st.length * 0.5) {
      pass(7, `Issuer field populated: ${pct}% (${withIssuer.length}/${st.length})`, '');
    } else {
      warn(7, `Issuer field sparse`, `Only ${pct}% populated (${withIssuer.length}/${st.length})`);
    }
  }

  // #8: Issuer country — % non-empty
  {
    const withCountry = st.filter((s: any) => s.issuer_country && s.issuer_country.trim() !== '');
    const pct = ((withCountry.length / st.length) * 100).toFixed(1);
    if (withCountry.length > st.length * 0.5) {
      pass(8, `Issuer country populated: ${pct}% (${withCountry.length}/${st.length})`, '');
    } else {
      warn(8, `Issuer country sparse`, `Only ${pct}% populated (${withCountry.length}/${st.length})`);
    }
  }

  // #9: Launch date format check (YYYY or YYYY-MM-DD)
  {
    const dateRegex = /^\d{4}(-\d{2}(-\d{2})?)?$/;
    const withDate = st.filter((s: any) => s.launch_date);
    const badFormat = withDate.filter((s: any) => !dateRegex.test(s.launch_date));
    if (badFormat.length === 0) {
      pass(9, `Launch date format valid`, `${withDate.length} have dates, ${st.length - withDate.length} null — all valid format`);
    } else {
      fail(9, 'Launch dates with bad format', 'YYYY or YYYY-MM-DD', `Bad: ${badFormat.map((e: any) => `${e.ticker}="${e.launch_date}"`).join(', ')}`);
    }
  }

  // #10: Chains field — should be array, check for empty arrays
  {
    const notArray = st.filter((s: any) => s.chains !== null && !Array.isArray(s.chains));
    const emptyArr = st.filter((s: any) => Array.isArray(s.chains) && s.chains.length === 0);
    const withChains = st.filter((s: any) => Array.isArray(s.chains) && s.chains.length > 0);
    if (notArray.length === 0) {
      pass(10, `Chains field is array for all stablecoins`, `${withChains.length} with chains, ${emptyArr.length} empty arrays, ${st.filter((s: any) => s.chains === null).length} null`);
    } else {
      fail(10, 'Chains field is not an array', 'All arrays', `${notArray.length} non-array values`);
    }
  }

  // #11: Reserve type — what values exist?
  {
    const reserveDist: Record<string, number> = {};
    for (const s of st) {
      const r = (s as any).reserve_type || 'NULL/EMPTY';
      reserveDist[r] = (reserveDist[r] || 0) + 1;
    }
    const distStr = Object.entries(reserveDist).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(', ');
    pass(11, 'Reserve type distribution', distStr);
  }

  // #12: Regulatory status — what values exist?
  {
    const regDist: Record<string, number> = {};
    for (const s of st) {
      const r = (s as any).regulatory_status || 'NULL/EMPTY';
      regDist[r] = (regDist[r] || 0) + 1;
    }
    const distStr = Object.entries(regDist).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(', ');
    pass(12, 'Regulatory status distribution', distStr);
  }

  // #13: Notes field — % with meaningful content (>10 chars)
  {
    const withNotes = st.filter((s: any) => s.notes && s.notes.trim().length > 10);
    const pct = ((withNotes.length / st.length) * 100).toFixed(1);
    pass(13, `Notes field: ${pct}% with meaningful content (>10 chars)`, `${withNotes.length}/${st.length}`);
  }

  // #14: Stablecoin jurisdictions — all tickers reference existing stablecoins
  {
    const stablecoinIds = new Set(st.map((s: any) => s.id));
    const orphanJuris = stablecoinJuris!.filter((sj: any) => !stablecoinIds.has(sj.stablecoin_id));
    const uniqueStablecoinsWithJuris = new Set(stablecoinJuris!.map((sj: any) => sj.stablecoin_id));
    if (orphanJuris.length === 0) {
      pass(14, `All stablecoin_jurisdictions reference valid stablecoins`, `${uniqueStablecoinsWithJuris.size} stablecoins have jurisdiction data, ${stablecoinJuris!.length} total rows`);
    } else {
      fail(14, 'Orphan stablecoin_jurisdictions', '0 orphans', `${orphanJuris.length} orphan rows referencing: ${[...new Set(orphanJuris.map((o: any) => o.stablecoin_id))].join(', ')}`);
    }
  }

  // #15: Stablecoin-jurisdiction statuses — valid values only
  {
    const validStatuses = ['Compliant', 'Allowed', 'Restricted', 'Non-Compliant', 'Pending', 'Discontinued', 'Unclear'];
    const invalid = stablecoinJuris!.filter((sj: any) => !validStatuses.includes(sj.status));
    const statusDist: Record<string, number> = {};
    for (const sj of stablecoinJuris!) {
      const st_ = (sj as any).status || 'NULL/EMPTY';
      statusDist[st_] = (statusDist[st_] || 0) + 1;
    }
    const distStr = Object.entries(statusDist).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(', ');
    if (invalid.length === 0) {
      pass(15, 'All stablecoin-jurisdiction statuses are valid', distStr);
    } else {
      fail(15, 'Invalid stablecoin-jurisdiction statuses', `One of: ${validStatuses.join(', ')}`, `${invalid.length} invalid: ${invalid.map((e: any) => `${e.stablecoin_id}/${e.country_code}="${e.status}"`).slice(0, 5).join(', ')}`);
    }
  }

  // #16: Any stablecoin with $0 market cap that's still listed as active?
  {
    const zeroMcap = st.filter((s: any) => (s.market_cap_bn === 0 || s.market_cap_bn === null));
    const activeStatuses = ['Regulated', 'Compliant', 'Active', 'Licensed'];
    const zeroAndActive = zeroMcap.filter((s: any) =>
      s.regulatory_status && activeStatuses.some((a) => s.regulatory_status.toLowerCase().includes(a.toLowerCase()))
    );
    if (zeroAndActive.length === 0) {
      pass(16, `No stablecoins with $0 market cap listed as active/regulated`, `${zeroMcap.length} have $0 or null market cap`);
    } else {
      warn(16, `Stablecoins with $0 market cap but active status`, `${zeroAndActive.map((e: any) => `${e.ticker}(status=${e.regulatory_status})`).join(', ')}`);
    }
  }

  // #17: Whitepaper URLs — valid format if present
  {
    const withWp = st.filter((s: any) => s.whitepaper_url && s.whitepaper_url.trim() !== '');
    const urlRegex = /^https?:\/\/.+/i;
    const badUrls = withWp.filter((s: any) => !urlRegex.test(s.whitepaper_url));
    if (badUrls.length === 0) {
      pass(17, `Whitepaper URLs valid format`, `${withWp.length}/${st.length} have whitepaper URLs`);
    } else {
      fail(17, 'Whitepaper URLs with invalid format', 'All start with http(s)://', `Bad: ${badUrls.map((e: any) => `${e.ticker}="${e.whitepaper_url}"`).join(', ')}`);
    }
  }

  // ══════════════════════════════════════════════════════════
  //  CBDC TESTS
  // ══════════════════════════════════════════════════════════
  heading('CBDC TESTS');

  const cb = cbdcs!;

  // #18: All CBDCs have non-empty name
  {
    const empty = cb.filter((c: any) => !c.name || c.name.trim() === '');
    if (empty.length === 0) {
      pass(18, 'All CBDCs have non-empty name', `${cb.length} checked`);
    } else {
      fail(18, 'CBDCs with empty name', '0 empty', `${empty.length} empty: ${empty.map((e: any) => e.id).join(', ')}`);
    }
  }

  // #19: All have country_code (2-char)
  {
    const noCode = cb.filter((c: any) => !c.country_code || c.country_code.length !== 2);
    if (noCode.length === 0) {
      pass(19, 'All CBDCs have valid 2-char country_code', `${cb.length} checked`);
    } else {
      fail(19, 'CBDCs with invalid country_code', 'All 2-char', `${noCode.length}: ${noCode.map((e: any) => `${e.name}="${e.country_code}"`).join(', ')}`);
    }
  }

  // #20: Status distribution
  {
    const statusDist: Record<string, number> = {};
    for (const c of cb) {
      const s = (c as any).status || 'NULL/EMPTY';
      statusDist[s] = (statusDist[s] || 0) + 1;
    }
    const validStatuses = ['Launched', 'Pilot', 'Development', 'Research', 'Cancelled', 'Inactive'];
    const invalid = cb.filter((c: any) => !validStatuses.includes(c.status));
    const distStr = Object.entries(statusDist).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(', ');
    if (invalid.length === 0) {
      pass(20, `CBDC status distribution — all valid`, distStr);
    } else {
      fail(20, 'Invalid CBDC statuses', `One of: ${validStatuses.join(', ')}`, `${invalid.length} invalid. Distribution: ${distStr}`);
    }
  }

  // #21: Retail/Wholesale/Hybrid distribution
  {
    const rwDist: Record<string, number> = {};
    for (const c of cb) {
      const rw = (c as any).retail_or_wholesale || 'NULL/EMPTY';
      rwDist[rw] = (rwDist[rw] || 0) + 1;
    }
    const distStr = Object.entries(rwDist).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(', ');
    pass(21, 'CBDC retail/wholesale distribution', distStr);
  }

  // #22: Central bank field — all non-empty?
  {
    const empty = cb.filter((c: any) => !c.central_bank || c.central_bank.trim() === '');
    if (empty.length === 0) {
      pass(22, 'All CBDCs have non-empty central_bank', `${cb.length} checked`);
    } else {
      fail(22, 'CBDCs with empty central_bank', '0 empty', `${empty.length}: ${empty.map((e: any) => `${e.name}(${e.country_code})`).join(', ')}`);
    }
  }

  // #23: Cross-border — how many true?
  {
    const crossBorderTrue = cb.filter((c: any) => c.cross_border === true);
    const crossBorderFalse = cb.filter((c: any) => c.cross_border === false);
    const crossBorderNull = cb.filter((c: any) => c.cross_border === null);
    pass(23, `Cross-border CBDCs`, `true:${crossBorderTrue.length}, false:${crossBorderFalse.length}, null:${crossBorderNull.length}`);
  }

  // #24: Technology field — % non-empty
  {
    const withTech = cb.filter((c: any) => c.technology && c.technology.trim() !== '');
    const pct = ((withTech.length / cb.length) * 100).toFixed(1);
    if (withTech.length > cb.length * 0.3) {
      pass(24, `Technology field populated: ${pct}%`, `${withTech.length}/${cb.length}`);
    } else {
      warn(24, `Technology field sparse`, `Only ${pct}% populated (${withTech.length}/${cb.length})`);
    }
  }

  // #25: Launch dates — check if Launched/Pilot CBDCs have them more than Research/Development
  {
    const launchedWithDate = cb.filter((c: any) => (c.status === 'Launched' || c.status === 'Pilot') && c.launch_date);
    const launchedTotal = cb.filter((c: any) => c.status === 'Launched' || c.status === 'Pilot');
    const researchWithDate = cb.filter((c: any) => (c.status === 'Research' || c.status === 'Development') && c.launch_date);
    const researchTotal = cb.filter((c: any) => c.status === 'Research' || c.status === 'Development');
    const launchedPct = launchedTotal.length > 0 ? ((launchedWithDate.length / launchedTotal.length) * 100).toFixed(1) : 'N/A';
    const researchPct = researchTotal.length > 0 ? ((researchWithDate.length / researchTotal.length) * 100).toFixed(1) : 'N/A';
    pass(25, `Launch dates: Launched/Pilot ${launchedPct}% have dates, Research/Dev ${researchPct}%`, `Launched/Pilot: ${launchedWithDate.length}/${launchedTotal.length}, Research/Dev: ${researchWithDate.length}/${researchTotal.length}`);
  }

  // #26: CBDC with status=Launched but no launch date
  {
    const launchedNoDate = cb.filter((c: any) => c.status === 'Launched' && !c.launch_date);
    if (launchedNoDate.length === 0) {
      pass(26, 'All Launched CBDCs have launch dates', '');
    } else {
      warn(26, `Launched CBDCs without launch date`, `${launchedNoDate.length}: ${launchedNoDate.map((e: any) => `${e.name}(${e.country_code})`).join(', ')}`);
    }
  }

  // #27: Currency field — all non-empty?
  {
    const empty = cb.filter((c: any) => !c.currency || c.currency.trim() === '');
    if (empty.length === 0) {
      pass(27, 'All CBDCs have non-empty currency field', `${cb.length} checked`);
    } else {
      fail(27, 'CBDCs with empty currency', '0 empty', `${empty.length}: ${empty.map((e: any) => `${e.name}(${e.country_code})`).join(', ')}`);
    }
  }

  // ══════════════════════════════════════════════════════════
  //  ISSUER TESTS
  // ══════════════════════════════════════════════════════════
  heading('ISSUER TESTS');

  const iss = issuers!;

  // #28: All issuers have non-empty name
  {
    const empty = iss.filter((i: any) => !i.name || i.name.trim() === '');
    if (empty.length === 0) {
      pass(28, 'All issuers have non-empty name', `${iss.length} checked`);
    } else {
      fail(28, 'Issuers with empty name', '0 empty', `${empty.length}: ${empty.map((e: any) => e.id).join(', ')}`);
    }
  }

  // #29: All have slug (for URL routing)
  {
    const noSlug = iss.filter((i: any) => !i.slug || i.slug.trim() === '');
    if (noSlug.length === 0) {
      pass(29, 'All issuers have slug for URL routing', `${iss.length} checked`);
    } else {
      fail(29, 'Issuers without slug', '0 without slug', `${noSlug.length}: ${noSlug.map((e: any) => e.name).join(', ')}`);
    }
  }

  // #30: LEI format — 20 alphanumeric chars if present
  {
    const withLei = iss.filter((i: any) => i.lei && i.lei.trim() !== '');
    const leiRegex = /^[A-Z0-9]{20}$/;
    const badLei = withLei.filter((i: any) => !leiRegex.test(i.lei.trim()));
    if (badLei.length === 0) {
      pass(30, `LEI format valid`, `${withLei.length}/${iss.length} have LEI, all valid 20-char alphanumeric`);
    } else {
      fail(30, 'LEI with invalid format', '20 uppercase alphanumeric chars', `${badLei.length} invalid: ${badLei.map((e: any) => `${e.name}="${e.lei}"`).slice(0, 5).join(', ')}`);
    }
  }

  // #31: Country codes — all valid 2-char
  {
    const withCode = iss.filter((i: any) => i.country_code && i.country_code.trim() !== '');
    const badCode = withCode.filter((i: any) => !/^[A-Z]{2}$/.test(i.country_code.trim()));
    const noCode = iss.filter((i: any) => !i.country_code || i.country_code.trim() === '');
    if (badCode.length === 0) {
      pass(31, `Country codes valid 2-char`, `${withCode.length} with code (${noCode.length} empty), all valid`);
    } else {
      fail(31, 'Invalid country codes on issuers', 'All 2-char uppercase', `${badCode.length} invalid: ${badCode.map((e: any) => `${e.name}="${e.country_code}"`).join(', ')}`);
    }
  }

  // #32: Verified issuers count
  {
    const verified = iss.filter((i: any) => i.is_verified === true);
    const pct = ((verified.length / iss.length) * 100).toFixed(1);
    pass(32, `Verified issuers: ${verified.length}/${iss.length} (${pct}%)`, '');
  }

  // #33: Auditor field — % non-empty
  {
    const withAuditor = iss.filter((i: any) => i.auditor && i.auditor.trim() !== '');
    const pct = ((withAuditor.length / iss.length) * 100).toFixed(1);
    pass(33, `Auditor field: ${pct}% populated`, `${withAuditor.length}/${iss.length}. Examples: ${withAuditor.slice(0, 3).map((e: any) => `${e.name}→"${e.auditor}"`).join(', ')}`);
  }

  // #34: Website — % with valid URLs
  {
    const withWebsite = iss.filter((i: any) => i.website && i.website.trim() !== '');
    const urlRegex = /^https?:\/\/.+/i;
    const validUrls = withWebsite.filter((i: any) => urlRegex.test(i.website));
    const badUrls = withWebsite.filter((i: any) => !urlRegex.test(i.website));
    const pct = ((withWebsite.length / iss.length) * 100).toFixed(1);
    if (badUrls.length === 0) {
      pass(34, `Website field: ${pct}% have valid URLs`, `${withWebsite.length}/${iss.length}`);
    } else {
      warn(34, `Some websites invalid format`, `${badUrls.length} bad: ${badUrls.map((e: any) => `${e.name}="${e.website}"`).slice(0, 5).join(', ')}`);
    }
  }

  // #35: Official name vs name — how many differ?
  {
    const withOfficialName = iss.filter((i: any) => i.official_name && i.official_name.trim() !== '');
    const differ = withOfficialName.filter((i: any) => i.official_name.trim() !== i.name.trim());
    pass(35, `Official name vs name`, `${withOfficialName.length}/${iss.length} have official_name, ${differ.length} differ from name. Examples: ${differ.slice(0, 3).map((e: any) => `"${e.name}" vs "${e.official_name}"`).join('; ')}`);
  }

  // #36: Former names — how many have them?
  {
    const withFormer = iss.filter((i: any) => i.former_names && i.former_names.trim() !== '');
    const pct = ((withFormer.length / iss.length) * 100).toFixed(1);
    pass(36, `Former names: ${withFormer.length}/${iss.length} (${pct}%)`, withFormer.length > 0 ? `Examples: ${withFormer.slice(0, 3).map((e: any) => `${e.name}→"${e.former_names}"`).join('; ')}` : 'None');
  }

  // #37: Description — % with meaningful descriptions (>20 chars)
  {
    const withDesc = iss.filter((i: any) => i.description && i.description.trim().length > 20);
    const pct = ((withDesc.length / iss.length) * 100).toFixed(1);
    pass(37, `Description field: ${pct}% with meaningful content (>20 chars)`, `${withDesc.length}/${iss.length}`);
  }

  // ══════════════════════════════════════════════════════════
  //  CROSS-REFERENCE TESTS
  // ══════════════════════════════════════════════════════════
  heading('CROSS-REFERENCE TESTS');

  // #38: Every stablecoin issuer_id references a valid issuer
  {
    const issuerStrideIds = new Set(iss.map((i: any) => i.stride_id));
    const stWithIssuerId = st.filter((s: any) => s.issuer_id !== null && s.issuer_id !== undefined);
    const orphans = stWithIssuerId.filter((s: any) => !issuerStrideIds.has(s.issuer_id));
    if (orphans.length === 0) {
      pass(38, `All stablecoin issuer_id references valid issuers`, `${stWithIssuerId.length}/${st.length} have issuer_id`);
    } else {
      fail(38, 'Orphan stablecoin issuer_id references', '0 orphans', `${orphans.length}: ${orphans.map((e: any) => `${e.ticker}→issuer_id=${e.issuer_id}`).join(', ')}`);
    }
  }

  // #39: Stablecoin blockchain tickers match existing stablecoins
  {
    const stTickers = new Set(st.map((s: any) => s.ticker));
    const bcTickers = [...new Set(blockchains!.map((b: any) => b.stablecoin_ticker))];
    const orphanTickers = bcTickers.filter((t: any) => !stTickers.has(t));
    if (orphanTickers.length === 0) {
      pass(39, `All blockchain deployment tickers match existing stablecoins`, `${bcTickers.length} unique tickers, ${blockchains!.length} total deployments`);
    } else {
      fail(39, 'Blockchain deployments reference non-existent stablecoins', '0 orphan tickers', `${orphanTickers.length}: ${orphanTickers.join(', ')}`);
    }
  }

  // #40: Issuer licenses reference valid issuers
  {
    const issuerStrideIds = new Set(iss.map((i: any) => i.stride_id));
    const orphanLicenses = licenses!.filter((l: any) => !issuerStrideIds.has(l.issuer_stride_id));
    if (orphanLicenses.length === 0) {
      pass(40, `All issuer licenses reference valid issuers`, `${licenses!.length} licenses checked`);
    } else {
      fail(40, 'Orphan issuer licenses', '0 orphans', `${orphanLicenses.length} licenses with invalid issuer_stride_id: ${[...new Set(orphanLicenses.map((l: any) => l.issuer_stride_id))].slice(0, 10).join(', ')}`);
    }
  }

  // #41: Issuer subsidiaries reference valid issuers
  {
    const issuerStrideIds = new Set(iss.map((i: any) => i.stride_id));
    const orphanSubs = subsidiaries!.filter((s: any) => !issuerStrideIds.has(s.issuer_stride_id));
    if (orphanSubs.length === 0) {
      pass(41, `All issuer subsidiaries reference valid issuers`, `${subsidiaries!.length} subsidiaries checked`);
    } else {
      fail(41, 'Orphan issuer subsidiaries', '0 orphans', `${orphanSubs.length} subs with invalid issuer_stride_id: ${[...new Set(orphanSubs.map((s: any) => s.issuer_stride_id))].slice(0, 10).join(', ')}`);
    }
  }

  // #42: No orphan records in junction tables — laws/events reference valid country_codes from jurisdictions
  {
    const { data: jurisdictions, error: jurErr } = await sb
      .from('jurisdictions')
      .select('code');
    if (jurErr) throw new Error(`jurisdictions fetch: ${jurErr.message}`);

    const jurCodes = new Set(jurisdictions!.map((j: any) => j.code));

    // Check laws
    const lawOrphans = laws!.filter((l: any) => !jurCodes.has(l.country_code));
    const lawOrphanCodes = [...new Set(lawOrphans.map((l: any) => l.country_code))];

    // Check events
    const eventOrphans = events!.filter((e: any) => !jurCodes.has(e.country_code));
    const eventOrphanCodes = [...new Set(eventOrphans.map((e: any) => e.country_code))];

    // Check stablecoin_jurisdictions
    const sjOrphans = stablecoinJuris!.filter((sj: any) => !jurCodes.has(sj.country_code));
    const sjOrphanCodes = [...new Set(sjOrphans.map((sj: any) => sj.country_code))];

    const totalOrphans = lawOrphans.length + eventOrphans.length + sjOrphans.length;
    if (totalOrphans === 0) {
      pass(42, `No orphan country_codes in junction tables`, `Laws: ${laws!.length}, Events: ${events!.length}, Stablecoin Juris: ${stablecoinJuris!.length}`);
    } else {
      const details: string[] = [];
      if (lawOrphans.length > 0) details.push(`Laws: ${lawOrphans.length} rows, codes: ${lawOrphanCodes.join(',')}`);
      if (eventOrphans.length > 0) details.push(`Events: ${eventOrphans.length} rows, codes: ${eventOrphanCodes.join(',')}`);
      if (sjOrphans.length > 0) details.push(`Stablecoin Juris: ${sjOrphans.length} rows, codes: ${sjOrphanCodes.join(',')}`);
      warn(42, `Orphan country_codes in junction tables`, details.join('. '));
    }
  }

  // ══════════════════════════════════════════════════════════
  //  SUMMARY
  // ══════════════════════════════════════════════════════════
  heading('SUMMARY');

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  log(`  Total tests:   42`);
  log(`  PASS:          ${passCount}`);
  log(`  FAIL:          ${failCount}`);
  log(`  WARN:          ${warnCount}`);
  log(`  Time:          ${elapsed}s`);
  log('');

  if (failCount === 0) {
    log('  >>> ALL TESTS PASSED <<<');
  } else {
    log(`  >>> ${failCount} TEST(S) FAILED <<<`);
  }
  log('');

  // Write to file
  const outPath = '/tmp/qa-stablecoins-cbdcs.txt';
  fs.writeFileSync(outPath, lines.join('\n'), 'utf-8');
  log(`Results written to: ${outPath}`);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
