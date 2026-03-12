import { supabase } from '../lib/supabase';
import type {
  Entity, Jurisdiction, Stablecoin, Cbdc, StablecoinJurisdiction,
  StablecoinIssuer, StablecoinLaw, StablecoinEvent,
  IssuerSubsidiary, IssuerLicense, StablecoinBlockchain,
} from '../types';
import { EU_MEMBER_CODES } from './regionCodes';

// ── In-memory cache ── Avoids refetching on page navigation ──

const CACHE_TTL = 5 * 60_000; // 5 minutes
const cache = new Map<string, { data: unknown; ts: number }>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry || Date.now() - entry.ts > CACHE_TTL) return null;
  return entry.data as T;
}

function setCache(key: string, data: unknown): void {
  cache.set(key, { data, ts: Date.now() });
}

export function clearEntityCache(): void {
  cache.delete('entities');
}

// ── Inline name cleanup fallback (last resort when canonical_name is NULL) ──
function cleanNameFallback(raw: string): string {
  let s = raw;
  // Strip fancy quotes: „ " « » " " ' '
  s = s.replace(/^[„""«»'']+|[„""«»'']+$/g, '');
  // Strip regular quotes
  s = s.replace(/^["']+|["']+$/g, '');
  // Collapse multiple spaces
  s = s.replace(/\s{2,}/g, ' ');
  return s.trim();
}

// ── Snake_case DB row → camelCase TypeScript ──

interface JurisdictionRow {
  code: string;
  name: string;
  regime: string;
  regulator: string;
  key_law: string;
  travel_rule: string;
  entity_count: number;
  sources: { name: string; url: string }[] | string;
  notes: string;
  description: string;
  /* Stride stablecoin columns */
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
}

interface EntityRawData {
  enrichment_description?: string;
  enrichment_linkedin_url?: string;
  enrichment_twitter_url?: string;
  [key: string]: unknown;
}

interface EntityRow {
  id: string;
  name: string;
  canonical_name: string | null;
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
  raw_data: EntityRawData | null;
  sector: string | null;
  crypto_related: boolean | null;
  quality_score: number | null;
  quality_tier: string | null;
  dns_status: string | null;
  crypto_status: string | null;
  is_garbage: boolean | null;
}

function mapJurisdiction(row: JurisdictionRow): Jurisdiction {
  return {
    code: row.code,
    name: row.name,
    regime: row.regime as Jurisdiction['regime'],
    regulator: row.regulator,
    keyLaw: row.key_law,
    travelRule: row.travel_rule as Jurisdiction['travelRule'],
    entityCount: row.entity_count,
    sources: typeof row.sources === 'string' ? JSON.parse(row.sources) : row.sources,
    notes: row.notes,
    description: row.description ?? '',
    /* Stride stablecoin regulatory data */
    stablecoinStage: row.stablecoin_stage ?? null,
    isStablecoinSpecific: row.is_stablecoin_specific ?? null,
    yieldAllowed: row.yield_allowed ?? null,
    fiatBacked: row.fiat_backed ?? null,
    fiatAlert: row.fiat_alert ?? '',
    cryptoBacked: row.crypto_backed ?? null,
    cryptoAlert: row.crypto_alert ?? '',
    commodityBacked: row.commodity_backed ?? null,
    commodityAlert: row.commodity_alert ?? '',
    algorithmBacked: row.algorithm_backed ?? null,
    algorithmAlert: row.algorithm_alert ?? '',
    stablecoinDescription: row.stablecoin_description ?? '',
    regulatorDescription: row.regulator_description ?? '',
    currency: row.currency ?? '',
  };
}

/** Map a DB row → Entity. Handles both full rows (select('*')) and partial rows (LIST_COLS). */
function mapEntity(row: Partial<EntityRow> & Pick<EntityRow, 'id' | 'name' | 'country_code' | 'country'>): Entity {
  // Enrichment data: prefer dedicated columns, fallback to raw_data JSONB
  const rd = row.raw_data;
  const description = row.description || rd?.enrichment_description || '';
  const linkedinUrl = row.linkedin_url || rd?.enrichment_linkedin_url || '';
  const twitterUrl = rd?.enrichment_twitter_url || '';
  const registryUrl = row.registry_url || '';

  return {
    id: row.id,
    // Prefer canonical_name (cleaned by Quality Worker); fallback cleans raw name
    name: row.canonical_name || cleanNameFallback(row.name),
    countryCode: row.country_code,
    country: row.country,
    licenseNumber: row.license_number ?? '',
    licenseType: row.license_type ?? '',
    entityTypes: row.entity_types ?? [],
    activities: row.activities ?? [],
    status: (row.status as Entity['status']) ?? 'Unknown',
    regulator: row.regulator ?? '',
    website: row.website ?? '',
    description,
    registryUrl,
    linkedinUrl,
    twitterUrl,
    sector: (row.sector as Entity['sector']) ?? 'Crypto',
    cryptoRelated: row.crypto_related ?? true,
    /* Quality pipeline */
    qualityScore: row.quality_score ?? null,
    qualityTier: (row.quality_tier as Entity['qualityTier']) ?? null,
    dnsStatus: (row.dns_status as Entity['dnsStatus']) ?? 'unknown',
    cryptoStatus: (row.crypto_status as Entity['cryptoStatus']) ?? 'unknown',
    isGarbage: row.is_garbage ?? false,
  };
}

// ── Public API (all async) ──

export async function getJurisdictions(): Promise<Jurisdiction[]> {
  const cached = getCached<Jurisdiction[]>('jurisdictions');
  if (cached) return cached;

  const { data, error } = await supabase
    .from('jurisdictions')
    .select('*')
    .order('entity_count', { ascending: false });

  if (error) throw new Error(`Failed to load jurisdictions: ${error.message}`);
  const result = (data as JurisdictionRow[]).map(mapJurisdiction);
  setCache('jurisdictions', result);
  return result;
}

export async function getJurisdictionByCode(code: string): Promise<Jurisdiction | null> {
  const { data, error } = await supabase
    .from('jurisdictions')
    .select('*')
    .eq('code', code.toUpperCase())
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // not found
    throw new Error(`Failed to load jurisdiction: ${error.message}`);
  }
  return mapJurisdiction(data as JurisdictionRow);
}

// Columns needed for list/table views (EntitiesPage, JurisdictionDetailPage).
// Excludes heavy columns: raw_data, description, activities, entity_types, website, registry_url, linkedin_url, license_number
const LIST_COLS = [
  'id', 'name', 'canonical_name', 'country_code', 'country',
  'sector', 'status', 'regulator', 'license_type',
  'dns_status', 'is_garbage',
].join(',');

/** Partial row type for LIST_COLS-based queries (no raw_data, description, etc.) */
type EntityListRow = Pick<EntityRow, 'id' | 'name' | 'canonical_name' | 'country_code' | 'country'
  | 'sector' | 'status' | 'regulator' | 'license_type' | 'dns_status' | 'is_garbage'>;

/** Fast count for landing page — no data transfer, just COUNT */
export async function getEntityCount(): Promise<number> {
  const { count, error } = await supabase
    .from('entities')
    .select('id', { count: 'exact', head: true })
    .neq('is_garbage', true)
    .neq('is_hidden', true)
    .not('canonical_name', 'is', null);
  if (error) throw new Error(`Failed to count entities: ${error.message}`);
  return count ?? 0;
}

/** Sector-level stats for EntitiesPage header — instant COUNT queries */
export interface EntityStats {
  total: number;
  crypto: number;
  payments: number;
  banking: number;
}

export async function getEntityStats(): Promise<EntityStats> {
  const cached = getCached<EntityStats>('entityStats');
  if (cached) return cached;

  const base = supabase.from('entities').select('id', { count: 'exact', head: true }).neq('is_garbage', true).neq('is_hidden', true).not('canonical_name', 'is', null);

  const [totalRes, cryptoRes, paymentsRes, bankingRes] = await Promise.all([
    base,
    supabase.from('entities').select('id', { count: 'exact', head: true }).neq('is_garbage', true).neq('is_hidden', true).not('canonical_name', 'is', null).eq('sector', 'Crypto'),
    supabase.from('entities').select('id', { count: 'exact', head: true }).neq('is_garbage', true).neq('is_hidden', true).not('canonical_name', 'is', null).eq('sector', 'Payments'),
    supabase.from('entities').select('id', { count: 'exact', head: true }).neq('is_garbage', true).neq('is_hidden', true).not('canonical_name', 'is', null).eq('sector', 'Banking'),
  ]);

  if (totalRes.error) throw new Error(`Failed to count entities: ${totalRes.error.message}`);

  const result = {
    total: totalRes.count ?? 0,
    crypto: cryptoRes.count ?? 0,
    payments: paymentsRes.count ?? 0,
    banking: bankingRes.count ?? 0,
  };
  setCache('entityStats', result);
  return result;
}

export async function getEntities(): Promise<Entity[]> {
  const cached = getCached<Entity[]>('entities');
  if (cached) return cached;

  // Use minimal columns for list view — ~80% less data than select('*')
  const all: EntityListRow[] = [];
  const PAGE = 1000;
  let from = 0;
  let done = false;
  while (!done) {
    const { data, error } = await supabase
      .from('entities')
      .select(LIST_COLS)
      .not('canonical_name', 'is', null)
      .neq('is_garbage', true)
      .neq('is_hidden', true)
      .order('canonical_name', { nullsFirst: false })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Failed to load entities: ${error.message}`);
    const rows = data as unknown as EntityListRow[];
    all.push(...rows);
    if (rows.length < PAGE) done = true;
    else from += PAGE;
  }
  const result = all.map(mapEntity);
  setCache('entities', result);
  return result;
}

/** Progressive entity loading — delivers first page instantly, then fills in the rest.
 *  `onProgress` is called after each page with the cumulative entity list + progress info.
 *  Returns the full array when complete. */
export type EntityProgressCallback = (entities: Entity[], loaded: number, total: number) => void;

export async function getEntitiesProgressive(
  onProgress: EntityProgressCallback,
  signal?: { cancelled: boolean },
): Promise<Entity[]> {
  // Cache hit = instant render
  const cached = getCached<Entity[]>('entities');
  if (cached) {
    onProgress(cached, cached.length, cached.length);
    return cached;
  }

  const all: EntityListRow[] = [];
  const PAGE = 1000;

  // First page: request exact count so we know total
  const { data: firstData, error: firstErr, count } = await supabase
    .from('entities')
    .select(LIST_COLS, { count: 'exact' })
    .not('canonical_name', 'is', null)
    .neq('is_garbage', true)
    .neq('is_hidden', true)
    .order('canonical_name', { nullsFirst: false })
    .range(0, PAGE - 1);

  if (firstErr) throw new Error(`Failed to load entities: ${firstErr.message}`);
  if (signal?.cancelled) return [];

  const totalCount = count ?? 0;
  const firstRows = firstData as unknown as EntityListRow[];
  all.push(...firstRows);
  onProgress(all.map(mapEntity), all.length, totalCount);

  // Remaining pages
  let from = PAGE;
  while (firstRows.length === PAGE) {
    if (signal?.cancelled) return [];

    const { data, error } = await supabase
      .from('entities')
      .select(LIST_COLS)
      .not('canonical_name', 'is', null)
      .neq('is_garbage', true)
      .neq('is_hidden', true)
      .order('canonical_name', { nullsFirst: false })
      .range(from, from + PAGE - 1);

    if (error) throw new Error(`Failed to load entities: ${error.message}`);
    if (signal?.cancelled) return [];

    const rows = data as unknown as EntityListRow[];
    all.push(...rows);
    onProgress(all.map(mapEntity), all.length, totalCount);

    if (rows.length < PAGE) break;
    from += PAGE;
  }

  const result = all.map(mapEntity);
  setCache('entities', result);
  return result;
}

export async function getEntityById(id: string): Promise<Entity | null> {
  const { data, error } = await supabase
    .from('entities')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // not found
    throw new Error(`Failed to load entity: ${error.message}`);
  }
  return mapEntity(data as EntityRow);
}

// ── Global Search (header dropdown) ──

export interface SearchResult {
  jurisdictions: { code: string; name: string; regulator: string }[];
  entities: { id: string; name: string; country: string; countryCode: string; regulator: string }[];
}

export async function searchGlobal(query: string): Promise<SearchResult> {
  const q = `%${query}%`;
  const [jRes, eRes] = await Promise.all([
    supabase
      .from('jurisdictions')
      .select('code, name, regulator')
      .or(`name.ilike.${q},regulator.ilike.${q}`)
      .order('entity_count', { ascending: false })
      .limit(5),
    supabase
      .from('entities')
      .select('id, name, canonical_name, country, country_code, regulator')
      .not('canonical_name', 'is', null)
      .neq('is_garbage', true)
      .neq('is_hidden', true)
      .or(`name.ilike.${q},canonical_name.ilike.${q},country.ilike.${q},regulator.ilike.${q}`)
      .order('name')
      .limit(5),
  ]);

  return {
    jurisdictions: (jRes.data ?? []).map((r: Record<string, string>) => ({
      code: r.code,
      name: r.name,
      regulator: r.regulator,
    })),
    entities: (eRes.data ?? []).map((r: Record<string, string>) => ({
      id: r.id,
      name: r.canonical_name || r.name,
      country: r.country,
      countryCode: r.country_code,
      regulator: r.regulator,
    })),
  };
}

export async function getEntitiesByCountry(code: string): Promise<Entity[]> {
  const all: EntityListRow[] = [];
  const PAGE = 1000;
  let from = 0;
  let done = false;
  while (!done) {
    const { data, error } = await supabase
      .from('entities')
      .select(LIST_COLS)
      .eq('country_code', code.toUpperCase())
      .not('canonical_name', 'is', null)
      .neq('is_garbage', true)
      .neq('is_hidden', true)
      .order('name')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Failed to load entities: ${error.message}`);
    const rows = data as unknown as EntityListRow[];
    all.push(...rows);
    if (rows.length < PAGE) done = true;
    else from += PAGE;
  }
  return all.map(mapEntity);
}

