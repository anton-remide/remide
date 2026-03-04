/**
 * ISO 3166-1 numeric → alpha-2 country code mapping.
 * Used by Stride tracker parser (Stride uses numeric codes, Supabase uses alpha-2).
 */

const NUMERIC_TO_ALPHA2: Record<number, string> = {
  4: 'AF', 8: 'AL', 12: 'DZ', 20: 'AD', 24: 'AO', 28: 'AG', 32: 'AR',
  36: 'AU', 40: 'AT', 31: 'AZ', 44: 'BS', 48: 'BH', 50: 'BD', 52: 'BB',
  56: 'BE', 60: 'BM', 64: 'BT', 68: 'BO', 70: 'BA', 72: 'BW', 76: 'BR',
  84: 'BZ', 90: 'SB', 96: 'BN', 100: 'BG', 104: 'MM', 108: 'BI',
  112: 'BY', 116: 'KH', 120: 'CM', 124: 'CA', 132: 'CV', 140: 'CF',
  144: 'LK', 148: 'TD', 152: 'CL', 156: 'CN', 158: 'TW', 170: 'CO',
  174: 'KM', 178: 'CG', 180: 'CD', 188: 'CR', 191: 'HR', 192: 'CU',
  196: 'CY', 203: 'CZ', 204: 'BJ', 208: 'DK', 212: 'DM', 214: 'DO',
  218: 'EC', 222: 'SV', 226: 'GQ', 231: 'ET', 232: 'ER', 233: 'EE',
  242: 'FJ', 246: 'FI', 250: 'FR', 262: 'DJ', 266: 'GA', 268: 'GE',
  270: 'GM', 275: 'PS', 276: 'DE', 288: 'GH', 296: 'KI', 300: 'GR',
  308: 'GD', 320: 'GT', 324: 'GN', 328: 'GY', 332: 'HT', 336: 'VA',
  340: 'HN', 344: 'HK', 348: 'HU', 352: 'IS', 356: 'IN', 360: 'ID',
  364: 'IR', 368: 'IQ', 372: 'IE', 376: 'IL', 380: 'IT', 383: 'XK',
  384: 'CI', 388: 'JM', 392: 'JP', 398: 'KZ', 400: 'JO', 404: 'KE',
  408: 'KP', 410: 'KR', 414: 'KW', 417: 'KG', 418: 'LA', 422: 'LB',
  426: 'LS', 428: 'LV', 430: 'LR', 434: 'LY', 438: 'LI', 440: 'LT',
  442: 'LU', 446: 'MO', 450: 'MG', 454: 'MW', 458: 'MY', 462: 'MV',
  466: 'ML', 470: 'MT', 478: 'MR', 480: 'MU', 484: 'MX', 492: 'MC',
  496: 'MN', 498: 'MD', 499: 'ME', 504: 'MA', 508: 'MZ', 512: 'OM',
  516: 'NA', 520: 'NR', 524: 'NP', 528: 'NL', 548: 'VU', 554: 'NZ',
  558: 'NI', 562: 'NE', 566: 'NG', 578: 'NO', 583: 'FM', 584: 'MH',
  585: 'PW', 586: 'PK', 591: 'PA', 598: 'PG', 600: 'PY', 604: 'PE',
  608: 'PH', 616: 'PL', 620: 'PT', 624: 'GW', 626: 'TL', 634: 'QA',
  642: 'RO', 643: 'RU', 646: 'RW', 659: 'KN', 662: 'LC', 670: 'VC',
  674: 'SM', 678: 'ST', 682: 'SA', 686: 'SN', 688: 'RS', 690: 'SC',
  694: 'SL', 702: 'SG', 703: 'SK', 704: 'VN', 705: 'SI', 706: 'SO',
  710: 'ZA', 716: 'ZW', 724: 'ES', 728: 'SS', 729: 'SD', 732: 'EH',
  740: 'SR', 748: 'SZ', 752: 'SE', 756: 'CH', 760: 'SY', 762: 'TJ',
  764: 'TH', 768: 'TG', 776: 'TO', 780: 'TT', 784: 'AE', 788: 'TN',
  792: 'TR', 795: 'TM', 798: 'TV', 800: 'UG', 804: 'UA', 807: 'MK',
  818: 'EG', 826: 'GB', 834: 'TZ', 840: 'US', 854: 'BF', 858: 'UY',
  860: 'UZ', 862: 'VE', 882: 'WS', 887: 'YE', 894: 'ZM',
  // Special: EU (not a country, custom Stride ID)
  999: 'EU',
  // Kosovo (uses telephone code as ID in Stride)
  // 383 already mapped to XK above
  51: 'AM',
};

/** EU member states — 27 countries (post-Brexit) */
export const EU_MEMBER_CODES: readonly string[] = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
] as const;

/** Convert ISO 3166-1 numeric code to alpha-2 */
export function numericToAlpha2(numericCode: number): string | null {
  return NUMERIC_TO_ALPHA2[numericCode] ?? null;
}

/**
 * Expand a country/region code into individual ISO alpha-2 codes.
 * - "EU" → 27 EU member state codes
 * - Any other code → [code] (returned as-is in an array)
 */
export function expandRegionalCode(code: string): string[] {
  if (code.toUpperCase() === 'EU') return [...EU_MEMBER_CODES];
  return [code.toUpperCase()];
}

/** Normalize Stride country name to match RemiDe convention */
export function normalizeCountryName(strideName: string): string {
  return strideName
    .replace(/\s*\(the\)\s*/gi, '')
    .replace(/\s*\(Plurinational State of\)\s*/gi, '')
    .replace(/\s*\(Bolivarian Republic of\)\s*/gi, '')
    .replace(/\s*\(Islamic Republic of\)\s*/gi, '')
    .replace(/\s*\(the Democratic People's Republic of\)\s*/gi, '')
    .replace(/\s*\(the Republic of\)\s*/gi, '')
    .replace(/\s*\(Federated States of\)\s*/gi, '')
    .replace(/\s*\(the Democratic Republic of\)\s*/gi, '')
    .replace(/,\s*the United Republic of/gi, '')
    .replace(/Kingdom of the /gi, '')
    .replace(/\s*,\s*State of/gi, '')
    .trim();
}
