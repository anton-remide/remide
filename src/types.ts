export type EntitySector = 'Crypto' | 'Payments' | 'Banking';

export type DnsStatus = 'alive' | 'dead' | 'no_website' | 'unknown';
export type CryptoStatus = 'confirmed_crypto' | 'crypto_adjacent' | 'traditional' | 'unknown';
export type QualityTier = 'T1' | 'T2' | 'T3' | 'T4';

export interface Entity {
  id: string;
  name: string;
  brandName: string | null;
  countryCode: string;
  country: string;
  licenseNumber: string;
  licenseType: string;
  entityTypes: string[];
  activities: string[];
  status: EntityStatus;
  regulator: string;
  website: string;
  siteLanguages?: string[];
  description: string;
  registryUrl: string;
  linkedinUrl: string;
  twitterUrl: string;
  sector: EntitySector;
  cryptoRelated: boolean;
  /* Quality pipeline fields */
  qualityScore: number | null;
  qualityTier: QualityTier | null;
  dnsStatus: DnsStatus;
  cryptoStatus: CryptoStatus;
  isGarbage: boolean;
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
  /* ── Stride stablecoin regulatory data ── */
  stablecoinStage: number | null;        // 0=No Framework, 1=Developing, 2=In Progress, 3=Live
  isStablecoinSpecific: boolean | null;
  yieldAllowed: boolean | null;
  fiatBacked: number | null;             // 0=Prohibited, 1=Permitted, 2=Unclear
  fiatAlert: string;
  cryptoBacked: number | null;
  cryptoAlert: string;
  commodityBacked: number | null;
  commodityAlert: string;
  algorithmBacked: number | null;
  algorithmAlert: string;
  stablecoinDescription: string;
  regulatorDescription: string;
  currency: string;
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
  /* ── Stride enrichment ── */
  whitepaperUrl: string;
  coinmarketcapId: number | null;
  collateralMethod: string;
  issuerId: number | null;
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

/* ── Stride: Stablecoin Issuers ── */

export interface StablecoinIssuer {
  id: number;
  strideId: number;
  slug: string;
  name: string;
  officialName: string;
  formerNames: string;
  lei: string;
  cik: string;
  auditor: string;
  description: string;
  assuranceFrequency: string;
  redemptionPolicy: string;
  website: string;
  countryCode: string;
  country: string;
  isVerified: boolean;
}

/* ── Stride: Stablecoin Laws ── */

export interface StablecoinLaw {
  id: number;
  strideId: number;
  countryCode: string;
  title: string;
  enactedDate: string | null;
  description: string;
  citationUrl: string;
}

/* ── Stride: Regulatory Events ── */

export interface StablecoinEvent {
  id: number;
  strideId: number;
  countryCode: string;
  eventDate: string | null;
  eventType: number | null; // 2=Legislative, 3=Regulatory/News
  title: string;
  details: string;
  citationUrl: string;
}

/* ── Stride: Issuer Subsidiaries ── */

export interface IssuerSubsidiary {
  id: number;
  strideId: number;
  issuerStrideId: number;
  name: string;
  lei: string;
  countryCode: string;
  country: string;
  canIssue: boolean;
  incorporationDate: string | null;
  description: string;
}

/* ── Stride: Issuer Licenses ── */

export interface IssuerLicense {
  id: number;
  strideId: number;
  issuerStrideId: number;
  title: string;
  detail: string;
  canIssue: boolean;
  countryCode: string;
  country: string;
  subsidiaryName: string;
}

/* ── Stride: Blockchain Deployments ── */

export interface StablecoinBlockchain {
  id: number;
  stablecoinTicker: string;
  blockchainName: string;
  contractAddress: string;
  deployDate: string | null;
}

export type SortDirection = 'asc' | 'desc' | null;

export interface SortConfig {
  field: string;
  direction: SortDirection;
}