/**
 * Fetch entities for a regional code (e.g. 'EU' → all 27 member states).
 * For non-regional codes, falls back to single-country query.
 */
export async function getEntitiesByRegion(code: string): Promise<Entity[]> {
  const upper = code.toUpperCase();
  const isEU = upper === 'EU';
  const countryCodes = isEU ? [...EU_MEMBER_CODES] : [upper];

  const all: EntityListRow[] = [];
  const PAGE = 1000;
  let from = 0;
  let done = false;
  while (!done) {
    const { data, error } = await supabase
      .from('entities')
      .select(LIST_COLS)
      .in('country_code', countryCodes)
      .not('canonical_name', 'is', null)
      .neq('is_garbage', true)
      .neq('is_hidden', true)
      .order('name')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Failed to load entities: ${error.message}`);
    const rows = data as unknown as EntityListRow[];
    all.push(...rows);
    if (rows.length < PAGE) done = true;
    else from += PAGE;
  }
  return all.map(mapEntity);
}

/** Fetch all member state jurisdictions for a regional code (e.g. EU → 27 jurisdictions) */
export async function getJurisdictionsByRegion(code: string): Promise<Jurisdiction[]> {
  const upper = code.toUpperCase();
  if (upper !== 'EU') return [];

  const { data, error } = await supabase
    .from('jurisdictions')
    .select('*')
    .in('code', [...EU_MEMBER_CODES])
    .order('entity_count', { ascending: false });

  if (error) throw new Error(`Failed to load EU jurisdictions: ${error.message}`);
  return (data as JurisdictionRow[]).map(mapJurisdiction);
}

// ── Stablecoins & CBDCs (Supabase) ──

interface StablecoinRow {
  id: string;
  name: string;
  ticker: string;
  type: string;
  peg_currency: string;
  issuer: string;
  issuer_country: string;
  launch_date: string;
  market_cap_bn: number;
  chains: string[];
  reserve_type: string;
  audit_status: string;
  regulatory_status: string;
  website: string;
  notes: string;
  /* Stride enrichment */
  whitepaper_url: string | null;
  coinmarketcap_id: number | null;
  collateral_method: string | null;
  issuer_id: number | null;
}

interface StablecoinJurisdictionRow {
  stablecoin_id: string;
  country_code: string;
  status: string;
  notes: string;
}

interface CbdcRow {
  id: string;
  country_code: string;
  country: string;
  name: string;
  currency: string;
  status: string;
  phase: string;
  central_bank: string;
  launch_date: string | null;
  technology: string;
  retail_or_wholesale: string;
  cross_border: boolean;
  cross_border_projects: string[];
  programmable: boolean;
  privacy_model: string;
  interest_bearing: boolean;
  offline_capable: boolean;
  notes: string;
  sources: { name: string; url: string }[] | string;
}

function mapStablecoin(row: StablecoinRow, jurisdictions: StablecoinJurisdiction[]): Stablecoin {
  return {
    id: row.id,
    name: row.name,
    ticker: row.ticker,
    type: row.type as Stablecoin['type'],
    pegCurrency: row.peg_currency,
    issuer: row.issuer,
    issuerCountry: row.issuer_country,
    launchDate: row.launch_date,
    marketCapBn: Number(row.market_cap_bn),
    chains: row.chains ?? [],
    reserveType: row.reserve_type ?? '',
    auditStatus: row.audit_status ?? '',
    regulatoryStatus: row.regulatory_status ?? '',
    website: row.website ?? '',
    notes: row.notes ?? '',
    majorJurisdictions: jurisdictions,
    /* Stride enrichment */
    whitepaperUrl: row.whitepaper_url ?? '',
    coinmarketcapId: row.coinmarketcap_id ?? null,
    collateralMethod: row.collateral_method ?? '',
    issuerId: row.issuer_id ?? null,
  };
}

function mapCbdc(row: CbdcRow): Cbdc {
  return {
    id: row.id,
    countryCode: row.country_code,
    country: row.country,
    name: row.name,
    currency: row.currency,
    status: row.status as Cbdc['status'],
    phase: row.phase ?? '',
    centralBank: row.central_bank,
    launchDate: row.launch_date,
    technology: row.technology ?? '',
    retailOrWholesale: row.retail_or_wholesale ?? '',
    crossBorder: row.cross_border ?? false,
    crossBorderProjects: row.cross_border_projects ?? [],
    programmable: row.programmable ?? false,
    privacyModel: row.privacy_model ?? '',
    interestBearing: row.interest_bearing ?? false,
    offlineCapable: row.offline_capable ?? false,
    notes: row.notes ?? '',
    sources: typeof row.sources === 'string' ? JSON.parse(row.sources) : (row.sources ?? []),
  };
}

export async function getStablecoins(): Promise<Stablecoin[]> {
  // Fetch stablecoins + all jurisdictions in parallel
  const [scRes, sjRes] = await Promise.all([
    supabase.from('stablecoins').select('*').order('market_cap_bn', { ascending: false }),
    supabase.from('stablecoin_jurisdictions').select('*'),
  ]);

  if (scRes.error) throw new Error(`Failed to load stablecoins: ${scRes.error.message}`);
  if (sjRes.error) throw new Error(`Failed to load stablecoin jurisdictions: ${sjRes.error.message}`);

  // Group jurisdictions by stablecoin_id
  const jMap = new Map<string, StablecoinJurisdiction[]>();
  for (const j of sjRes.data as StablecoinJurisdictionRow[]) {
    const arr = jMap.get(j.stablecoin_id) ?? [];
    arr.push({ code: j.country_code, status: j.status as StablecoinJurisdiction['status'], notes: j.notes ?? '' });
    jMap.set(j.stablecoin_id, arr);
  }

  return (scRes.data as StablecoinRow[]).map((row) =>
    mapStablecoin(row, jMap.get(row.id) ?? []),
  );
}

export async function getStablecoinById(id: string): Promise<Stablecoin | null> {
  const [scRes, sjRes] = await Promise.all([
    supabase.from('stablecoins').select('*').eq('id', id).single(),
    supabase.from('stablecoin_jurisdictions').select('*').eq('stablecoin_id', id),
  ]);

  if (scRes.error) {
    if (scRes.error.code === 'PGRST116') return null;
    throw new Error(`Failed to load stablecoin: ${scRes.error.message}`);
  }
  if (sjRes.error) throw new Error(`Failed to load stablecoin jurisdictions: ${sjRes.error.message}`);

  const jurisdictions: StablecoinJurisdiction[] = (sjRes.data as StablecoinJurisdictionRow[]).map((j) => ({
    code: j.country_code,
    status: j.status as StablecoinJurisdiction['status'],
    notes: j.notes ?? '',
  }));

  return mapStablecoin(scRes.data as StablecoinRow, jurisdictions);
}

export async function getCbdcs(): Promise<Cbdc[]> {
  const { data, error } = await supabase
    .from('cbdcs')
    .select('*');

  if (error) throw new Error(`Failed to load CBDCs: ${error.message}`);

  const cbdcs = (data as CbdcRow[]).map(mapCbdc);

  // Sort by status priority
  const order: Record<string, number> = { Launched: 0, Pilot: 1, Development: 2, Research: 3, Cancelled: 4, Inactive: 5 };
  return cbdcs.sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));
}

export async function getCbdcById(id: string): Promise<Cbdc | null> {
  const { data, error } = await supabase
    .from('cbdcs')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to load CBDC: ${error.message}`);
  }
  return mapCbdc(data as CbdcRow);
}

