/**
 * Stride Stablecoin Regulation Tracker Parser
 * Source: https://tracker.stride.sc (public REST API, no auth)
 *
 * Scrapes ALL data:
 * - 195+ countries with regulatory framework data
 * - 47+ stablecoin issuers with corporate info (LEI, CIK, auditor)
 * - 68+ stablecoins with blockchain deployments & contract addresses
 * - Laws and regulatory events per country
 * - Issuer subsidiaries and licenses
 *
 * Data written to:
 * - jurisdictions (enrichment: stablecoin_stage, backing statuses, descriptions)
 * - stablecoins (enrichment: whitepaper, coinmarketcap_id, collateral)
 * - stablecoin_issuers (new table)
 * - stablecoin_laws (new table)
 * - stablecoin_events (new table)
 * - issuer_subsidiaries (new table)
 * - issuer_licenses (new table)
 * - stablecoin_blockchains (new table)
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../core/logger.js';
import { numericToAlpha2, normalizeCountryName, expandRegionalCode } from '../core/country-codes.js';

const BASE_URL = 'https://tracker.stride.sc/api';
const PARSER_ID = 'stride-tracker';

// ── Stride API response types ──

interface StrideCountryTable {
  id: number;
  name: string;
  stage: number;
  fiat_backed: number;
  fiat_alert: string | null;
  crypto_backed: number;
  crypto_alert: string | null;
  commodity_backed: number;
  commodity_alert: string | null;
  algorithm_backed: number;
  algorithm_alert: string | null;
  is_stablecoin_specific: number;
}

interface StrideCountryDetail {
  id: number;
  name: string;
  stage: number;
  is_stablecoin_specific: number;
  yield_allowed: number;
  fiat_backed: number;
  fiat_alert: string | null;
  crypto_backed: number;
  crypto_alert: string | null;
  commodity_backed: number;
  commodity_alert: string | null;
  algorithm_backed: number;
  algorithm_alert: string | null;
  description: string | null;
  regulator_name: string | null;
  regulator_description: string | null;
  currency: string | null;
  sponsor_name: string | null;
  sponsor_id: number | null;
  stablecoins_hq_count: number;
  stablecoins_currency_count: number;
}

interface StrideIssuerTable {
  id: number;
  name: string;
  country_id: number;
  is_verified: number | null;
  country_name: string;
  stablecoin_ids: number[];
  stablecoin_symbols: string[];
}

interface StrideIssuerDetail {
  id: number;
  name: string;
  official_name: string | null;
  former_names: string | null;
  lei: string | null;
  cik: string | null;
  auditor: string | null;
  description: string | null;
  assurance_frequency: string | null;
  redemption_policy: string | null;
  country_id: number;
  is_verified: number | null;
  website: string | null;
  country_name: string;
}

interface StrideStablecoin {
  stablecoin_id: number;
  stablecoin_name: string;
  stablecoin_symbol: string;
  inception_date: string | null;
  whitepaper: string | null;
  reference_currency: string;
  collateral_method: string | null;
  add_info: string | null;
  ucid: number | null;
  ucid_link: string | null;
  blockchains: Array<{
    id: number;
    name: string;
    contract_address: string;
    date: string | null;
  }>;
}

interface StrideSubsidiary {
  id: number;
  name: string;
  lei: string | null;
  issuer_id: number;
  can_issue: number;
  country_id: number;
  incorporation_date: string | null;
  description: string | null;
  country_name: string;
}

interface StrideLicense {
  id: number;
  title: string;
  detail: string | null;
  can_issue: number;
  issuer_id: number;
  subsidiary_id: number | null;
  country_id: number;
  subsidiary_name: string | null;
  country_name: string;
}

interface StrideLaw {
  id: number;
  country_id: number;
  title: string;
  enacted_date: string | null;
  description: string;
  citation: string | null;
}

interface StrideEvent {
  id: number;
  timeline_id: number;
  date: string; // DD/MM/YYYY
  type: number;
  title: string;
  details: string | null;
  citation: string | null;
}

// ── Stats tracking ──

interface StrideParseStats {
  countries: number;
  countryDetails: number;
  issuers: number;
  stablecoins: number;
  laws: number;
  events: number;
  subsidiaries: number;
  licenses: number;
  blockchains: number;
  errors: string[];
  warnings: string[];
}

// ── Helper functions ──

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Parse Stride date format DD/MM/YYYY → YYYY-MM-DD */
function parseStrideDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const s = dateStr.trim();

  // Already ISO: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // DD/MM/YYYY
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const [, day, month, year] = dmy;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // YYYY-MM-DD with suffix, e.g. "2025-12-29 (Presidential assent)"
  const isoPrefix = s.match(/^(\d{4}-\d{2}-\d{2})\b/);
  if (isoPrefix) return isoPrefix[1];

  // YYYY-MM only, e.g. "2021-07" → first of month
  if (/^\d{4}-\d{2}$/.test(s)) return `${s}-01`;

  // "Draft (Published YYYY-MM-DD)" or similar embedded dates
  const embedded = s.match(/(\d{4}-\d{2}-\d{2})/);
  if (embedded) return embedded[1];

  // Text like "Under Consultation", "2026 Q1 Scheduled" → not a valid date
  return null;
}

