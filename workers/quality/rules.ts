/**
 * Quality Worker — Rules Engine
 *
 * Four responsibilities:
 * 1. CLEANUP   — canonical_name normalization, garbage detection
 * 2. CLASSIFY  — crypto_status by parser_id + keywords
 * 3. SCORE     — quality_score 0-100 based on Data Tiers T1-T4
 * 4. VALIDATE  — flag data quality issues (registry URLs in website, etc.)
 *
 * Related decisions: ARCH-008, DATA-003, DATA-005, DATA-006
 */

import { isRegistryWebsite } from '../../shared/registry-domains.js';

/* ── Types ── */

export interface QualityInput {
  id: string;
  name: string;
  country_code: string;
  license_number: string;
  license_type: string | null;
  entity_types: string[];
  activities: string[];
  status: string;
  regulator: string | null;
  website: string | null;
  description: string | null;
  linkedin_url: string | null;
  parser_id: string | null;
  crypto_status: string | null;
  is_garbage: boolean;
  quality_score: number;
}

export interface QualityResult {
  id: string;
  canonical_name: string;
  brand_name: string | null;
  is_garbage: boolean;
  garbage_reason: string | null;
  quality_score: number;
  quality_flags: QualityFlags;
  crypto_status: string;
}

export interface QualityFlags {
  rules: string[];
  garbage_reason: string | null;
  tier: string;
  cleanup_applied: string[];
}

/* ═══════════════════════════════════════════
   1. CLEANUP — Name Normalization
   ═══════════════════════════════════════════ */

/** Remove legal suffixes and normalize spacing/casing */
const LEGAL_SUFFIXES = [
  // Polish "Spółka z ograniczoną odpowiedzialnością" (LLC equivalent) — before generic suffixes
  /\s*Sp(?:ó|o)łka\s+z\s+o(?:graniczon[aą]|\.?)\s*o(?:dpowiedzialno[sś]ci[aą]?|\.?)\s*\.?\s*$/i,
  /\s*\bSp\.\s*z\s*o\.?\s*o\.?\s*$/i,   // Abbreviated: "Sp. z o.o."
  // Polish "Spółka Akcyjna" (= S.A. / joint-stock company)
  /\s*Sp(?:ó|o)łka\s+Akcyjna\s*$/i,
  // Polish "Spółka komandytowa", "Spółka jawna", etc.
  /\s*Sp(?:ó|o)łka\s+(?:komandytowa|jawna|partnerska|cywilna)\s*$/i,
  // German
  /\s*\b(GmbH\s*&?\s*Co\.?\s*KG|GmbH|e\.?G\.?|AG|UG|KG|OHG)\s*\.?\s*$/i,
  // Compound suffixes (BEFORE generic LTD/LLC — these contain LLC/Ltd as substrings)
  /\s*\bPvt\.?\s*Ltd\.?\s*$/i,          // Indian: Pvt. Ltd.
  /\s*\bFZ-?LLC\s*$/i,                  // Emirati: FZ-LLC
  /\s*\b(FZCO|FZE)\s*$/i,              // Emirati: FZCO, FZE
  /\s*\bExempt\s+Limited\s+Partnership\s*$/i,  // Bermuda
  /\s*\bPrivate\s+Limited\s+Company\s*$/i,
  /\s*\bPty\.?\s+Ltd\.?\s*$/i,          // UK/AU/SG
  /\s*\bCo\.?\s*Ltd\.?\s*$/i,           // "Co. Ltd."
  // Generic legal forms (after compound patterns)
  /\s*\b(S\.?L\.?|S\.?A\.?|S\.?R\.?L\.?|S\.?P\.?A\.?|N\.?V\.?|B\.?V\.?|SE|PLC|LTD\.?|LLC|INC\.?|CORP\.?|A\.?S\.?|AB|OY|OYJ|d\.?o\.?o\.?|ApS|EHIF|KFT|ZRT|UAB|SIA|SARL|EURL)\s*\.?\s*$/i,
  // CIS/Central Asian legal forms (Kazakhstan, Russia, etc.)
  /\s*\b(JSC|OJSC|PJSC|CJSC|Joint[- ]Stock\s+Company)\s*$/i,
  // Russian: ООО, ЗАО, ОАО, ПАО
  /\s*\b(ООО|ЗАО|ОАО|ПАО|АО|ИП)\s*$/,
  // Turkish: A\.Ş\., Anonim Şirketi, Ltd\.Şti\.
  /\s*\b(A\.?\s*Ş\.?|Anonim\s+Şirketi|Ltd\.?\s*Şti\.?)\s*$/i,
  // Brazilian: S\/A, Ltda, EIRELI
  /\s*\b(S\/A|Ltda\.?|EIRELI)\s*$/i,
  // Japanese: 株式会社, K.K.
  /\s*株式会社\s*$/,
  /\s*\b(Kabushiki\s+Kaisha|K\.?K\.?)\s*$/i,
  // Korean: 주식회사
  /\s*주식회사\s*$/,
  // Standalone fragments left after compound removal
  /\s*\bPvt\.?\s*$/i,
  /\s*\bLimited\s*$/i,
  /\s*\bPty\.?\s*$/i,
  // Polish former name: "(d. Former Name Here)" — must be BEFORE generic parenthetical
  /\s*\(d\.\s*[^)]+\)\s*$/i,
  // Trailing parenthetical: "Company (former Name)"
  /\s*\([^)]*\)\s*$/,
];