// ── Per-country aggregation helpers (async Supabase) ──

/** Stablecoins that list this country code in majorJurisdictions */
export async function getStablecoinsByCountry(code: string): Promise<Stablecoin[]> {
  const upper = code.toUpperCase();

  // Find stablecoin IDs for this country from the junction table
  const { data: jRows, error: jErr } = await supabase
    .from('stablecoin_jurisdictions')
    .select('stablecoin_id')
    .eq('country_code', upper);

  if (jErr) throw new Error(`Failed to load stablecoin jurisdictions: ${jErr.message}`);
  if (!jRows || jRows.length === 0) return [];

  const ids = [...new Set((jRows as { stablecoin_id: string }[]).map((r) => r.stablecoin_id))];

  // Fetch the stablecoins + all their jurisdictions
  const [scRes, sjRes] = await Promise.all([
    supabase.from('stablecoins').select('*').in('id', ids),
    supabase.from('stablecoin_jurisdictions').select('*').in('stablecoin_id', ids),
  ]);

  if (scRes.error) throw new Error(`Failed to load stablecoins: ${scRes.error.message}`);
  if (sjRes.error) throw new Error(`Failed to load jurisdictions: ${sjRes.error.message}`);

  const jMap = new Map<string, StablecoinJurisdiction[]>();
  for (const j of sjRes.data as StablecoinJurisdictionRow[]) {
    const arr = jMap.get(j.stablecoin_id) ?? [];
    arr.push({ code: j.country_code, status: j.status as StablecoinJurisdiction['status'], notes: j.notes ?? '' });
    jMap.set(j.stablecoin_id, arr);
  }

  return (scRes.data as StablecoinRow[]).map((row) =>
    mapStablecoin(row, jMap.get(row.id) ?? []),
  );
}

