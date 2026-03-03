import { supabase } from '../lib/supabase';
import type { Entity, Jurisdiction, Stablecoin, Cbdc } from '../types';
import stablecoinsData from './stablecoins.json';
import cbdcsData from './cbdcs.json';

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
  const { data, error } = await supabase
    .from('entities')
    .select('*')
    .order('name');

  if (error) throw new Error(`Failed to load entities: ${error.message}`);
  return (data as EntityRow[]).map(mapEntity);
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
  const { data, error } = await supabase
    .from('entities')
    .select('*')
    .eq('country_code', code.toUpperCase())
    .order('name');

  if (error) throw new Error(`Failed to load entities: ${error.message}`);
  return (data as EntityRow[]).map(mapEntity);
}

// ── Stablecoins & CBDCs (static JSON for now) ──

export async function getStablecoins(): Promise<Stablecoin[]> {
  return (stablecoinsData as unknown as Stablecoin[]).sort(
    (a, b) => b.marketCapBn - a.marketCapBn,
  );
}

export async function getStablecoinById(id: string): Promise<Stablecoin | null> {
  const coin = (stablecoinsData as unknown as Stablecoin[]).find((s) => s.id === id);
  return coin ?? null;
}

export async function getCbdcs(): Promise<Cbdc[]> {
  const order: Record<string, number> = { Launched: 0, Pilot: 1, Development: 2, Research: 3, Cancelled: 4, Inactive: 5 };
  return (cbdcsData as unknown as Cbdc[]).sort(
    (a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9),
  );
}

export async function getCbdcById(id: string): Promise<Cbdc | null> {
  const cbdc = (cbdcsData as unknown as Cbdc[]).find((c) => c.id === id);
  return cbdc ?? null;
}
