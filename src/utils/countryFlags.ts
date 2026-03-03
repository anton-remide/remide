/**
 * Convert an ISO 3166-1 alpha-2 country code to its flag emoji.
 * Each letter is mapped to a Unicode Regional Indicator Symbol.
 * Example: "US" → "🇺🇸", "SG" → "🇸🇬"
 */
export function countryCodeToFlag(code: string): string {
  if (!code || code.length !== 2) return '';
  return [...code.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65))
    .join('');
}