/** Common prefixes that are noise */
const NOISE_PREFIXES = [
  /^\d+\.\s*/,           // "1. Company Name" → "Company Name"
  /^[-–—•·]\s*/,         // Bullet points
  /^Subsidiary\s+Organization\s+of\s+/i,  // CIS: "Subsidiary Organization of Halyk Bank..." → "Halyk Bank..."
  /^(JSC|OJSC|PJSC|CJSC)\s+/i,            // CIS prefix: "JSC Altyn Bank" → "Altyn Bank"
];

/** Characters that indicate garbage if they dominate the name */
const GARBAGE_CHAR_PATTERNS = [
  /^\d[\d\s./-]+$/,            // Pure numbers/dates: "2024.01.15", "123/456"
  /^[A-Z]{2,5}\d{3,}$/,       // Registry codes: "PL00123456"
  /^\d{1,2}[./]\d{1,2}[./]\d{2,4}$/,  // Date formats
  /^\d{4}-\d{2}-\d{2}$/,      // ISO dates: "2024-01-15"
  // Written-out dates: "1 October 2021", "10 February 2022", "28 March 2024" (AUSTRAC registration dates)
  /^\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}$/i,
  // CONSOB/ESMA gibberish codes: "01luhar", "03wakih", "09pqws", "12DEF", "Cfsd123"
  // Pattern: 2 digits + 3-8 all-lowercase OR 2 digits + 2-5 all-uppercase
  // NOT matching real names like "21Shares" (mixed case = real brand)
  /^\d{2}[a-z]{3,8}$/,
  /^\d{2}[A-Z]{2,5}$/,
  // ESMA/CONSOB gibberish codes starting with letters: "Cfsd123", "Sdf837", "Caa871"
  // Pattern: exactly 3 non-word lowercase + digits, total <= 8 chars (not matching "Emoney247")
  // These are random alpha+digit codes, not company names
  /^[A-Z][a-z]{2,4}\d{2,4}$/,
  /^Art\.\s*\d/i,              // Article references: "Art. 45"
  /^§\s*\d/,                   // Section references: "§ 12"
  /^note\s*\d/i,               // Footnote references: "Note 1"
  /^[\[\(]\d+[\]\)]/,          // Bracketed numbers: "[1]", "(3)"
  /^see\s/i,                   // Cross-references: "See above"
  /^ibid/i,                    // Latin references
  /^[-–—.\s]+$/,               // Pure punctuation/whitespace (incl. "- -", "– –")
  /^[*]+$/,                    // Asterisks
  /^N\/A$/i,                   // Not available
  /^n\.?a\.?$/i,
  /^TBD$/i,
  /^TBC$/i,
  /^-$/,
  /^\.$/,
  /^\([^)]*\)$/,               // Parenthetical-only names: "(FKA Company Name)"
];

/** Minimum name length to be considered valid */
const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 200;

/** Garbage: names that are just registry boilerplate */
const BOILERPLATE_NAMES = [
  'not applicable',
  'not available',
  'none',
  'n/a',
  'tbd',
  'tbc',
  'unknown',
  'various',
  'see above',
  'see below',
  'ibid',
  'pending',
  'redacted',
  'confidential',
  'test',
  'test entity',
  'example',
  'sample',
];

