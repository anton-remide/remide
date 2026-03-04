import { supabase } from '../lib/supabase';
import type { Entity, Jurisdiction, Stablecoin, Cbdc, StablecoinJurisdiction } from '../types';

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
}

interface EntityRow {
  id: string;
  name: string;
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
  };
}

function mapEntity(row: EntityRow): Entity {
  return {
    id: row.id,
    name: row.name,
    countryCode: row.country_code,
    country: row.country,
    licenseNumber: row.license_number,
    licenseType: row.license_type,
    entityTypes: row.entity_types ?? [],
    activities: row.activities ?? [],
    status: row.status as Entity['status'],
    regulator: row.regulator,
    website: row.website,
    description: row.description ?? '',
    registryUrl: row.registry_url ?? '',
    linkedinUrl: row.linkedin_url ?? '',
  };
}

// ── Public API (all async) ──

export async function getJurisdictions(): Promise<Jurisdiction[]> {
  const { data, error } = await supabase
    .from('jurisdictions')
    .select('*')
    .order('entity_count', { ascending: false });

  if (error) throw new Error(`Failed to load jurisdictions: ${error.message}`);
  return (data as JurisdictionRow[]).map(mapJurisdiction);
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

export async function getEntities(): Promise<Entity[]> {
  // Supabase default limit is 1000 — paginate to get all rows
  const all: EntityRow[] = [];
  const PAGE = 1000;
  let from = 0;
  let done = false;
  while (!done) {
    const { data, error } = await supabase
      .from('entities')
      .select('*')
      .order('name')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Failed to load entities: ${error.message}`);
    all.push(...(data as EntityRow[]));
    if ((data as EntityRow[]).length < PAGE) done = true;
    else from += PAGE;
  }
  return all.map(mapEntity);
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
      .select('id, name, country, country_code, regulator')
      .or(`name.ilike.${q},country.ilike.${q},regulator.ilike.${q}`)
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
      name: r.name,
      country: r.country,
      countryCode: r.country_code,
      regulator: r.regulator,
    })),
  };
}

export async function getEntitiesByCountry(code: string): Promise<Entity[]> {
  const all: EntityRow[] = [];
  const PAGE = 1000;
  let from = 0;
  let done = false;
  while (!done) {
    const { data, error } = await supabase
      .from('entities')
      .select('*')
      .eq('country_code', code.toUpperCase())
      .order('name')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Failed to load entities: ${error.message}`);
    all.push(...(data as EntityRow[]));
    if ((data as EntityRow[]).length < PAGE) done = true;
    else from += PAGE;
  }
  return all.map(mapEntity);
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