/** CBDCs issued by this country */
export async function getCbdcsByCountry(code: string): Promise<Cbdc[]> {
  const { data, error } = await supabase
    .from('cbdcs')
    .select('*')
    .eq('country_code', code.toUpperCase());

  if (error) throw new Error(`Failed to load CBDCs: ${error.message}`);
  return (data as CbdcRow[]).map(mapCbdc);
}

// ── Stride: Stablecoin Issuers ──

interface StablecoinIssuerRow {
  id: number;
  stride_id: number;
  slug: string | null;
  name: string;
  official_name: string;
  former_names: string;
  lei: string;
  cik: string;
  auditor: string;
  description: string;
  assurance_frequency: string;
  redemption_policy: string;
  website: string;
  country_code: string;
  country: string;
  is_verified: boolean;
}

function mapIssuer(row: StablecoinIssuerRow): StablecoinIssuer {
  return {
    id: row.id,
    strideId: row.stride_id,
    slug: row.slug ?? '',
    name: row.name,
    officialName: row.official_name ?? '',
    formerNames: row.former_names ?? '',
    lei: row.lei ?? '',
    cik: row.cik ?? '',
    auditor: row.auditor ?? '',
    description: row.description ?? '',
    assuranceFrequency: row.assurance_frequency ?? '',
    redemptionPolicy: row.redemption_policy ?? '',
    website: row.website ?? '',
    countryCode: row.country_code ?? '',
    country: row.country ?? '',
    isVerified: row.is_verified ?? false,
  };
}