async function fetchJson<T>(path: string, rateLimitMs = 500): Promise<T> {
  await delay(rateLimitMs);
  const url = `${BASE_URL}${path}`;
  logger.debug(PARSER_ID, `GET ${url}`);

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'RemiDe-Parser/1.0 (https://remide.xyz)',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return response.json() as Promise<T>;
}

function getSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key);
}

// ── Main parser ──

export async function parseStrideTracker(): Promise<StrideParseStats> {
  const sb = getSupabase();
  const stats: StrideParseStats = {
    countries: 0, countryDetails: 0, issuers: 0, stablecoins: 0,
    laws: 0, events: 0, subsidiaries: 0, licenses: 0, blockchains: 0,
    errors: [], warnings: [],
  };

  const dryRun = process.env.DRY_RUN === 'true' || process.env.DRY_RUN === '1';
  const startTime = Date.now();

  logger.info(PARSER_ID, `Starting Stride tracker parse${dryRun ? ' (DRY RUN)' : ''}`);

  // ═══ STEP 1: Countries (table + detail) ═══

  logger.info(PARSER_ID, 'Step 1/5: Fetching countries...');
  const { data: countryTable } = await fetchJson<{ data: StrideCountryTable[] }>('/countries/table');
  stats.countries = countryTable.length;
  logger.info(PARSER_ID, `  Got ${countryTable.length} countries from table`);

  // Fetch details for countries with live/developing frameworks (stage > 0)
  const countriesWithFramework = countryTable.filter((c) => c.stage > 0);
  logger.info(PARSER_ID, `  Fetching details for ${countriesWithFramework.length} countries with frameworks...`);

  const countryDetails: StrideCountryDetail[] = [];
  for (const country of countriesWithFramework) {
    try {
      const detail = await fetchJson<StrideCountryDetail>(`/countries/${country.id}`, 300);
      countryDetails.push(detail);
    } catch (err) {
      stats.warnings.push(`Country detail ${country.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  stats.countryDetails = countryDetails.length;
  logger.info(PARSER_ID, `  Got ${countryDetails.length} country details`);

  // Write jurisdictions
  if (!dryRun) {
    await writeJurisdictions(sb, countryTable, countryDetails, stats);
  }

  // Fetch laws and events for countries with frameworks
  logger.info(PARSER_ID, '  Fetching laws and events...');
  const allLaws: Array<StrideLaw & { countryCode: string }> = [];
  const allEvents: Array<StrideEvent & { countryCode: string }> = [];

  for (const country of countriesWithFramework) {
    const cc = numericToAlpha2(country.id);
    if (!cc) continue;

    try {
      const laws = await fetchJson<StrideLaw[]>(`/laws/${country.id}`, 200);
      for (const law of laws) allLaws.push({ ...law, countryCode: cc });
    } catch { /* some countries have no laws */ }

    try {
      const events = await fetchJson<StrideEvent[]>(`/events/country/${country.id}`, 200);
      for (const ev of events) allEvents.push({ ...ev, countryCode: cc });
    } catch { /* some countries have no events */ }
  }

  stats.laws = allLaws.length;
  stats.events = allEvents.length;
  logger.info(PARSER_ID, `  Got ${allLaws.length} laws, ${allEvents.length} events`);

  if (!dryRun) {
    await writeLaws(sb, allLaws, stats);
    await writeEvents(sb, allEvents, stats);
  }

  // ═══ STEP 2: Issuers ═══

  logger.info(PARSER_ID, 'Step 2/5: Fetching issuers...');
  const { data: issuerTable } = await fetchJson<{ data: StrideIssuerTable[] }>('/issuers/table');
  stats.issuers = issuerTable.length;
  logger.info(PARSER_ID, `  Got ${issuerTable.length} issuers from table`);

  const issuerDetails: StrideIssuerDetail[] = [];
  for (const issuer of issuerTable) {
    try {
      const { issuer: detail } = await fetchJson<{ issuer: StrideIssuerDetail }>(`/issuers/${issuer.id}`, 300);
      issuerDetails.push(detail);
    } catch (err) {
      stats.warnings.push(`Issuer detail ${issuer.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (!dryRun) {
    await writeIssuers(sb, issuerDetails, stats);
  }

  // ═══ STEP 3: Stablecoins (per issuer) ═══

  logger.info(PARSER_ID, 'Step 3/5: Fetching stablecoins...');
  const allStablecoins: Array<StrideStablecoin & { issuerStrideId: number; issuerName: string }> = [];

  for (const issuer of issuerTable) {
    try {
      const coins = await fetchJson<StrideStablecoin[]>(`/stablecoins/issuer/${issuer.id}`, 300);
      for (const coin of coins) {
        allStablecoins.push({ ...coin, issuerStrideId: issuer.id, issuerName: issuer.name });
      }
    } catch { /* issuer may have no stablecoins */ }
  }

  stats.stablecoins = allStablecoins.length;
  logger.info(PARSER_ID, `  Got ${allStablecoins.length} stablecoins`);

  if (!dryRun) {
    await writeStablecoins(sb, allStablecoins, stats);
  }

  // ═══ STEP 4: Subsidiaries (per issuer) ═══

  logger.info(PARSER_ID, 'Step 4/5: Fetching subsidiaries and licenses...');
  const allSubsidiaries: StrideSubsidiary[] = [];
  const allLicenses: StrideLicense[] = [];

  for (const issuer of issuerTable) {
    try {
      const subs = await fetchJson<StrideSubsidiary[]>(`/subsidiaries/issuer/${issuer.id}`, 200);
      allSubsidiaries.push(...subs);
    } catch { /* ok */ }

    try {
      const lics = await fetchJson<StrideLicense[]>(`/licenses/issuer/${issuer.id}`, 200);
      allLicenses.push(...lics);
    } catch { /* ok */ }
  }

  stats.subsidiaries = allSubsidiaries.length;
  stats.licenses = allLicenses.length;
  logger.info(PARSER_ID, `  Got ${allSubsidiaries.length} subsidiaries, ${allLicenses.length} licenses`);

  if (!dryRun) {
    await writeSubsidiaries(sb, allSubsidiaries, stats);
    await writeLicenses(sb, allLicenses, stats);
  }

  // ═══ STEP 5: Summary ═══

  const durationMs = Date.now() - startTime;
  logger.info(PARSER_ID, [
    `Done in ${(durationMs / 1000).toFixed(1)}s.`,
    `Countries: ${stats.countries} (${stats.countryDetails} detailed)`,
    `Issuers: ${stats.issuers}, Stablecoins: ${stats.stablecoins}`,
    `Laws: ${stats.laws}, Events: ${stats.events}`,
    `Subsidiaries: ${stats.subsidiaries}, Licenses: ${stats.licenses}`,
    `Blockchains: ${stats.blockchains}`,
    `Errors: ${stats.errors.length}, Warnings: ${stats.warnings.length}`,
  ].join(' | '));

  return stats;
}

// ── Write functions ──

async function writeJurisdictions(
  sb: SupabaseClient,
  table: StrideCountryTable[],
  details: StrideCountryDetail[],
  stats: StrideParseStats,
): Promise<void> {
  const detailMap = new Map(details.map((d) => [d.id, d]));

  for (const country of table) {
    const cc = numericToAlpha2(country.id);
    if (!cc) {
      stats.warnings.push(`No alpha-2 mapping for numeric ${country.id} (${country.name})`);
      continue;
    }

    const detail = detailMap.get(country.id);
    const updateData: Record<string, unknown> = {
      stride_id: country.id,
      stablecoin_stage: country.stage,
      is_stablecoin_specific: country.is_stablecoin_specific === 1,
      fiat_backed: country.fiat_backed,
      fiat_alert: country.fiat_alert ?? '',
      crypto_backed: country.crypto_backed,
      crypto_alert: country.crypto_alert ?? '',
      commodity_backed: country.commodity_backed,
      commodity_alert: country.commodity_alert ?? '',
      algorithm_backed: country.algorithm_backed,
      algorithm_alert: country.algorithm_alert ?? '',
    };

    if (detail) {
      updateData.yield_allowed = detail.yield_allowed === 1;
      updateData.stablecoin_description = detail.description ?? '';
      updateData.regulator_description = detail.regulator_description ?? '';
      updateData.currency = detail.currency ?? '';
      if (detail.regulator_name) {
        updateData.stride_data = {
          regulator_name: detail.regulator_name,
          sponsor_name: detail.sponsor_name,
          stablecoins_hq_count: detail.stablecoins_hq_count,
          stablecoins_currency_count: detail.stablecoins_currency_count,
        };
      }
    }

    // EU → expand to 27 member states (no 'EU' row in jurisdictions table)
    const targetCodes = expandRegionalCode(cc);

    for (const targetCode of targetCodes) {
      const { error } = await sb
        .from('jurisdictions')
        .update(updateData)
        .eq('code', targetCode);

      if (error) {
        // Jurisdiction may not exist in our DB (we have 206, Stride has 195)
        logger.debug(PARSER_ID, `Skip jurisdiction ${targetCode}: ${error.message}`);
      }
    }
  }

  logger.info(PARSER_ID, `  Written jurisdiction enrichment for ${table.length} countries`);
}

async function writeLaws(
  sb: SupabaseClient,
  laws: Array<StrideLaw & { countryCode: string }>,
  stats: StrideParseStats,
): Promise<void> {
  if (laws.length === 0) return;

  // Clear existing stride laws
  await sb.from('stablecoin_laws').delete().gt('id', 0);

  const rows = laws.map((law) => ({
    stride_id: law.id,
    country_code: law.countryCode,
    title: law.title,
    enacted_date: parseStrideDate(law.enacted_date),
    description: law.description ?? '',
    citation_url: law.citation ?? '',
  }));

  // Insert in chunks
  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows.slice(i, i + 50);
    const { error } = await sb.from('stablecoin_laws').insert(chunk);
    if (error) {
      stats.errors.push(`Laws chunk ${Math.floor(i / 50)}: ${error.message}`);
    }
  }
}

async function writeEvents(
  sb: SupabaseClient,
  events: Array<StrideEvent & { countryCode: string }>,
  stats: StrideParseStats,
): Promise<void> {
  if (events.length === 0) return;

  await sb.from('stablecoin_events').delete().gt('id', 0);

  const rows = events.map((ev) => ({
    stride_id: ev.id,
    country_code: ev.countryCode,
    event_date: parseStrideDate(ev.date),
    event_type: ev.type,
    title: ev.title,
    details: ev.details ?? '',
    citation_url: ev.citation ?? '',
  }));

  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows.slice(i, i + 50);
    const { error } = await sb.from('stablecoin_events').insert(chunk);
    if (error) {
      stats.errors.push(`Events chunk ${Math.floor(i / 50)}: ${error.message}`);
    }
  }
}

async function writeIssuers(
  sb: SupabaseClient,
  issuers: StrideIssuerDetail[],
  stats: StrideParseStats,
): Promise<void> {
  if (issuers.length === 0) return;

  // Clear and rewrite
  await sb.from('stablecoin_issuers').delete().gt('id', 0);

  const rows = issuers.map((issuer) => {
    const cc = numericToAlpha2(issuer.country_id);
    return {
      stride_id: issuer.id,
      name: issuer.name,
      official_name: issuer.official_name ?? '',
      former_names: issuer.former_names ?? '',
      lei: issuer.lei ?? '',
      cik: issuer.cik ?? '',
      auditor: issuer.auditor ?? '',
      description: issuer.description ?? '',
      assurance_frequency: issuer.assurance_frequency ?? '',
      redemption_policy: issuer.redemption_policy ?? '',
      website: issuer.website ?? '',
      country_code: cc ?? '',
      country: cc ? normalizeCountryName(issuer.country_name) : issuer.country_name,
      is_verified: issuer.is_verified === 1,
    };
  });

  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows.slice(i, i + 50);
    const { error } = await sb.from('stablecoin_issuers').insert(chunk);
    if (error) {
      stats.errors.push(`Issuers chunk ${Math.floor(i / 50)}: ${error.message}`);
    }
  }
}

async function writeStablecoins(
  sb: SupabaseClient,
  coins: Array<StrideStablecoin & { issuerStrideId: number; issuerName: string }>,
  stats: StrideParseStats,
): Promise<void> {
  if (coins.length === 0) return;

  // Deduplicate by stablecoin_id
  const seen = new Set<number>();
  const unique = coins.filter((c) => {
    if (seen.has(c.stablecoin_id)) return false;
    seen.add(c.stablecoin_id);
    return true;
  });

  for (const coin of unique) {
    const ticker = coin.stablecoin_symbol.toUpperCase();
    const existingId = ticker.toLowerCase();

    // Try to update existing stablecoin by matching ticker → id
    const { data: existing } = await sb
      .from('stablecoins')
      .select('id')
      .eq('id', existingId)
      .maybeSingle();

    if (existing) {
      // Enrich existing
      const { error } = await sb
        .from('stablecoins')
        .update({
          stride_id: coin.stablecoin_id,
          whitepaper_url: coin.whitepaper ?? '',
          coinmarketcap_id: coin.ucid,
          collateral_method: coin.collateral_method ?? '',
          issuer_id: coin.issuerStrideId,
          stride_data: {
            inception_date: coin.inception_date,
            reference_currency: coin.reference_currency,
            add_info: coin.add_info,
            ucid_link: coin.ucid_link,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingId);

      if (error) {
        stats.warnings.push(`Update stablecoin ${existingId}: ${error.message}`);
      }
    } else {
      // Insert new stablecoin
      const { error } = await sb.from('stablecoins').insert({
        id: existingId,
        name: coin.stablecoin_name,
        ticker: ticker,
        type: guessStablecoinType(coin.collateral_method),
        peg_currency: coin.reference_currency,
        issuer: coin.issuerName,
        issuer_country: '',
        launch_date: parseStrideDate(coin.inception_date),
        market_cap_bn: 0, // Stride doesn't provide market cap
        chains: coin.blockchains.map((b) => b.name),
        reserve_type: coin.collateral_method?.split('\n')[0] ?? null,
        whitepaper_url: coin.whitepaper ?? '',
        coinmarketcap_id: coin.ucid,
        collateral_method: coin.collateral_method ?? '',
        issuer_id: coin.issuerStrideId,
        stride_id: coin.stablecoin_id,
        stride_data: {
          inception_date: coin.inception_date,
          reference_currency: coin.reference_currency,
          add_info: coin.add_info,
          ucid_link: coin.ucid_link,
        },
      });

      if (error) {
        stats.warnings.push(`Insert stablecoin ${existingId}: ${error.message}`);
      }
    }

    // Write blockchain deployments (skip entries with null name)
    for (const bc of coin.blockchains) {
      if (!bc.name) {
        stats.warnings.push(`Blockchain ${ticker}: skipping entry with null name`);
        continue;
      }
      const { error } = await sb.from('stablecoin_blockchains').upsert(
        {
          stablecoin_ticker: ticker,
          blockchain_name: bc.name,
          contract_address: bc.contract_address ?? '',
          deploy_date: parseStrideDate(bc.date),
          stride_blockchain_id: bc.id,
        },
        { onConflict: 'stablecoin_ticker,blockchain_name' },
      );

      if (!error) stats.blockchains++;
      else stats.warnings.push(`Blockchain ${ticker}/${bc.name}: ${error.message}`);
    }
  }

  logger.info(PARSER_ID, `  Written ${unique.length} stablecoins, ${stats.blockchains} blockchain deployments`);
}

function guessStablecoinType(collateral: string | null): string {
  if (!collateral) return 'Fiat-Backed'; // Default assumption
  const lower = collateral.toLowerCase();
  if (lower.includes('treasury') || lower.includes('bank deposit') || lower.includes('money market')) {
    return 'Fiat-Backed';
  }
  if (lower.includes('crypto') || lower.includes('ethereum') || lower.includes('bitcoin')) {
    return 'Crypto-Backed';
  }
  if (lower.includes('gold') || lower.includes('commodity')) {
    return 'Fiat-Backed'; // Commodity-backed → closest match in our type system
  }
  if (lower.includes('algorithm')) {
    return 'Synthetic'; // Algorithmic → maps to Synthetic in our type system
  }
  return 'Fiat-Backed'; // Default assumption
}

async function writeSubsidiaries(
  sb: SupabaseClient,
  subs: StrideSubsidiary[],
  stats: StrideParseStats,
): Promise<void> {
  if (subs.length === 0) return;

  await sb.from('issuer_subsidiaries').delete().gt('id', 0);

  const rows = subs.map((sub) => {
    const cc = numericToAlpha2(sub.country_id);
    return {
      stride_id: sub.id,
      issuer_stride_id: sub.issuer_id,
      name: sub.name,
      lei: sub.lei ?? '',
      country_code: cc ?? '',
      country: cc ? normalizeCountryName(sub.country_name) : sub.country_name,
      can_issue: sub.can_issue === 1,
      incorporation_date: parseStrideDate(sub.incorporation_date),
      description: sub.description ?? '',
    };
  });

  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows.slice(i, i + 50);
    const { error } = await sb.from('issuer_subsidiaries').insert(chunk);
    if (error) {
      stats.errors.push(`Subsidiaries chunk ${Math.floor(i / 50)}: ${error.message}`);
    }
  }
}

async function writeLicenses(
  sb: SupabaseClient,
  lics: StrideLicense[],
  stats: StrideParseStats,
): Promise<void> {
  if (lics.length === 0) return;

  await sb.from('issuer_licenses').delete().gt('id', 0);

  const rows = lics.map((lic) => {
    const cc = numericToAlpha2(lic.country_id);
    return {
      stride_id: lic.id,
      issuer_stride_id: lic.issuer_id,
      title: lic.title,
      detail: lic.detail ?? '',
      can_issue: lic.can_issue === 1,
      country_code: cc ?? '',
      country: cc ? normalizeCountryName(lic.country_name) : lic.country_name,
      subsidiary_name: lic.subsidiary_name ?? '',
    };
  });

  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows.slice(i, i + 50);
    const { error } = await sb.from('issuer_licenses').insert(chunk);
    if (error) {
      stats.errors.push(`Licenses chunk ${Math.floor(i / 50)}: ${error.message}`);
    }
  }
}

// ── CLI entry point ──

async function main(): Promise<void> {
  const dotenv = await import('dotenv');
  dotenv.config({ path: '.env.local' });

  const stats = await parseStrideTracker();

  if (stats.errors.length > 0) {
    console.error('\nErrors:');
    stats.errors.forEach((e) => console.error(`  - ${e}`));
  }
  if (stats.warnings.length > 0) {
    console.warn(`\n${stats.warnings.length} warnings (use DEBUG=1 for details)`);
    if (process.env.DEBUG) {
      stats.warnings.forEach((w) => console.warn(`  - ${w}`));
    }
  }

  process.exit(stats.errors.length > 0 ? 1 : 0);
}

// Run directly
main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
