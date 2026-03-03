export interface Entity {
  id: string;
  name: string;
  countryCode: string;
  country: string;
  licenseNumber: string;
  licenseType: string;
  entityTypes: string[];
  activities: string[];
  status: EntityStatus;
  regulator: string;
  website: string;
  description: string;
  registryUrl: string;
  linkedinUrl: string;
}

export type EntityStatus =
  | 'Licensed'
  | 'Provisional'
  | 'Sandbox'
  | 'Registered'
  | 'Pending'
  | 'Unknown';

export interface Jurisdiction {
  code: string;
  name: string;
  regime: RegimeType;
  regulator: string;
  keyLaw: string;
  travelRule: TravelRuleStatus;
  entityCount: number;
  sources: Source[];
  notes: string;
  description: string;
}

export type RegimeType =
  | 'Licensing'
  | 'Registration'
  | 'Sandbox'
  | 'Ban'
  | 'None'
  | 'Unclear';

export type TravelRuleStatus =
  | 'Enforced'
  | 'Legislated'
  | 'In Progress'
  | 'Not Implemented'
  | 'N/A';

export interface Source {
  name: string;
  url: string;
}

export interface JurisdictionFilters {
  search: string;
  regimes: RegimeType[];
  travelRules: TravelRuleStatus[];
}

export interface EntityFilters {
  search: string;
  countries: string[];
  statuses: EntityStatus[];
  regulators: string[];
}

export interface Profile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  businessEmail: string;
  phone: string;
  roleTitle: string;
  createdAt: string;
  updatedAt: string;
}

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

export interface StablecoinJurisdiction {
  code: string;
  status: StablecoinJurisdictionStatus;
  notes: string;
}

export interface Stablecoin {
  id: string;
  name: string;
  ticker: string;
  type: StablecoinType;
  pegCurrency: string;
  issuer: string;
  issuerCountry: string;
  launchDate: string;
  marketCapBn: number;
  chains: string[];
  reserveType: string;
  auditStatus: string;
  regulatoryStatus: string;
  website: string;
  notes: string;
  majorJurisdictions: StablecoinJurisdiction[];
}

/* ── CBDC types ── */

export type CbdcStatus =
  | 'Launched'
  | 'Pilot'
  | 'Development'
  | 'Research'
  | 'Cancelled'
  | 'Inactive';

export interface Cbdc {
  id: string;
  countryCode: string;
  country: string;
  name: string;
  currency: string;
  status: CbdcStatus;
  phase: string;
  centralBank: string;
  launchDate: string | null;
  technology: string;
  retailOrWholesale: string;
  crossBorder: boolean;
  crossBorderProjects: string[];
  programmable: boolean;
  privacyModel: string;
  interestBearing: boolean;
  offlineCapable: boolean;
  notes: string;
  sources: Source[];
}

export type SortDirection = 'asc' | 'desc' | null;

export interface SortConfig {
  field: string;
  direction: SortDirection;
}