export async function getStablecoinIssuers(): Promise<StablecoinIssuer[]> {
  const { data, error } = await supabase
    .from('stablecoin_issuers')
    .select('*')
    .order('name');

  if (error) throw new Error(`Failed to load stablecoin issuers: ${error.message}`);
  return (data as StablecoinIssuerRow[]).map(mapIssuer);
}

export async function getIssuerBySlug(slug: string): Promise<StablecoinIssuer | null> {
  const { data, error } = await supabase
    .from('stablecoin_issuers')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to load issuer: ${error.message}`);
  }
  return mapIssuer(data as StablecoinIssuerRow);
}

export async function getStablecoinsByIssuer(issuerId: number): Promise<Stablecoin[]> {
  const { data: scData, error: scErr } = await supabase
    .from('stablecoins')
    .select('*')
    .eq('issuer_id', issuerId)
    .order('market_cap_bn', { ascending: false });

  if (scErr) throw new Error(`Failed to load stablecoins: ${scErr.message}`);
  if (!scData || scData.length === 0) return [];

  const ids = (scData as StablecoinRow[]).map((r) => r.id);
  const { data: sjData, error: sjErr } = await supabase
    .from('stablecoin_jurisdictions')
    .select('*')
    .in('stablecoin_id', ids);

  if (sjErr) throw new Error(`Failed to load jurisdictions: ${sjErr.message}`);

  const jMap = new Map<string, StablecoinJurisdiction[]>();
  for (const j of (sjData as StablecoinJurisdictionRow[]) ?? []) {
    const arr = jMap.get(j.stablecoin_id) ?? [];
    arr.push({ code: j.country_code, status: j.status as StablecoinJurisdiction['status'], notes: j.notes ?? '' });
    jMap.set(j.stablecoin_id, arr);
  }

  return (scData as StablecoinRow[]).map((row) =>
    mapStablecoin(row, jMap.get(row.id) ?? []),
  );
}

export async function getStablecoinIssuerByStrideId(strideId: number): Promise<StablecoinIssuer | null> {
  const { data, error } = await supabase
    .from('stablecoin_issuers')
    .select('*')
    .eq('stride_id', strideId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to load issuer: ${error.message}`);
  }
  return mapIssuer(data as StablecoinIssuerRow);
}

