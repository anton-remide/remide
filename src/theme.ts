export const COLORS = {
  black: '#0f172a',
  white: '#FFFFFF',
  bgLight: '#f8fafc',
  textMuted: '#475569',
  border: 'rgba(15, 23, 42, 0.08)',
} as const;

type BadgeColor = { bg: string; text: string };

type SemanticSwatch = {
  badgeBg: string;
  badgeText: string;
  map?: string;
  mapDim?: string;
};

const SEMANTIC_SWATCHES = {
  success: { badgeBg: 'var(--color-success-subtle)', badgeText: 'var(--color-success)', map: '#22c55e', mapDim: '#bbf7d0' },
  info: { badgeBg: 'var(--color-info-subtle)', badgeText: 'var(--color-info)', map: '#6366f1', mapDim: '#c7d2fe' },
  warning: { badgeBg: 'var(--color-warning-subtle)', badgeText: 'var(--color-warning)', map: '#f59e0b', mapDim: '#fde68a' },
  danger: { badgeBg: 'var(--color-danger-subtle)', badgeText: 'var(--color-danger)', map: '#ef4444', mapDim: '#fecaca' },
  neutral: { badgeBg: 'var(--color-neutral-subtle)', badgeText: 'var(--color-neutral)', map: '#cbd5e1', mapDim: '#e2e8f0' },
  neutralSoft: { badgeBg: 'var(--color-neutral-subtle)', badgeText: 'var(--color-neutral)', map: '#e2e8f0', mapDim: '#f1f5f9' },
  teal: { badgeBg: 'var(--color-success-subtle)', badgeText: '#0f766e' },
  pending: { badgeBg: 'var(--color-warning-subtle)', badgeText: 'var(--color-warning)' },
  magenta: { badgeBg: 'var(--color-info-subtle)', badgeText: '#a21caf' },
  research: { badgeBg: 'var(--color-neutral-subtle)', badgeText: 'var(--color-neutral)', map: '#94a3b8', mapDim: '#cbd5e1' },
  restrictedLegacy: { badgeBg: 'var(--color-warning-subtle)', badgeText: 'var(--color-warning)', map: '#fb923c', mapDim: '#fed7aa' },
} as const satisfies Record<string, SemanticSwatch>;

type SwatchKey = keyof typeof SEMANTIC_SWATCHES;

function badge(key: SwatchKey): BadgeColor {
  const swatch = SEMANTIC_SWATCHES[key];
  return { bg: swatch.badgeBg, text: swatch.badgeText };
}

function map(key: SwatchKey): string {
  const swatch = SEMANTIC_SWATCHES[key];
  if (!('map' in swatch)) {
    throw new Error(`[theme] map color is not defined for swatch "${key}"`);
  }
  return swatch.map;
}

function mapDim(key: SwatchKey): string {
  const swatch = SEMANTIC_SWATCHES[key];
  if (!('mapDim' in swatch)) {
    throw new Error(`[theme] dim map color is not defined for swatch "${key}"`);
  }
  return swatch.mapDim;
}

/* ── Stripe-inspired map fill colors (muted, desaturated) ── */
export const REGIME_COLORS: Record<string, string> = {
  Licensing: map('success'),
  Registration: map('info'),
  Sandbox: map('warning'),
  Ban: map('danger'),
  None: map('neutral'),
  Unclear: map('neutralSoft'),
};

export const REGIME_DIM_COLORS: Record<string, string> = {
  Licensing: mapDim('success'),
  Registration: mapDim('info'),
  Sandbox: mapDim('warning'),
  Ban: mapDim('danger'),
  None: mapDim('neutral'),
  Unclear: mapDim('neutralSoft'),
};

/* ── Chip / badge backgrounds (subtle tints) ── */
export const REGIME_CHIP_COLORS: Record<string, BadgeColor> = {
  Licensing: badge('success'),
  Registration: badge('info'),
  Sandbox: badge('warning'),
  Ban: badge('danger'),
  None: badge('neutral'),
  Unclear: badge('neutral'),
};

export const TRAVEL_RULE_COLORS: Record<string, BadgeColor> = {
  Enforced: badge('success'),
  Legislated: badge('teal'),
  'In Progress': badge('warning'),
  'Not Implemented': badge('danger'),
  'N/A': badge('neutral'),
};

