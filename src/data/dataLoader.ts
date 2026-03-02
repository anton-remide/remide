import { supabase } from '../lib/supabase';
import type { Entity, Jurisdiction } from '../types';

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

export async function getEntitiesByCountry(code: string): Promise<Entity[]> {
  const { data, error } = await supabase
    .from('entities')
    .select('*')
    .eq('country_code', code.toUpperCase())
    .order('name');

  if (error) throw new Error(`Failed to load entities: ${error.message}`);
  return (data as EntityRow[]).map(mapEntity);
}