// ── Stride: Stablecoin Laws ──

interface StablecoinLawRow {
  id: number;
  stride_id: number;
  country_code: string;
  title: string;
  enacted_date: string | null;
  description: string;
  citation_url: string;
}

function mapLaw(row: StablecoinLawRow): StablecoinLaw {
  return {
    id: row.id,
    strideId: row.stride_id,
    countryCode: row.country_code,
    title: row.title,
    enactedDate: row.enacted_date,
    description: row.description ?? '',
    citationUrl: row.citation_url ?? '',
  };
}

export async function getStablecoinLawsByCountry(code: string): Promise<StablecoinLaw[]> {
  const { data, error } = await supabase
    .from('stablecoin_laws')
    .select('*')
    .eq('country_code', code.toUpperCase())
    .order('enacted_date', { ascending: false });

  if (error) throw new Error(`Failed to load stablecoin laws: ${error.message}`);
  return (data as StablecoinLawRow[]).map(mapLaw);
}

// ── Stride: Regulatory Events ──

interface StablecoinEventRow {
  id: number;
  stride_id: number;
  country_code: string;
  event_date: string | null;
  event_type: number | null;
  title: string;
  details: string;
  citation_url: string;
}

function mapEvent(row: StablecoinEventRow): StablecoinEvent {
  return {
    id: row.id,
    strideId: row.stride_id,
    countryCode: row.country_code,
    eventDate: row.event_date,
    eventType: row.event_type,
    title: row.title,
    details: row.details ?? '',
    citationUrl: row.citation_url ?? '',
  };
}

