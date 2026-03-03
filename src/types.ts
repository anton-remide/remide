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

export type SortDirection = 'asc' | 'desc' | null;

export interface SortConfig {
  field: string;
  direction: SortDirection;
}