/** Common European first names — used to detect sole proprietor entries (personal names) */
const PERSONAL_FIRST_NAMES = new Set([
  // Polish (most common in EBA-PL data)
  'agnieszka', 'marek', 'jolanta', 'artur', 'krzysztof', 'marta', 'piotr',
  'joanna', 'kamil', 'maciej', 'pawe\u0142', 'daria', 'mariusz', 'arkadiusz',
  'dominika', 'stanis\u0142awa', 'adam', 'anna', 'jan', 'andrzej', 'tomasz',
  'barbara', 'magdalena', 'katarzyna', 'wojciech', 'grzegorz', 'zbigniew',
  'rafa\u0142', 'robert', 'monika', 'dorota', 'jacek', 'henryk', 'ewa',
  'ma\u0142gorzata', 'beata', 'danuta', 'tadeusz', '\u0142ukasz', 'karol',
  'aleksandra', 'micha\u0142', 'marcin', 'jakub', 'szymon', 'damian',
  // Nordic
  'nasra', 'erik', 'lars', 'anders', 'johan', 'karl', 'olof', 'per',
  'nils', 'ingvar', 'sven', 'birgitta', 'karin',
  // German
  'hans', 'fritz', 'klaus', 'dieter', 'wolfgang', 'j\u00FCrgen', 'helmut',
  'gerhard', 'heinrich', 'werner', 'manfred', 'horst', 'g\u00FCnter',
  // French
  'jean', 'pierre', 'marie', 'jacques', 'philippe', 'alain', 'michel',
  // Italian
  'giovanni', 'giuseppe', 'antonio', 'marco', 'luca', 'francesca', 'laura',
  // Spanish
  'carlos', 'jose', 'miguel', 'francisco', 'manuel',
  // General European
  'alexander', 'christian', 'thomas', 'martin', 'michael', 'peter', 'stefan',
  'david', 'daniel', 'andreas', 'sandra', 'nicole', 'elena', 'natalia',
]);

/** Check if a name is likely a personal name (sole proprietor, not a company) */
function isPersonalName(name: string): boolean {
  const words = name.split(/\s+/);
  if (words.length !== 2) return false;
  if (name.length >= 35) return false;
  if (/\d/.test(name)) return false;
  const firstName = words[0].toLowerCase().normalize('NFC');
  return PERSONAL_FIRST_NAMES.has(firstName);
}

/** Words that should stay uppercase (acronyms, known brands, etc.) */
const UPPERCASE_WORDS = new Set([
  'LLC', 'LLP', 'PLC', 'JSC', 'OJSC', 'PJSC', 'CJSC',
  'USA', 'UK', 'EU', 'UAE', 'FCA', 'SEC', 'API',
  'ATM', 'BTC', 'ETH', 'DLT', 'NFT', 'DAO', 'DEX', 'KYC', 'AML',
  'FX', 'OTC', 'ICO', 'IPO', 'CEO', 'CTO', 'CFO', 'IT', 'AI',
  'ADAS-TEL', 'VB', 'FHU', 'FHUP', 'PHU', 'PPHU',
  // Currencies and finance
  'GMO', 'JPY', 'USD', 'GBP', 'EUR', 'CHF', 'PLN', 'CZK',
  // Polish business abbreviations
  'RTV', 'AGD', 'PHU', 'PPHU', 'FHU', 'FHUP',
  // Company names that should stay uppercase
  'ICE', 'NYDIG', 'NY', 'DE',
]);