export async function getStablecoinEventsByCountry(code: string): Promise<StablecoinEvent[]> {
  const { data, error } = await supabase
    .from('stablecoin_events')
    .select('*')
    .eq('country_code', code.toUpperCase())
    .order('event_date', { ascending: false });

  if (error) throw new Error(`Failed to load stablecoin events: ${error.message}`);
  return (data as StablecoinEventRow[]).map(mapEvent);
}

// ── Stride: Issuer Subsidiaries ──

interface IssuerSubsidiaryRow {
  id: number;
  stride_id: number;
  issuer_stride_id: number;
  name: string;
  lei: string;
  country_code: string;
  country: string;
  can_issue: boolean;
  incorporation_date: string | null;
  description: string;
}

function mapSubsidiary(row: IssuerSubsidiaryRow): IssuerSubsidiary {
  return {
    id: row.id,
    strideId: row.stride_id,
    issuerStrideId: row.issuer_stride_id,
    name: row.name,
    lei: row.lei ?? '',
    countryCode: row.country_code ?? '',
    country: row.country ?? '',
    canIssue: row.can_issue ?? false,
    incorporationDate: row.incorporation_date,
    description: row.description ?? '',
  };
}

export async function getSubsidiariesByIssuer(issuerStrideId: number): Promise<IssuerSubsidiary[]> {
  const { data, error } = await supabase
    .from('issuer_subsidiaries')
    .select('*')
    .eq('issuer_stride_id', issuerStrideId)
    .order('name');

  if (error) throw new Error(`Failed to load subsidiaries: ${error.message}`);
  return (data as IssuerSubsidiaryRow[]).map(mapSubsidiary);
}

