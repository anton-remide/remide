/**
 * Shared domain types — the intersection vocabulary used by
 * workers, parsers, and background scripts.
 *
 * Frontend keeps its full src/types.ts (with React-specific types).
 * Parsers keep parsers/core/types.ts (parser-specific types).
 * This file contains only types that multiple systems need.
 *
 * DO NOT import this in src/ — frontend has its own type definitions.
 */

/* ── Entity status (matches Supabase enum + Notion select) ── */

export type EntityStatus =
  | 'Licensed'
  | 'Provisional'
  | 'Sandbox'
  | 'Registered'
  | 'Pending'
  | 'Unknown';

/** Valid statuses in the database */
export const VALID_ENTITY_STATUSES: readonly EntityStatus[] = [
  'Licensed',
  'Registered',
  'Provisional',
  'Sandbox',
  'Unknown',
] as const;

/* ── Regime types ── */

export type RegimeType =
  | 'Licensing'
  | 'Registration'
  | 'Sandbox'
  | 'Ban'
  | 'None'
  | 'Unclear';

/* ── Travel Rule ── */

export type TravelRuleStatus =
  | 'Enforced'
  | 'Legislated'
  | 'In Progress'
  | 'Not Implemented'
  | 'N/A';

/* ── Stablecoin types ── */

export type StablecoinType = 'Fiat-Backed' | 'Crypto-Backed' | 'Synthetic' | 'Hybrid';

export type StablecoinJurisdictionStatus =
  | 'Compliant'
  | 'Allowed'
  | 'Restricted'
  | 'Non-Compliant'
  | 'Pending'
  | 'Discontinued'
  | 'Unclear';

/* ── CBDC types ── */

export type CbdcStatus =
  | 'Launched'
  | 'Pilot'
  | 'Development'
  | 'Research'
  | 'Cancelled'
  | 'Inactive';

/* ── Logger ── */

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

/* ── Common DB row shapes (for workers reading/writing Supabase) ── */

export interface EntityRow {
  id: string;
  name: string;
  country_code: string;
  country: string;
  license_number: string;
  license_type: string | null;
  entity_types: string[];
  activities: string[];
  status: EntityStatus | string;
  regulator: string | null;
  website: string | null;
  description?: string | null;
  registry_url?: string | null;
  linkedin_url?: string | null;
  source_url?: string | null;
  parsed_at?: string | null;
  parser_id?: string | null;
}

export interface JurisdictionRow {
  code: string;
  name: string;
  regime: RegimeType | string;
  regulator: string;
  key_law: string;
  travel_rule: TravelRuleStatus | string;
  entity_count: number;
  sources: Array<{ name: string; url: string }>;
  notes: string;
  description?: string | null;
}

/* ── Scrape run (for logging) ── */

export interface ScrapeRunRow {
  registry_id: string;
  status: 'success' | 'partial' | 'error';
  entities_found: number;
  entities_new: number;
  entities_updated: number;
  entities_removed: number;
  duration_ms: number;
  error_message: string | null;
  warnings: string[];
  delta_percent: number;
  created_at: string;
}