export function cleanName(raw: string): string {
  let name = raw.trim();

  // Remove noise prefixes
  for (const pattern of NOISE_PREFIXES) {
    name = name.replace(pattern, '');
  }

  // Strip markdown bold/italic markers: "**text" or "*text"
  name = name.replace(/^\*{1,2}\s*/, '');

  // Strip all quote characters (regular, typographic, Polish „", fullwidth, etc.)
  // Also strip double-comma opening quotes: ,,Company'' (Polish convention)
  name = name.replace(/^,,/, '');                          // Leading ,, (Polish open quote)
  name = name.replace(/''/g, '');                          // '' (Polish close quote)
  // Note: \u0027 (ASCII ') intentionally EXCLUDED — preserves apostrophes in "Brink's", "O'Brien"
  name = name.replace(/[\u0022\u201C\u201D\u201E\u201F\u00AB\u00BB\u2039\u203A\u0060\u02BA\u02EE\u02DD\uFF02\uFF07]/g, '');

  // Normalize smart apostrophes → ASCII apostrophe: "Brink\u2019s" → "Brink's"
  name = name.replace(/[\u2018\u2019\u201A\u201B]/g, "'");

  // Normalize double-dash to en-dash: "Binance (Pakistan -- P2P)" → "Binance (Pakistan – P2P)"
  name = name.replace(/\s--\s/g, ' – ');

  // Normalize em-dash to en-dash for consistency: "Binance (Pakistan — P2P)" → "Binance (Pakistan – P2P)"
  name = name.replace(/\u2014/g, '–');

  // Remove soft hyphens and zero-width characters
  name = name.replace(/[\u00AD\u200B\u200C\u200D\uFEFF]/g, '');

  // Strip trailing asterisks (annotation markers: "Gemini Dollar*")
  name = name.replace(/\*+$/, '');

  // Collapse multiple spaces
  name = name.replace(/\s+/g, ' ').trim();

  // Handle "f/k/a" (formerly known as) BEFORE legal suffix removal
  // "Block, Inc., f/k/a Square, Inc." → "Block, Inc." → then suffix removal → "Block"
  // Also handles parenthesized: "Ripple Markets DE LLC (f/k/a XRP II LLC)"
  name = name.replace(/[,\s]*\(?\s*f\/k\/a\s+[^)]+\)?\s*$/i, '').trim();

  // Handle DBA (doing business as) clauses — strip the DBA alias, keep primary name
  // "Company X doing business in the AIFC as Company Y" → "Company X"
  // "Moon Inc. d/b/a LibertyX" → "Moon Inc."
  // "Aux Cayes FinTech Co. Ltd T/A OKX" → "Aux Cayes FinTech Co. Ltd"
  // "Company d.b.a. SomeName" → "Company"
  // Patterns: "doing business (in ...) as", "d/b/a", "d.b.a.", "t/a", "trading as", "operating as"
  name = name.replace(/\s+doing\s+business\s+(?:in\s+.+?\s+)?as\s+.+$/i, '').trim();
  name = name.replace(/\s+d\/b\/a\s+.+$/i, '').trim();
  name = name.replace(/\s+d\.b\.a\.?\s+.+$/i, '').trim();
  name = name.replace(/\s+t\/a\s+.+$/i, '').trim();
  name = name.replace(/\s+trading\s+as\s+.+$/i, '').trim();
  name = name.replace(/\s+operating\s+as\s+.+$/i, '').trim();

  // Remove legal suffixes iteratively (some names have multiple: "Corp. (d. Old Name)")
  let prevName = '';
  while (prevName !== name) {
    prevName = name;
    for (const pattern of LEGAL_SUFFIXES) {
      name = name.replace(pattern, '').trim();
    }
  }

  // Clean up trailing comma/period left after suffix removal: "Coinbase," → "Coinbase"
  name = name.replace(/[,;.]+\s*$/, '').trim();

  // Collapse multiple consecutive commas/periods: "Company,, City" → "Company, City"
  name = name.replace(/,{2,}/g, ',').replace(/\.{2,}/g, '.');

  // Fix ALL-CAPS (common in Italian CONSOB, French AMF, Polish KNF)
  // Only convert if MOST of the alphabetic characters are uppercase
  const alphaChars = name.replace(/[^a-zA-Z]/g, '');
  const upperRatio = alphaChars.length > 0
    ? alphaChars.replace(/[^A-Z]/g, '').length / alphaChars.length
    : 0;

  if (upperRatio > 0.7 && alphaChars.length > 3) {
    name = name
      .split(/(\s+|-)/g)  // Split by space OR hyphen, keeping delimiters
      .map(part => {
        if (/^\s+$/.test(part) || part === '-') return part; // Keep delimiters
        const upper = part.toUpperCase();
        if (UPPERCASE_WORDS.has(upper)) return upper; // Keep known acronyms
        if (part.length <= 2) return part.toUpperCase(); // Keep 1-2 char words uppercase
        // Title case: first char upper, rest lower
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      })
      .join('');
  }

  // Fix extra whitespace
  name = name.replace(/\s+/g, ' ').trim();

  // If name became empty after cleaning, return trimmed original
  if (name.length < 2) return raw.trim();

  return name;
}