// ── Stride: Issuer Licenses ──

interface IssuerLicenseRow {
  id: number;
  stride_id: number;
  issuer_stride_id: number;
  title: string;
  detail: string;
  can_issue: boolean;
  country_code: string;
  country: string;
  subsidiary_name: string;
}

function mapLicense(row: IssuerLicenseRow): IssuerLicense {
  return {
    id: row.id,
    strideId: row.stride_id,
    issuerStrideId: row.issuer_stride_id,
    title: row.title,
    detail: row.detail ?? '',
    canIssue: row.can_issue ?? false,
    countryCode: row.country_code ?? '',
    country: row.country ?? '',
    subsidiaryName: row.subsidiary_name ?? '',
  };
}

export async function getLicensesByIssuer(issuerStrideId: number): Promise<IssuerLicense[]> {
  const { data, error } = await supabase
    .from('issuer_licenses')
    .select('*')
    .eq('issuer_stride_id', issuerStrideId)
    .order('title');

  if (error) throw new Error(`Failed to load licenses: ${error.message}`);
  return (data as IssuerLicenseRow[]).map(mapLicense);
}

// ── Stride: Blockchain Deployments ──

interface StablecoinBlockchainRow {
  id: number;
  stablecoin_ticker: string;
  blockchain_name: string;
  contract_address: string;
  deploy_date: string | null;
  stride_blockchain_id: number | null;
}

function mapBlockchain(row: StablecoinBlockchainRow): StablecoinBlockchain {
  return {
    id: row.id,
    stablecoinTicker: row.stablecoin_ticker,
    blockchainName: row.blockchain_name,
    contractAddress: row.contract_address ?? '',
    deployDate: row.deploy_date,
  };
}

export async function getBlockchainsByStablecoin(ticker: string): Promise<StablecoinBlockchain[]> {
  const { data, error } = await supabase
    .from('stablecoin_blockchains')
    .select('*')
    .eq('stablecoin_ticker', ticker.toUpperCase())
    .order('blockchain_name');

  if (error) throw new Error(`Failed to load blockchain deployments: ${error.message}`);
  return (data as StablecoinBlockchainRow[]).map(mapBlockchain);
}

export async function getLicensesByCountry(code: string): Promise<IssuerLicense[]> {
  const { data, error } = await supabase
    .from('issuer_licenses')
    .select('*')
    .eq('country_code', code.toUpperCase())
    .order('title');

  if (error) throw new Error(`Failed to load licenses: ${error.message}`);
  return (data as IssuerLicenseRow[]).map(mapLicense);
}
