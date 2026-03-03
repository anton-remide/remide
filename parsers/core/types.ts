/**
 * Core types for the VASP Registry Parser system.
 */

/** Raw entity parsed from a registry source */
export interface ParsedEntity {
  name: string;
  licenseNumber: string;
  countryCode: string;
  country: string;
  licenseType?: string;
  entityTypes?: string[];
  activities?: string[];
  status?: string;
  regulator?: string;
  website?: string;
  /** Source URL where this entity was found */
  sourceUrl: string;
}

/** Result of a single parser run */
export interface ParseResult {
  registryId: string;
  countryCode: string;
  entities: ParsedEntity[];
  /** Total entities found in this run */
  totalFound: number;
  /** Duration of the parse in milliseconds */
  durationMs: number;
  /** Any warnings encountered */
  warnings: string[];
  /** Any errors (non-fatal) */
  errors: string[];
  /** Timestamp of the run */
  timestamp: string;
}

/** Parser configuration per registry */
export interface ParserConfig {
  /** Unique registry identifier, e.g. "za-fsca" */
  id: string;
  /** Human-readable name, e.g. "South Africa FSCA" */
  name: string;
  /** ISO country code */
  countryCode: string;
  /** Country name */
  country: string;
  /** Regulator name */
  regulator: string;
  /** Base URL of the registry */
  url: string;
  /** Type of source: html, api, pdf, csv */
  sourceType: 'html' | 'api' | 'pdf' | 'csv';
  /** Minimum delay between requests in ms */
  rateLimit: number;
  /** Whether proxy is needed */
  needsProxy: boolean;
  /** Whether browser (Playwright) is needed */
  needsBrowser: boolean;
  /** Cron schedule override (default: weekly) */
  schedule?: string;
}

/** Interface every registry parser must implement */
export interface RegistryParser {
  config: ParserConfig;
  parse(): Promise<ParseResult>;
}

/** Verification result */
export interface VerifyResult {
  registryId: string;
  valid: boolean;
  schemaErrors: string[];
  duplicates: number;
  deltaPercent: number;
  previousCount: number;
  currentCount: number;
  anomaly: boolean;
  timestamp: string;
}

/** Supabase entity row (matches existing schema + new fields) */
export interface EntityRow {
  id?: number;
  name: string;
  country_code: string;
  country: string;
  license_number: string;
  license_type: string | null;
  entity_types: string[];
  activities: string[];
  status: string | null;
  regulator: string | null;
  website: string | null;
  source_url: string | null;
  parsed_at: string | null;
  parser_id: string | null;
  raw_data: Record<string, unknown> | null;
}

/** Scrape run log entry */
export interface ScrapeRun {
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
  timestamp: string;
}

/** Logger levels */
export type LogLevel = 'info' | 'warn' | 'error' | 'debug';