export function detectGarbage(entity: QualityInput): { isGarbage: boolean; reason: string | null } {
  const name = entity.name.trim();

  // Too short
  if (name.length < MIN_NAME_LENGTH) {
    return { isGarbage: true, reason: `name_too_short:${name.length}` };
  }

  // Too long (data corruption)
  if (name.length > MAX_NAME_LENGTH) {
    return { isGarbage: true, reason: `name_too_long:${name.length}` };
  }

  // Known boilerplate
  if (BOILERPLATE_NAMES.includes(name.toLowerCase())) {
    return { isGarbage: true, reason: `boilerplate:${name.toLowerCase()}` };
  }

  // Garbage character patterns (dates, codes, footnotes, etc.)
  for (const pattern of GARBAGE_CHAR_PATTERNS) {
    if (pattern.test(name)) {
      return { isGarbage: true, reason: `pattern:${pattern.source}` };
    }
  }

  // Single character
  if (name.length === 1) {
    return { isGarbage: true, reason: 'single_char' };
  }

  // Pure numbers (even long ones)
  if (/^\d+$/.test(name)) {
    return { isGarbage: true, reason: 'pure_number' };
  }

  // Numbered companies: "1000224522 ONTARIO INC.", "1035596 ALBERTA LTD", "9876543 CANADA INC."
  // These are legitimate FINTRAC/registry entries but just shell numbered corporations — useless for display.
  // 6+ leading digits followed by any word = never a real brand/company name.
  if (/^\d{6,}\s+[A-Za-z]/.test(name)) {
    return { isGarbage: true, reason: 'numbered_company' };
  }

  // Quebec/Canadian numbered companies with dash format: "9435-9643 Québec", "9070-9122 Quebec"
  // Format: XXXX-XXXX followed by anything — these are shell numbered corps from ca-fintrac.
  if (/^\d{4}-\d{4}\s/.test(name) && entity.country_code === 'CA') {
    return { isGarbage: true, reason: 'numbered_company:quebec' };
  }

  // List-numbered entries: "1)kantor Wymiany Walut..." — multiple businesses concatenated
  if (/^\d+\)/.test(name)) {
    return { isGarbage: true, reason: 'garbage:list_numbered' };
  }

  // Description-as-name: NYDFS entries where "name" is actually a description sentence
  // e.g. "**The Department granted Provenance Technologies, Inc. a money transmitter license..."
  // Detect: starts with markdown ** or *, contains sentence-like structure, > 80 chars
  if (name.length > 80 && /^\*{1,2}[A-Z]/.test(name)) {
    return { isGarbage: true, reason: 'description_as_name:markdown_sentence' };
  }

  // Long text that reads like a sentence (contains common verbs + articles)
  if (name.length > 100) {
    const lower = name.toLowerCase();
    const sentenceIndicators = ['granted', 'approved', 'license in', 'was issued', 'the department', 'pursuant to'];
    const isSentence = sentenceIndicators.some(ind => lower.includes(ind));
    if (isSentence) {
      return { isGarbage: true, reason: 'description_as_name:sentence_detected' };
    }
  }

  // Single-word generic names that aren't real entity names
  // e.g. "Bitcoin", "Ethereum" as standalone entries in NYDFS (these are coins, not companies)
  const COIN_NAMES = ['bitcoin', 'ethereum', 'litecoin', 'ripple', 'dogecoin', 'solana', 'cardano'];
  if (COIN_NAMES.includes(name.toLowerCase())) {
    return { isGarbage: true, reason: `coin_name:${name.toLowerCase()}` };
  }

  // Personal names (sole proprietors): not relevant for B2B platform
  // Detected by matching first word against common European first names
  // Only triggers for 2-word names < 35 chars with no digits (to avoid "365 Finance")
  if (isPersonalName(name)) {
    return { isGarbage: true, reason: 'personal_name:sole_proprietor' };
  }

  // Out-of-scope activities: insurance, pension funds (per product scope definition)
  const activities = (entity.activities ?? []).map(a => a.toLowerCase());
  if (activities.some(a => a.includes('insurance') || a.includes('pension') || a.includes('reinsurance'))) {
    return { isGarbage: true, reason: 'out_of_scope:insurance_pension' };
  }

  // Out-of-scope license types: insurance, credit unions (per product scope — DQ-001)
  const lt = (entity.license_type ?? '').toLowerCase();
  if (lt.includes('insurance') || lt.includes('reinsurance')) {
    return { isGarbage: true, reason: 'out_of_scope:insurance_license' };
  }
  if (lt.includes('credit union')) {
    return { isGarbage: true, reason: 'out_of_scope:credit_union' };
  }

  // Duplicate/test markers
  if (/\b(test|dummy|fake|placeholder|sample|demo)\b/i.test(name) && name.length < 30) {
    return { isGarbage: true, reason: 'test_entry' };
  }

  // URL-as-name (data import artifacts)
  if (/^https?:\/\//.test(name)) {
    return { isGarbage: true, reason: 'url_as_name' };
  }

  // Email-as-name
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(name)) {
    return { isGarbage: true, reason: 'email_as_name' };
  }

  // All-punctuation after stripping alphanumerics
  if (name.replace(/[^a-zA-Z0-9\u00C0-\u024F\u0400-\u04FF]/g, '').length < 2) {
    return { isGarbage: true, reason: 'no_alpha_content' };
  }

  return { isGarbage: false, reason: null };
}

/* ═══════════════════════════════════════════
   2. CLASSIFY — crypto_status
   ═══════════════════════════════════════════ */

/**
 * Parser → crypto_status mapping (from DDL 007 initial classification).
 * This is the definitive mapping for parser-based classification.
 * Quality Worker uses this for entities that weren't classified by DDL.
 */
