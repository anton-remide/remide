export const COLORS = {
  black: '#0A2540',
  white: '#ffffff',
  bgLight: '#F6F9FC',
  textMuted: '#586B82',
  border: 'rgba(10, 37, 64, 0.08)',
} as const;

/* ── Stripe-inspired map fill colors (muted, desaturated) ── */
export const REGIME_COLORS: Record<string, string> = {
  Licensing: '#5BB98C',
  Registration: '#7B93DB',
  Sandbox: '#D4A55A',
  Ban: '#C97878',
  None: '#CBD5E1',
  Unclear: '#E2E8F0',
};

/* ── Chip / badge backgrounds (subtle tints) ── */
export const REGIME_CHIP_COLORS: Record<string, { bg: string; text: string }> = {
  Licensing: { bg: '#ECFDF3', text: '#2B7A4B' },
  Registration: { bg: '#EEF0FF', text: '#4B5CC4' },
  Sandbox: { bg: '#FFF8EB', text: '#92610B' },
  Ban: { bg: '#FFF0F0', text: '#A93F3F' },
  None: { bg: '#F1F5F9', text: '#586B82' },
  Unclear: { bg: '#F1F5F9', text: '#586B82' },
};

export const TRAVEL_RULE_COLORS: Record<string, { bg: string; text: string }> = {
  Enforced: { bg: '#ECFDF3', text: '#2B7A4B' },
  Legislated: { bg: '#F0FDFA', text: '#0D6857' },
  'In Progress': { bg: '#FFF8EB', text: '#92610B' },
  'Not Implemented': { bg: '#FFF0F0', text: '#A93F3F' },
  'N/A': { bg: '#F1F5F9', text: '#586B82' },
};

/* ── Map fill colors for Travel Rule mode ── */
export const TRAVEL_RULE_MAP_COLORS: Record<string, string> = {
  Enforced: '#5BB98C',
  Legislated: '#7B93DB',
  'In Progress': '#D4A55A',
  'Not Implemented': '#C97878',
  'N/A': '#CBD5E1',
};

export const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  Licensed: { bg: '#ECFDF3', text: '#2B7A4B' },
  Provisional: { bg: '#EEF0FF', text: '#4B5CC4' },
  Sandbox: { bg: '#FFF8EB', text: '#92610B' },
  Registered: { bg: '#F0FDFA', text: '#0D6857' },
  Pending: { bg: '#FFF7ED', text: '#9A3C12' },
  Unknown: { bg: '#F1F5F9', text: '#586B82' },
};

/* ── Stablecoin type colors ── */
export const STABLECOIN_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  'Fiat-Backed': { bg: '#ECFDF3', text: '#2B7A4B' },
  'Crypto-Backed': { bg: '#EEF0FF', text: '#4B5CC4' },
  Synthetic: { bg: '#FFF0F5', text: '#9B2C6E' },
  Hybrid: { bg: '#FFF8EB', text: '#92610B' },
};

/* ── Stablecoin jurisdiction status colors ── */
export const STABLECOIN_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  Compliant: { bg: '#ECFDF3', text: '#2B7A4B' },
  Allowed: { bg: '#F0FDFA', text: '#0D6857' },
  Restricted: { bg: '#FFF8EB', text: '#92610B' },
  'Non-Compliant': { bg: '#FFF0F0', text: '#A93F3F' },
  Pending: { bg: '#FFF7ED', text: '#9A3C12' },
  Discontinued: { bg: '#F1F5F9', text: '#586B82' },
  Unclear: { bg: '#F1F5F9', text: '#586B82' },
};

/* ── CBDC status colors ── */
export const CBDC_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  Launched: { bg: '#ECFDF3', text: '#2B7A4B' },
  Pilot: { bg: '#EEF0FF', text: '#4B5CC4' },
  Development: { bg: '#FFF8EB', text: '#92610B' },
  Research: { bg: '#F0FDFA', text: '#0D6857' },
  Cancelled: { bg: '#FFF0F0', text: '#A93F3F' },
  Inactive: { bg: '#F1F5F9', text: '#586B82' },
};

/* ── CBDC map fill colors ── */
export const CBDC_MAP_COLORS: Record<string, string> = {
  Launched: '#5BB98C',
  Pilot: '#7B93DB',
  Development: '#D4A55A',
  Research: '#94A3B8',
  Cancelled: '#C97878',
  Inactive: '#CBD5E1',
};