/* ── Map fill colors for Travel Rule mode ── */
export const TRAVEL_RULE_MAP_COLORS: Record<string, string> = {
  Enforced: map('success'),
  Legislated: map('info'),
  'In Progress': map('warning'),
  'Not Implemented': map('danger'),
  'N/A': map('neutral'),
};

export const TRAVEL_RULE_MAP_DIM_COLORS: Record<string, string> = {
  Enforced: mapDim('success'),
  Legislated: mapDim('info'),
  'In Progress': mapDim('warning'),
  'Not Implemented': mapDim('danger'),
  'N/A': mapDim('neutral'),
};

export const STATUS_COLORS: Record<string, BadgeColor> = {
  Licensed: badge('success'),
  Provisional: badge('info'),
  Sandbox: badge('warning'),
  Registered: badge('teal'),
  Pending: badge('pending'),
  Unknown: badge('neutral'),
};

export const YIELD_COLORS: Record<string, BadgeColor> = {
  'Yield Allowed': badge('success'),
  'Yield Prohibited': badge('danger'),
};

/* ── Entity sector colors ── */
export const SECTOR_COLORS: Record<string, BadgeColor> = {
  Crypto: badge('info'),
  Payments: badge('teal'),
  Banking: badge('warning'),
};

/* ── Stablecoin type colors ── */
export const STABLECOIN_TYPE_COLORS: Record<string, BadgeColor> = {
  'Fiat-Backed': badge('success'),
  'Crypto-Backed': badge('info'),
  Synthetic: badge('magenta'),
  Hybrid: badge('warning'),
};

/* ── Stablecoin jurisdiction status colors ── */
export const STABLECOIN_STATUS_COLORS: Record<string, BadgeColor> = {
  Compliant: badge('success'),
  Allowed: badge('teal'),
  Restricted: badge('warning'),
  'Non-Compliant': badge('danger'),
  Pending: badge('pending'),
  Discontinued: badge('neutral'),
  Unclear: badge('neutral'),
};

/* ── CBDC status colors ── */
export const CBDC_STATUS_COLORS: Record<string, BadgeColor> = {
  Launched: badge('success'),
  Pilot: badge('info'),
  Development: badge('warning'),
  Research: badge('teal'),
  Cancelled: badge('danger'),
  Inactive: badge('neutral'),
};

/* ── CBDC map fill colors ── */
export const CBDC_MAP_COLORS: Record<string, string> = {
  Launched: map('success'),
  Pilot: map('info'),
  Development: map('warning'),
  Research: map('research'),
  Cancelled: map('danger'),
  Inactive: map('neutral'),
};

export const CBDC_MAP_DIM_COLORS: Record<string, string> = {
  Launched: mapDim('success'),
  Pilot: mapDim('info'),
  Development: mapDim('warning'),
  Research: mapDim('research'),
  Cancelled: mapDim('danger'),
  Inactive: mapDim('neutral'),
};

/* ── Stablecoin regulatory status map fill colors (LEGACY — old stablecoin_jurisdictions) ── */
export const STABLECOIN_MAP_COLORS: Record<string, string> = {
  Compliant: map('success'),
  Allowed: map('info'),
  Pending: map('warning'),
  Restricted: map('restrictedLegacy'),
  'Non-Compliant': map('danger'),
  Discontinued: map('research'),
  Unclear: map('neutral'),
  None: map('neutralSoft'),
};

/* ── Stablecoin STAGE map fill colors (Stride regulatory framework stage 0-3) ── */
export const STABLECOIN_STAGE_MAP_COLORS: Record<string, string> = {
  Live: map('success'),
  'In Progress': map('warning'),
  Developing: map('info'),
  'No Framework': map('neutral'),
  'No Data': map('neutralSoft'),
};

export const STABLECOIN_STAGE_MAP_DIM_COLORS: Record<string, string> = {
  Live: mapDim('success'),
  'In Progress': mapDim('warning'),
  Developing: mapDim('info'),
  'No Framework': mapDim('neutral'),
  'No Data': mapDim('neutralSoft'),
};

/* ── Stablecoin STAGE chip/badge colors ── */
export const STABLECOIN_STAGE_COLORS: Record<string, BadgeColor> = {
  Live: badge('success'),
  'In Progress': badge('warning'),
  Developing: badge('info'),
  'No Framework': badge('neutral'),
  'No Data': badge('neutralSoft'),
};