const PARSER_CRYPTO_MAP: Record<string, string> = {
  // VASP/CASP/DPT registries → confirmed_crypto
  'esma-de': 'confirmed_crypto', 'esma-nl': 'confirmed_crypto', 'esma-fr': 'confirmed_crypto',
  'esma-es': 'confirmed_crypto', 'esma-it': 'confirmed_crypto', 'esma-at': 'confirmed_crypto',
  'esma-cz': 'confirmed_crypto', 'esma-fi': 'confirmed_crypto', 'esma-ie': 'confirmed_crypto',
  'esma-lt': 'confirmed_crypto', 'esma-lu': 'confirmed_crypto', 'esma-lv': 'confirmed_crypto',
  'esma-mt': 'confirmed_crypto', 'esma-pl': 'confirmed_crypto', 'esma-sk': 'confirmed_crypto',
  'esma-si': 'confirmed_crypto', 'esma-cy': 'confirmed_crypto', 'esma-bg': 'confirmed_crypto',
  'esma-se': 'confirmed_crypto', 'esma-be': 'confirmed_crypto', 'esma-hr': 'confirmed_crypto',
  'esma-pt': 'confirmed_crypto', 'esma-ro': 'confirmed_crypto', 'esma-hu': 'confirmed_crypto',
  'esma-gr': 'confirmed_crypto', 'esma-ee': 'confirmed_crypto', 'esma-dk': 'confirmed_crypto',
  'esma-li': 'confirmed_crypto', 'esma-no': 'confirmed_crypto', 'esma-is': 'confirmed_crypto',
  'esma-unified': 'confirmed_crypto',
  'ae-vara': 'confirmed_crypto', 'ae-adgm': 'confirmed_crypto', 'ae-dfsareg': 'confirmed_crypto',
  'th-sec': 'confirmed_crypto', 'my-sc': 'confirmed_crypto', 'sc-fsa': 'confirmed_crypto',
  'gi-gfsc': 'confirmed_crypto', 'im-fsa': 'confirmed_crypto', 'li-fma': 'confirmed_crypto',
  'tw-fsc': 'confirmed_crypto', 'ky-cima': 'confirmed_crypto', 'id-ojk': 'confirmed_crypto',
  'hk-sfc': 'confirmed_crypto', 'kr-fiu': 'confirmed_crypto', 'ar-cnv': 'confirmed_crypto',
  'ph-bsp': 'confirmed_crypto', 'sv-cnad': 'confirmed_crypto',
  'us-nydfs': 'confirmed_crypto', 'ng-sec': 'confirmed_crypto',

  // Banking registries → traditional
  'us-fdic': 'traditional', 'gb-pra': 'traditional',

  // Dedicated crypto registries (newer additions)
  'jp-fsa': 'confirmed_crypto',   // FSA crypto-asset exchange registry
  'gb-fca': 'unknown',            // FCA mixed registry — keyword analysis needed
  'in-fiu': 'unknown',            // India FIU — mixed
  'tr-spk': 'unknown',            // Turkey SPK — mixed
  'kz-afsa': 'unknown',           // Kazakhstan AFSA — mixed (AIFC has fintech focus)
  'bh-cbb': 'unknown',            // Bahrain CBB — mixed
  'sa-sama': 'unknown',           // Saudi SAMA — mixed
  'qa-qfcra': 'unknown',          // Qatar QFCRA — mixed
  'co-sfc': 'unknown',            // Colombia SFC — mixed
  'mx-cnbv': 'unknown',           // Mexico CNBV — mixed
  'cl-cmf': 'unknown',            // Chile CMF — mixed

  // Mixed registries → unknown (need keyword analysis)
  'au-austrac': 'unknown', 'ca-fintrac': 'unknown',
  'sg-mas': 'unknown', 'ch-finma': 'unknown', 'us-fincen': 'unknown',
  'za-fsca': 'confirmed_crypto',  // FSCA CASP register is crypto-specific
  'br-bcb': 'unknown', 'bm-bma': 'unknown',
};

/** Crypto-indicating keywords in entity names, activities, license types */
const CRYPTO_KEYWORDS = [
  // Core terms
  'crypto', 'bitcoin', 'btc', 'blockchain', 'digital asset', 'virtual asset',
  'vasp', 'casp', 'defi', 'nft', 'token', 'exchange', 'wallet', 'custody',
  'stablecoin', 'mining', 'web3', 'dao', 'dex', 'cefi', 'fintech',
  'digital currency', 'virtual currency', 'cryptocurrency',
  'distributed ledger', 'dlt',
  // Well-known company names (strong signal)
  'binance', 'coinbase', 'kraken', 'okx', 'kucoin', 'huobi', 'bybit',
  'bitfinex', 'gemini', 'bitpanda', 'bitstamp', 'bitso', 'luno',
  'crypto.com', 'nexo', 'celsius', 'blockfi', 'ledger', 'trezor',
  'chainalysis', 'fireblocks', 'circle', 'paxos', 'anchorage',
  'bakkt', 'galaxy digital', 'grayscale', 'bitgo', 'prime trust',
  'moonpay', 'simplex', 'wyre', 'ramp', 'transak', 'mercuryo',
  'hashkey', 'amber group', 'matrixport', 'coinhako', 'independent reserve',
  'valr', 'altcointrader', 'ice3x',
  // Coin/protocol names (medium signal)
  'ethereum', 'eth', 'litecoin', 'ripple', 'solana', 'cardano', 'polkadot',
  'avalanche', 'polygon', 'tether', 'usdc', 'usdt', 'dogecoin',
  // Activity keywords
  'digital payment token', 'dpt service', 'crypto asset service',
  'virtual asset service', 'digital token', 'crypto exchange',
  'bitcoin atm', 'crypto atm', 'digital asset exchange',
  'digital asset custody', 'digital asset broker',
  // License types
  'money service business', 'msb', 'money transmitter',
  'payment institution', 'e-money',
];

