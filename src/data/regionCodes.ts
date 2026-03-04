/**
 * Regional code expansion — maps supranational codes (e.g. "EU")
 * to their member state ISO 3166-1 alpha-2 codes.
 *
 * Used when stablecoin_jurisdictions or CBDCs reference "EU" as a country_code,
 * which has no corresponding TopoJSON feature on the world map.
 * Instead, we expand "EU" → 27 member states so each country renders correctly.
 */

/** EU member states — 27 countries (post-Brexit) */
export const EU_MEMBER_CODES: readonly string[] = [
  'AT', // Austria
  'BE', // Belgium
  'BG', // Bulgaria
  'HR', // Croatia
  'CY', // Cyprus
  'CZ', // Czechia
  'DK', // Denmark
  'EE', // Estonia
  'FI', // Finland
  'FR', // France
  'DE', // Germany
  'GR', // Greece
  'HU', // Hungary
  'IE', // Ireland
  'IT', // Italy
  'LV', // Latvia
  'LT', // Lithuania
  'LU', // Luxembourg
  'MT', // Malta
  'NL', // Netherlands
  'PL', // Poland
  'PT', // Portugal
  'RO', // Romania
  'SK', // Slovakia
  'SI', // Slovenia
  'ES', // Spain
  'SE', // Sweden
] as const;

/**
 * Expand a country/region code into individual ISO alpha-2 codes.
 * - "EU" → 27 EU member state codes
 * - Any other code → [code] (returned as-is in an array)
 */
export function expandRegionalCode(code: string): string[] {
  if (code.toUpperCase() === 'EU') return [...EU_MEMBER_CODES];
  return [code.toUpperCase()];
}