/** Keywords indicating traditional finance */
const TRADFI_KEYWORDS = [
  'bank', 'banking', 'savings', 'credit union', 'mortgage', 'insurance',
  'pension', 'mutual fund', 'brokerage', 'securities', 'bonds',
  'thrift', 'savings association', 'building society',
  'cooperative bank', 'agricultural bank', 'development bank',
  'trust company', 'asset management', 'wealth management',
  'leasing', 'factoring', 'microfinance',
];

/** Website domain fragments that indicate crypto businesses */
const CRYPTO_DOMAINS = [
  'bit', 'coin', 'crypto', 'chain', 'block', 'token', 'swap',
  'dex', 'defi', 'nft', 'web3', 'dao', 'wallet', 'ledger',
  'mining', 'hash', 'satoshi', 'btc', 'eth',
];

/** License type patterns that definitively classify */
const CRYPTO_LICENSE_PATTERNS = [
  /virtual\s*(?:asset|currency)/i,
  /crypto\s*(?:asset|currency)/i,
  /digital\s*(?:asset|currency|payment\s*token)/i,
  /dpt\s*service/i,
  /casp|vasp/i,
  /money\s*transmit/i,
  /msb\s*registration/i,
];

const TRADFI_LICENSE_PATTERNS = [
  /^bank(?:ing)?\s*(?:license|charter)/i,
  /credit\s*union/i,
  /insurance\s*(?:license|broker)/i,
  /pension\s*fund/i,
  /building\s*society/i,
];

export function classifyCryptoStatus(entity: QualityInput): string {
  const parserId = entity.parser_id;

  // 1. Check parser mapping (definitive classification)
  if (parserId) {
    if (parserId.startsWith('eba-')) return 'traditional';

    const mapped = PARSER_CRYPTO_MAP[parserId];
    if (mapped && mapped !== 'unknown') return mapped;
  }

  // 2. License type patterns (strong signal)
  const lt = entity.license_type ?? '';
  if (CRYPTO_LICENSE_PATTERNS.some(p => p.test(lt))) {
    return 'confirmed_crypto';
  }
  if (TRADFI_LICENSE_PATTERNS.some(p => p.test(lt))) {
    return 'traditional';
  }

  // 3. Keyword analysis across all text fields
  const searchText = [
    entity.name,
    entity.license_type,
    ...(entity.activities ?? []),
    ...(entity.entity_types ?? []),
    entity.description,
  ].filter(Boolean).join(' ').toLowerCase();

  const hasCryptoKeyword = CRYPTO_KEYWORDS.some(kw => searchText.includes(kw));
  const hasTradfiKeyword = TRADFI_KEYWORDS.some(kw => searchText.includes(kw));

  if (hasCryptoKeyword && !hasTradfiKeyword) return 'confirmed_crypto';
  if (hasCryptoKeyword && hasTradfiKeyword) return 'crypto_adjacent';
  if (hasTradfiKeyword && !hasCryptoKeyword) return 'traditional';

  // 4. Website domain heuristic (weak signal, tiebreaker for 'unknown')
  const website = (entity.website ?? '').toLowerCase();
  if (website && CRYPTO_DOMAINS.some(d => website.includes(d))) {
    return 'crypto_adjacent';
  }

  return 'unknown';
}

/* ═══════════════════════════════════════════
   3. SCORE — Quality Score (Data Tiers T1-T4)
   ═══════════════════════════════════════════ */

/**
 * Quality scoring based on data completeness (DATA-006).
 *
 * T1 (10-30): name + license only
 * T2 (40-60): + website + description
 * T3 (60-80): + LinkedIn + social
 * T4 (80-100): + revenue + products + full enrichment
 *
 * Each field contributes points. Max = 100.
 */
interface ScoreBreakdown {
  total: number;
  tier: string;
  fields: Record<string, number>;
}

const FIELD_WEIGHTS: Array<{ field: string; check: (e: QualityInput) => boolean; points: number }> = [
  // T1 Fields (base: every entity has name)
  { field: 'name', check: (e) => !!e.name && e.name.trim().length > 2, points: 10 },
  { field: 'license_number', check: (e) => !!e.license_number && e.license_number.trim().length > 0, points: 5 },
  { field: 'license_type', check: (e) => !!e.license_type && e.license_type.trim().length > 0, points: 5 },
  { field: 'status', check: (e) => !!e.status && e.status !== 'Unknown', points: 5 },
  { field: 'regulator', check: (e) => !!e.regulator && e.regulator.trim().length > 0, points: 5 },

  // T2 Fields — registry URLs don't count as a real website
  { field: 'website', check: (e) => !!e.website && e.website.trim().length > 3 && e.website !== 'N/A' && !isRegistryWebsite(e.website), points: 15 },
  { field: 'description', check: (e) => !!e.description && e.description.trim().length > 20, points: 15 },

  // T3 Fields
  { field: 'linkedin_url', check: (e) => !!e.linkedin_url && e.linkedin_url.includes('linkedin.com'), points: 10 },
  { field: 'activities', check: (e) => Array.isArray(e.activities) && e.activities.length > 0, points: 10 },
  { field: 'entity_types', check: (e) => Array.isArray(e.entity_types) && e.entity_types.length > 0, points: 10 },

  // T4 Fields (future — will be scored when enrichment adds these)
  // { field: 'revenue', check: ..., points: 5 },
  // { field: 'employee_count', check: ..., points: 5 },
  // { field: 'products', check: ..., points: 5 },
];

export function calculateScore(entity: QualityInput): ScoreBreakdown {
  const fields: Record<string, number> = {};
  let total = 0;

  for (const { field, check, points } of FIELD_WEIGHTS) {
    const earned = check(entity) ? points : 0;
    fields[field] = earned;
    total += earned;
  }

  // Cap at 100
  total = Math.min(100, total);

  // Determine tier
  let tier: string;
  if (total >= 80) tier = 'T4';
  else if (total >= 60) tier = 'T3';
  else if (total >= 40) tier = 'T2';
  else tier = 'T1';

  return { total, tier, fields };
}

/* ═══════════════════════════════════════════
   5. BRAND NAME — Extract trading/commercial name from entity_types
   ═══════════════════════════════════════════ */

const BRAND_NOISE = [
  /^trading\s+as\s*/i,
  /^t\/a\s*/i,
  /^dba\s*/i,
  /^d\.b\.a\.\s*/i,
  /^formerly\s*/i,
  /^also\s+known\s+as\s*/i,
  /^aka\s*/i,
];

/**
 * Extract a brand/trading name from entity_types array.
 * Registries often store "Trading As: BrandName" or DBA names here.
 * Returns null if no meaningful brand name found.
 */
function extractBrandName(entityTypes: string[], canonicalName: string): string | null {
  if (!entityTypes || entityTypes.length === 0) return null;

  for (const et of entityTypes) {
    let candidate = et.trim();
    if (!candidate || candidate.length < 2) continue;

    // Strip "Trading as:", "t/a", "DBA" prefixes
    for (const re of BRAND_NOISE) {
      candidate = candidate.replace(re, '').trim();
    }

    // Skip if it matches the canonical name (no new info)
    if (candidate.toLowerCase() === canonicalName.toLowerCase()) continue;

    // Skip if it looks like a license type rather than a name
    if (/^(VASP|CASP|EMI|PI|PSP|MSB|MTO|DAX|DABA|Class\s)/i.test(candidate)) continue;

    if (candidate.length >= 2 && candidate.length <= 120) {
      return candidate;
    }
  }

  return null;
}

/* ═══════════════════════════════════════════
   MAIN: Process a single entity
   ═══════════════════════════════════════════ */

export function processEntity(entity: QualityInput): QualityResult {
  const rules: string[] = [];
  const cleanupApplied: string[] = [];

  // 1. Cleanup
  const canonical = cleanName(entity.name);
  if (canonical !== entity.name.trim()) {
    cleanupApplied.push('name_normalized');
    rules.push('cleanup:name_normalized');
  }

  // 2. Garbage detection
  const { isGarbage, reason: garbageReason } = detectGarbage(entity);
  if (isGarbage) {
    rules.push(`garbage:${garbageReason}`);
  }

  // 3. Classification
  const cryptoStatus = classifyCryptoStatus(entity);
  if (cryptoStatus !== (entity.crypto_status ?? 'unknown')) {
    rules.push(`classify:${entity.crypto_status ?? 'unknown'}->${cryptoStatus}`);
  }

  // 4. Brand name extraction from entity_types
  const brandName = extractBrandName(entity.entity_types, canonical);
  if (brandName) {
    rules.push('brand:from_entity_types');
  }

  // 5. Validate website — flag if it's a registry URL
  if (entity.website && isRegistryWebsite(entity.website)) {
    rules.push('warn:website_is_registry_url');
  }

  // 6. Scoring
  const score = calculateScore(entity);
  rules.push(`score:${score.total}(${score.tier})`);

  return {
    id: entity.id,
    canonical_name: canonical,
    brand_name: brandName,
    is_garbage: isGarbage,
    garbage_reason: garbageReason,
    quality_score: score.total,
    quality_flags: {
      rules,
      garbage_reason: garbageReason,
      tier: score.tier,
      cleanup_applied: cleanupApplied,
    },
    crypto_status: cryptoStatus,
  };
}
