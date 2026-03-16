/**
 * Enrichment Worker — scrapes entity websites via Firecrawl to extract
 * structured metadata (description, LinkedIn, etc.) and writes it back
 * to the Supabase entities table.
 *
 * Usage:
 *   npx tsx workers/enrichment/run.ts                    # Default: 50 entities
 *   npx tsx workers/enrichment/run.ts --country ZA       # Single country
 *   npx tsx workers/enrichment/run.ts --limit 100        # Custom batch size
 *   npx tsx workers/enrichment/run.ts --country ZA --limit 20
 *   DRY_RUN=true npx tsx workers/enrichment/run.ts       # Validate without writing
 *
 * Env vars (loaded via shared/config.ts):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FIRECRAWL_API_KEY
 *   Optional: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, DRY_RUN, DEBUG
 */

import { promises as dns } from 'node:dns';
import Firecrawl from '@mendable/firecrawl-js';
import type { Document as FirecrawlDocument, DocumentMetadata } from '@mendable/firecrawl-js';
import { config } from '../../shared/config.js';
import { getSupabase } from '../../shared/supabase.js';
import { logger, sendTelegramAlert } from '../../shared/logger.js';
import { SYSTEM_LIMITS, enforceBatchLimit, acquireLock, releaseLock, setRuntimeTimeout, withRetry } from '../../shared/guards.js';

const SCOPE = 'enrichment';
const DEFAULT_LIMIT = 5_000;
const RATE_LIMIT_MS = 1_500; // 1.5s between Firecrawl calls

/* ── Types ── */

interface EntityToEnrich {
  id: string;
  name: string;
  country_code: string;
  website: string;
  description: string | null;
  linkedin_url: string | null;
}

interface EnrichmentResult {
  entityId: string;
  entityName: string;
  description: string | null;
  descriptionOriginal: string | null;
  descriptionLanguage: string | null;
  siteLanguages: string[];
  targetRegions: string[];
  targetAudience: string[];
  fiatOnRamp: boolean | null;
  appPlatforms: string[];
  tradingPairs: number | null;
  foundedYear: number | null;
  yearsOnMarket: number | null;
  businessSummary: string | null;
  linkedinUrl: string | null;
  twitterUrl: string | null;
  brandName: string | null;
  logoUrl: string | null;
  contactEmail: string | null;
  keywords: string[];
  success: boolean;
  error?: string;
}

interface RunStats {
  total: number;
  enriched: number;
  failed: number;
  skipped: number;
  dnsDead: number;
  descriptionsAdded: number;
  linkedinsAdded: number;
  durationMs: number;
}

/* ── CLI args ── */

function parseArgs(): { country: string | null; limit: number; cryptoOnly: boolean } {
  const args = process.argv.slice(2);
  let country: string | null = null;
  let limit = DEFAULT_LIMIT;
  const cryptoOnly = args.includes('--crypto-only');

  const countryIdx = args.indexOf('--country');
  if (countryIdx !== -1 && args[countryIdx + 1]) {
    country = args[countryIdx + 1].toUpperCase();
  }

  const limitIdx = args.indexOf('--limit');
  if (limitIdx !== -1 && args[limitIdx + 1]) {
    limit = parseInt(args[limitIdx + 1], 10);
    if (isNaN(limit) || limit <= 0) limit = DEFAULT_LIMIT;
  }

  return { country, limit, cryptoOnly };
}

/* ── Firecrawl scraping ── */

function initFirecrawl(): Firecrawl {
  const apiKey = config.firecrawl.apiKey;
  if (!apiKey) {
    throw new Error('FIRECRAWL_API_KEY is required. Set it in .env.local');
  }
  return new Firecrawl({ apiKey });
}

/** Normalize URL: ensure https://, strip trailing slash, fix common issues */
function normalizeUrl(url: string): string {
  let u = url.trim();
  // Handle URLs with pipe-separated alternatives (e.g. "site1.com | site2.com")
  if (u.includes(' | ') || u.includes('|')) {
    u = u.split(/\s*\|\s*/)[0].trim();
  }
  // Fix double-protocol (e.g. "https://https.//site.com")
  u = u.replace(/^https?:\/\/https?\.\/?\/*/i, 'https://');
  // Ensure protocol
  if (!u.startsWith('http://') && !u.startsWith('https://')) {
    u = 'https://' + u;
  }
  return u.replace(/\/+$/, '');
}

/** Extract LinkedIn URL from page content or metadata */
function extractLinkedIn(markdown: string, metadata: Record<string, unknown>): string | null {
  const linkedinRe = /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[a-zA-Z0-9_-]+/i;

  // Priority 1: metadata (og:see_also, social links, JSON-LD)
  const metaStr = JSON.stringify(metadata).toLowerCase();
  const metaMatch = metaStr.match(linkedinRe);
  if (metaMatch) return normalizeLinkedIn(metaMatch[0]);

  // Priority 2: markdown content
  const contentMatch = markdown.match(linkedinRe);
  if (contentMatch) return normalizeLinkedIn(contentMatch[0]);

  // Priority 3: look for linkedin.com/company/ specifically (prefer company pages over personal)
  const companyRe = /https?:\/\/(?:www\.)?linkedin\.com\/company\/[a-zA-Z0-9_-]+/i;
  const companyMatch = (metaStr + markdown).match(companyRe);
  if (companyMatch) return normalizeLinkedIn(companyMatch[0]);

  return null;
}

/** Normalize LinkedIn URLs: strip trailing slashes, tracking params, ensure https */
function normalizeLinkedIn(url: string): string {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    u.protocol = 'https:';
    u.search = '';
    u.hash = '';
    return u.toString().replace(/\/+$/, '');
  } catch {
    return url;
  }
}

/** Extract Twitter/X URL from page content or metadata */
function extractTwitter(markdown: string, metadata: Record<string, unknown>): string | null {
  const twitterRe = /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[a-zA-Z0-9_]+/i;
  const skipHandles = new Set(['share', 'intent', 'home', 'search', 'explore', 'settings', 'login', 'signup', 'i', 'hashtag']);

  function isValidHandle(url: string): boolean {
    try {
      const handle = new URL(url).pathname.split('/')[1]?.toLowerCase();
      return !!handle && !skipHandles.has(handle) && handle.length >= 2;
    } catch { return false; }
  }

  // Priority 1: twitter:site or twitter:creator meta tags
  const twitterSite = metadata?.['twitter:site'] ?? metadata?.twitterSite;
  if (twitterSite && typeof twitterSite === 'string') {
    const handle = twitterSite.replace(/^@/, '');
    if (handle.length >= 2) return `https://x.com/${handle}`;
  }

  // Priority 2: metadata (og:see_also, social links)
  const metaStr = JSON.stringify(metadata).toLowerCase();
  const metaMatch = metaStr.match(twitterRe);
  if (metaMatch && isValidHandle(metaMatch[0])) return normalizeTwitter(metaMatch[0]);

  // Priority 3: markdown content
  const contentMatch = markdown.match(twitterRe);
  if (contentMatch && isValidHandle(contentMatch[0])) return normalizeTwitter(contentMatch[0]);

  return null;
}

function normalizeTwitter(url: string): string {
  try {
    const u = new URL(url);
    const handle = u.pathname.split('/')[1];
    return `https://x.com/${handle}`;
  } catch {
    return url;
  }
}

/** Error page indicators — don't extract brand from these */
const ERROR_PAGE_INDICATORS = [
  /invalid ssl/i, /certificate/i, /403|404|500|502|503/,
  /not found/i, /forbidden/i, /error/i, /cloudflare/i,
  /parked/i, /expired/i, /maintenance/i,
];

function isErrorPage(metadata: Record<string, unknown>): boolean {
  const statusCode = metadata?.statusCode;
  if (typeof statusCode === 'number' && statusCode >= 400) return true;
  const title = String(metadata?.title ?? '');
  return ERROR_PAGE_INDICATORS.some(p => p.test(title));
}

/** Clean brand name: strip trailing separators, common noise */
function cleanBrand(raw: string): string | null {
  let b = raw
    .replace(/\s*[|·–—:]\s*$/, '')         // trailing separator
    .replace(/\s*[|·–—:]\s*\d{3,}.*$/, '') // separator + error codes
    .replace(/^\s*(Welcome\s+to|About)\s+/i, '')
    .trim();
  // If brand has a pipe/dash separator, take the shorter meaningful part
  const parts = b.split(/\s*[|·]\s*/);
  if (parts.length > 1) {
    const best = parts.find(p => p.trim().length >= 2 && p.trim().length <= 40) ?? parts[0];
    b = best.trim();
  }
  if (b.length < 2 || b.length > 80) return null;
  if (/^(home|page|index|untitled|error|not found|403|404|500)/i.test(b)) return null;
  if (/invalid ssl|certificate|cloudflare|forbidden|parked/i.test(b)) return null;
  return b;
}

/** Extract brand/commercial name from website metadata */
function extractBrandName(metadata: Record<string, unknown>): string | null {
  if (isErrorPage(metadata)) return null;

  // Priority 1: og:site_name (most reliable brand signal)
  const siteName = metadata?.['og:site_name'] ?? metadata?.ogSiteName;
  if (siteName && typeof siteName === 'string') {
    const brand = cleanBrand(siteName);
    if (brand) return brand;
  }

  // Priority 2: application-name
  const appName = metadata?.['application-name'] ?? metadata?.applicationName;
  if (appName && typeof appName === 'string') {
    const brand = cleanBrand(appName);
    if (brand) return brand;
  }

  // Priority 3: cleaned <title> tag
  const title = metadata?.title ?? metadata?.ogTitle;
  if (title && typeof title === 'string') {
    const cleaned = title
      .replace(/\s*[-–—|·:]\s*(Home|Homepage|Official|Website|Main|Welcome|About|Login|Sign\s*[Uu]p|Dashboard|Portal|Register).*$/i, '')
      .replace(/\s*[-–—|·:]\s*(Crypto|Exchange|Platform|Trading|Buy|Sell).*$/i, '')
      .replace(/\s*[-–—|·:]\s*$/g, '')
      .replace(/^\s*(Welcome\s+to|About|Startseite|Accueil|Inicio|Главная|Strona\s+główna|Anasayfa)\s+/i, '')
      .replace(/\s*[-–—|·:]\s*(Die\s+\w+genossenschaft|Your\s+\w+\s+Partner).*$/i, '')
      .trim();
    return cleanBrand(cleaned);
  }

  return null;
}

/** Junk description patterns — maintenance pages, generic boilerplate, error pages */
const JUNK_PATTERNS = [
  // Error pages
  /403 forbidden/i, /404 not found/i, /access denied/i, /page not found/i,
  /502 bad gateway/i, /503 service/i, /500 internal/i,
  /invalid ssl certificate/i, /ssl.*certificate/i, /ERR_SSL/i,
  /this site can't be reached/i, /connection.*timed?\s*out/i,
  /dns.*not.*resolv/i, /err_name_not_resolved/i,
  // Maintenance/placeholder
  /scheduled maintenance/i, /under construction/i, /coming soon/i,
  /check back in a minute/i, /site under maintenance/i,
  /website.*temporarily unavailable/i, /we're currently performing/i,
  /service unavailable/i,
  // Bot protection
  /cloudflare/i, /just a moment/i, /challenge-platform/i,
  /attention required/i, /are you a human/i, /verify you are human/i,
  /captcha/i, /please wait while/i, /enable javascript/i,
  /please enable cookies/i,
  // Parking/expired
  /domain.*(?:for sale|expired|parked)/i, /buy this domain/i,
  /this domain is registered/i,
  // Navigation/UI fragments (not real descriptions)
  /^skip to (?:content|main|nav)/i, /^menu$/i, /^toggle navigation$/i,
  /loading\.\.\./i,
  // URL-as-description (badges, image refs)
  /^https?:\/\//i,
  // Cookie banners
  /^(?:we use cookies|this website uses cookies|cookie policy|accept all cookies)/i,
];

/** Check if a description looks like junk/boilerplate */
function isJunkDescription(text: string): boolean {
  return JUNK_PATTERNS.some((p) => p.test(text));
}

/** Build a clean description from Firecrawl result */
function extractDescription(markdown: string, metadata: Record<string, unknown>): string | null {
  // Priority 1: OG description / meta description (most reliable)
  const ogDesc = metadata?.ogDescription ?? metadata?.description ?? metadata?.['og:description'];
  if (ogDesc && typeof ogDesc === 'string') {
    const cleaned = cleanDescription(ogDesc.trim());
    if (cleaned.length > 20 && !isJunkDescription(cleaned) && !looksLikeUrl(cleaned)) return cleaned;
  }

  // Priority 2: twitter:description (often a good fallback)
  const twDesc = metadata?.['twitter:description'] ?? metadata?.twitterDescription;
  if (twDesc && typeof twDesc === 'string') {
    const cleaned = cleanDescription(twDesc.trim());
    if (cleaned.length > 20 && !isJunkDescription(cleaned) && !looksLikeUrl(cleaned)) return cleaned;
  }

  // Priority 3: First meaningful paragraph from markdown
  const paragraphs = markdown.split(/\n{2,}/);
  for (const p of paragraphs) {
    const clean = p
      .replace(/[#*_\[\]()!]/g, '')
      .replace(/https?:\/\/\S+/g, '')  // strip inline URLs
      .replace(/\s+/g, ' ')
      .trim();
    if (
      clean.length >= 40 &&
      !clean.includes('|') &&         // table rows
      !/^\s*(cookie|accept|skip|menu|toggle|sign\s*in|log\s*in|register)/i.test(clean) &&
      !isJunkDescription(clean) &&
      !looksLikeUrl(clean)
    ) {
      return cleanDescription(clean);
    }
  }

  return null;
}

/**
 * Heuristic language tagging (no external API):
 * - Prefer explicit metadata language/locale when present
 * - Add script-based hints from content
 */
function detectSiteLanguages(markdown: string, metadata: Record<string, unknown>, description: string | null): string[] {
  const langs = new Set<string>();

  const normalizeLang = (v: string): string | null => {
    const m = v.toLowerCase().match(/[a-z]{2,3}/);
    if (!m) return null;
    const code = m[0];
    if (code === 'eng') return 'EN';
    if (code === 'fra') return 'FR';
    if (code === 'deu') return 'DE';
    if (code === 'spa') return 'ES';
    if (code === 'ita') return 'IT';
    if (code === 'por') return 'PT';
    if (code === 'nld') return 'NL';
    if (code === 'rus') return 'RU';
    if (code === 'ukr') return 'UK';
    if (code === 'tur') return 'TR';
    if (code === 'zho') return 'ZH';
    if (code === 'jpn') return 'JA';
    if (code === 'kor') return 'KO';
    return code.toUpperCase();
  };

  const addMetaLang = (raw: unknown) => {
    if (!raw || typeof raw !== 'string') return;
    const normalized = normalizeLang(raw);
    if (normalized) langs.add(normalized);
  };

  addMetaLang(metadata?.language);
  addMetaLang(metadata?.lang);
  addMetaLang(metadata?.locale);
  addMetaLang(metadata?.['og:locale']);
  addMetaLang(metadata?.contentLanguage);

  const content = `${description ?? ''}\n${markdown}`.slice(0, 4000);
  if (/[а-яА-ЯёЁіІїЇєЄ]/.test(content)) langs.add('RU');
  if (/[\u4E00-\u9FFF]/.test(content)) langs.add('ZH');
  if (/[\u3040-\u30FF]/.test(content)) langs.add('JA');
  if (/[\uAC00-\uD7AF]/.test(content)) langs.add('KO');
  if (/[çğıİöşüÇĞİÖŞÜ]/.test(content)) langs.add('TR');
  if (/[àâçéèêëîïôùûüÿœæ]/i.test(content)) langs.add('FR');
  if (/[áéíóúñ¿¡]/i.test(content)) langs.add('ES');
  if (/[ãõáâàçéêíóôú]/i.test(content)) langs.add('PT');
  if (/[àèéìíîòóù]/i.test(content)) langs.add('IT');

  // English fallback when no explicit language was detected.
  if (langs.size === 0) langs.add('EN');

  return Array.from(langs).slice(0, 4);
}

function isLikelyEnglish(text: string): boolean {
  const t = text.toLowerCase();
  // Strong non-Latin scripts => not English.
  if (/[а-яА-ЯёЁіІїЇєЄ\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/.test(t)) return false;
  // Lightweight stopword check.
  const hits = [' the ', ' and ', ' for ', ' with ', ' from ', ' company ', ' services ', ' platform ']
    .filter((w) => t.includes(w)).length;
  return hits >= 2 || /^[\x00-\x7F\s.,:;!?'"()\-/%]+$/.test(text);
}

function looksLikeUrl(text: string): boolean {
  return /^https?:\/\//.test(text.trim());
}

/** Sanitize description text */
function cleanDescription(text: string): string {
  return text
    .replace(/\s+/g, ' ')          // Collapse whitespace
    .replace(/^\s*[-–—]\s*/, '')    // Strip leading dashes
    .trim()
    .slice(0, 500);                 // Cap at 500 chars
}

/** Build concise English summary from long text */
function summarizeEnglishText(text: string): string {
  const cleaned = cleanDescription(text);
  if (!cleaned) return '';
  const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean);
  const picked: string[] = [];
  let len = 0;
  for (const s of sentences) {
    if (picked.length >= 2) break;
    if (len + s.length > 360) break;
    picked.push(s);
    len += s.length + 1;
  }
  if (picked.length > 0) return picked.join(' ').slice(0, 360);
  return cleaned.slice(0, 360);
}

/** Translate arbitrary text to English using public Google endpoint */
async function translateToEnglish(text: string): Promise<string | null> {
  const input = cleanDescription(text);
  if (!input || input.length < 8) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(input.slice(0, 1200))}`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const json = (await res.json()) as unknown;
    if (!Array.isArray(json) || !Array.isArray(json[0])) return null;
    const chunks = (json[0] as unknown[])
      .filter((r): r is unknown[] => Array.isArray(r) && typeof r[0] === 'string')
      .map((r) => String(r[0]));
    const translated = chunks.join(' ').trim();
    return translated ? cleanDescription(translated) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Always return an English summary (translate first when needed) */
async function toEnglishSummary(text: string): Promise<string | null> {
  const cleaned = cleanDescription(text);
  if (!cleaned) return null;
  if (isLikelyEnglish(cleaned)) {
    return summarizeEnglishText(cleaned);
  }
  const translated = await translateToEnglish(cleaned);
  if (translated) return summarizeEnglishText(translated);
  // Fallback if translation API fails: keep concise source text rather than empty.
  return summarizeEnglishText(cleaned);
}

/** Extract logo/OG image URL */
function extractLogo(metadata: Record<string, unknown>, baseUrl: string): string | null {
  if (isErrorPage(metadata)) return null;
  const ogImage = metadata?.ogImage ?? metadata?.['og:image'];
  let url: string | null = null;
  if (typeof ogImage === 'string') url = ogImage;
  else if (ogImage && typeof ogImage === 'object' && 'url' in (ogImage as Record<string, unknown>)) {
    url = (ogImage as { url: string }).url;
  }
  if (url && typeof url === 'string' && url.startsWith('http') && !url.includes('localhost')) return url;
  const icon = metadata?.favicon;
  if (icon && typeof icon === 'string') {
    if (icon.startsWith('http')) return icon;
    try { return new URL(icon, baseUrl).toString(); } catch {}
  }
  return null;
}

/** Extract contact email from metadata/content */
function extractEmail(markdown: string, metadata: Record<string, unknown>): string | null {
  const re = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const skip = /example\.com|sentry\.|noreply|no-reply|unsubscribe|@\d/i;
  const metaStr = JSON.stringify(metadata);
  const m1 = metaStr.match(re);
  if (m1 && !skip.test(m1[0])) return m1[0].toLowerCase();
  const lines = markdown.split('\n');
  for (const line of lines) {
    if (/contact|email|mailto|support|info/i.test(line)) {
      const m = line.match(re);
      if (m && !skip.test(m[0])) return m[0].toLowerCase();
    }
  }
  return null;
}

/** Extract keywords/services from meta tags */
function extractKeywords(metadata: Record<string, unknown>): string[] {
  const kw = metadata?.keywords ?? metadata?.['keywords'];
  if (kw && typeof kw === 'string') {
    return kw.split(',').map(s => s.trim()).filter(s => s.length > 1 && s.length < 60).slice(0, 15);
  }
  return [];
}

function inferTargetAudience(text: string): string[] {
  const t = text.toLowerCase();
  const consumerHits = ['retail', 'personal', 'individual', 'beginner', 'invest from', 'app store', 'google play']
    .filter((k) => t.includes(k)).length;
  const businessHits = ['institutional', 'enterprise', 'api', 'merchant', 'otc desk', 'b2b', 'prime brokerage']
    .filter((k) => t.includes(k)).length;
  const out: string[] = [];
  if (consumerHits > 0) out.push('consumer');
  if (businessHits > 0) out.push('business');
  if (out.length === 0) out.push('unknown');
  return out;
}

function inferTargetRegions(text: string, siteLanguages: string[]): string[] {
  const t = text.toLowerCase();
  const regions: string[] = [];
  if (/global|worldwide|international/.test(t)) regions.push('global');
  if (/united states|usa|us users/.test(t)) regions.push('US');
  if (/europe|eu|eea/.test(t)) regions.push('EU');
  if (/united kingdom|uk/.test(t)) regions.push('UK');
  if (/singapore|indonesia|malaysia|thailand|philippines|asia/.test(t)) regions.push('APAC');
  if (/uae|middle east|mena/.test(t)) regions.push('MENA');
  if (regions.length === 0 && siteLanguages.length === 1) {
    regions.push(siteLanguages[0]);
  }
  return Array.from(new Set(regions)).slice(0, 4);
}

function inferFiatOnRamp(text: string): boolean | null {
  const t = text.toLowerCase();
  const positive = ['fiat', 'bank transfer', 'bank card', 'credit card', 'debit card', 'visa', 'mastercard', 'deposit idr', 'deposit usd']
    .some((k) => t.includes(k));
  const negative = ['crypto only', 'only crypto deposits', 'no fiat']
    .some((k) => t.includes(k));
  if (positive && !negative) return true;
  if (negative && !positive) return false;
  return null;
}

function inferAppPlatforms(text: string): string[] {
  const t = text.toLowerCase();
  const platforms: string[] = ['web'];
  if (t.includes('app store') || t.includes('google play') || t.includes('android') || t.includes('ios')) {
    platforms.push('mobile');
  }
  if (t.includes('windows') || t.includes('macos') || t.includes('desktop app')) {
    platforms.push('desktop');
  }
  return Array.from(new Set(platforms));
}

function inferTradingPairs(text: string): number | null {
  const t = text.toLowerCase();
  const matches = [...t.matchAll(/(\d{2,5})\+?\s*(trading pairs|pairs|markets)/g)];
  const values = matches.map((m) => Number.parseInt(m[1], 10)).filter((n) => Number.isFinite(n) && n > 1);
  if (values.length === 0) return null;
  return Math.max(...values);
}

function inferFoundedYear(text: string): number | null {
  const now = new Date().getFullYear();
  const matches = [...text.matchAll(/\b(20[0-2]\d|19[8-9]\d)\b/g)].map((m) => Number.parseInt(m[1], 10));
  const plausible = matches.filter((y) => y >= 2008 && y <= now);
  if (plausible.length === 0) return null;
  return Math.min(...plausible);
}

function buildBusinessSummary(description: string | null, profile: {
  targetRegions: string[];
  targetAudience: string[];
  fiatOnRamp: boolean | null;
  appPlatforms: string[];
  tradingPairs: number | null;
  yearsOnMarket: number | null;
}): string | null {
  if (!description) return null;
  const p1 = description;
  const bits: string[] = [];
  if (profile.targetRegions.length > 0) bits.push(`Target regions: ${profile.targetRegions.join(', ')}`);
  if (profile.targetAudience.length > 0) bits.push(`Audience: ${profile.targetAudience.join(', ')}`);
  if (profile.fiatOnRamp !== null) bits.push(`Fiat on-ramp: ${profile.fiatOnRamp ? 'yes' : 'no'}`);
  if (profile.appPlatforms.length > 0) bits.push(`Platforms: ${profile.appPlatforms.join(', ')}`);
  if (profile.tradingPairs) bits.push(`Trading pairs: ~${profile.tradingPairs}`);
  if (profile.yearsOnMarket !== null) bits.push(`Time on market: ~${profile.yearsOnMarket} years`);
  if (bits.length === 0) return p1;
  return `${p1}\n\n${bits.join('. ')}.`;
}

/** Quick DNS check — returns false if hostname doesn't resolve (saves Firecrawl credits) */
async function isDomainAlive(hostname: string): Promise<boolean> {
  try {
    await dns.resolve4(hostname);
    return true;
  } catch {
    return false;
  }
}

/** Scrape a single entity website via Firecrawl v2 */
async function scrapeEntity(
  firecrawl: Firecrawl,
  entity: EntityToEnrich,
): Promise<EnrichmentResult> {
  const url = normalizeUrl(entity.website);

  try {
    // Quick DNS pre-check to avoid wasting Firecrawl API credits on dead domains
    const hostname = new URL(url).hostname;
    const alive = await isDomainAlive(hostname);
    if (!alive) {
      return {
        entityId: entity.id,
        entityName: entity.name,
        description: null,
        descriptionOriginal: null,
        descriptionLanguage: null,
        siteLanguages: [],
        targetRegions: [],
        targetAudience: ['unknown'],
        fiatOnRamp: null,
        appPlatforms: [],
        tradingPairs: null,
        foundedYear: null,
        yearsOnMarket: null,
        businessSummary: null,
        linkedinUrl: null,
        twitterUrl: null,
        brandName: null,
        logoUrl: null,
        contactEmail: null,
        keywords: [],
        success: false,
        error: `DNS dead: ${hostname}`,
      };
    }

    // Firecrawl v2: scrape() returns Document directly, throws on failure
    const doc: FirecrawlDocument = await firecrawl.scrape(url, {
      formats: ['markdown'],
      onlyMainContent: true,
      timeout: 30_000,
    });

    const markdown = doc.markdown ?? '';
    const metadata = (doc.metadata ?? {}) as DocumentMetadata & Record<string, unknown>;

    const extractedDescription = extractDescription(markdown, metadata);
    const siteLanguages = detectSiteLanguages(markdown, metadata, extractedDescription);
    const descriptionLanguage = siteLanguages[0] ?? null;
    const englishDescription = extractedDescription ? await toEnglishSummary(extractedDescription) : null;
    const descriptionOriginal = extractedDescription && !isLikelyEnglish(extractedDescription) ? extractedDescription : null;
    const intelligenceText = `${markdown}\n${JSON.stringify(metadata)}`.slice(0, 12000);
    const targetAudience = inferTargetAudience(intelligenceText);
    const targetRegions = inferTargetRegions(intelligenceText, siteLanguages);
    const fiatOnRamp = inferFiatOnRamp(intelligenceText);
    const appPlatforms = inferAppPlatforms(intelligenceText);
    const tradingPairs = inferTradingPairs(intelligenceText);
    const foundedYear = inferFoundedYear(intelligenceText);
    const yearsOnMarket = foundedYear ? Math.max(0, new Date().getFullYear() - foundedYear) : null;
    const businessSummary = buildBusinessSummary(englishDescription, {
      targetRegions,
      targetAudience,
      fiatOnRamp,
      appPlatforms,
      tradingPairs,
      yearsOnMarket,
    });
    const linkedinUrl = entity.linkedin_url?.trim() ? null : extractLinkedIn(markdown, metadata);
    const twitterUrl = extractTwitter(markdown, metadata);
    const brandName = extractBrandName(metadata);
    const logoUrl = extractLogo(metadata, url);
    const contactEmail = extractEmail(markdown, metadata);
    const keywords = extractKeywords(metadata);

    return {
      entityId: entity.id,
      entityName: entity.name,
      description: businessSummary ?? englishDescription,
      descriptionOriginal,
      descriptionLanguage,
      siteLanguages,
      targetRegions,
      targetAudience,
      fiatOnRamp,
      appPlatforms,
      tradingPairs,
      foundedYear,
      yearsOnMarket,
      businessSummary,
      linkedinUrl,
      twitterUrl,
      brandName,
      logoUrl,
      contactEmail,
      keywords,
      success: true,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      entityId: entity.id,
      entityName: entity.name,
      description: null,
      descriptionOriginal: null,
      descriptionLanguage: null,
      siteLanguages: [],
      targetRegions: [],
      targetAudience: ['unknown'],
      fiatOnRamp: null,
      appPlatforms: [],
      tradingPairs: null,
      foundedYear: null,
      yearsOnMarket: null,
      businessSummary: null,
      linkedinUrl: null,
      twitterUrl: null,
      brandName: null,
      logoUrl: null,
      contactEmail: null,
      keywords: [],
      success: false,
      error: `Scrape failed for ${url}: ${msg}`,
    };
  }
}

/* ── Schema detection ── */

interface SchemaInfo {
  hasDescription: boolean;
  hasLinkedinUrl: boolean;
  hasRegistryUrl: boolean;
  hasEnrichedAt: boolean;
  hasTwitterUrl: boolean;
  hasBrandName: boolean;
}

/** Detect which enrichment columns exist in the entities table */
async function detectSchema(): Promise<SchemaInfo> {
  const sb = getSupabase();
  const schema: SchemaInfo = {
    hasDescription: false,
    hasLinkedinUrl: false,
    hasRegistryUrl: false,
    hasEnrichedAt: false,
    hasTwitterUrl: false,
    hasBrandName: false,
  };

  const check = async (col: string): Promise<boolean> => {
    const { error } = await sb.from('entities').select(col).limit(1);
    if (error && error.message.includes('does not exist')) return false;
    return true;
  };

  [schema.hasDescription, schema.hasLinkedinUrl, schema.hasRegistryUrl, schema.hasEnrichedAt, schema.hasTwitterUrl, schema.hasBrandName] =
    await Promise.all([
      check('description'),
      check('linkedin_url'),
      check('registry_url'),
      check('enriched_at'),
      check('twitter_url'),
      check('brand_name'),
    ]);

  return schema;
}

/* ── Supabase operations ── */

/** Fetch entities that need enrichment */
async function fetchEntitiesToEnrich(
  country: string | null,
  limit: number,
  schema: SchemaInfo,
  cryptoOnly: boolean,
): Promise<EntityToEnrich[]> {
  const sb = getSupabase();

  // Build SELECT columns dynamically based on available schema
  const selectCols = ['id', 'name', 'country_code', 'website'];
  if (schema.hasDescription) selectCols.push('description');
  if (schema.hasLinkedinUrl) selectCols.push('linkedin_url');
  // Always include raw_data so we can skip already-enriched entities
  selectCols.push('raw_data');

  // Build filter: entities with a real website that need enrichment data
  // Filter out junk website values common in Canadian registry
  let query = sb
    .from('entities')
    .select(selectCols.join(', '))
    // Never spend enrichment budget on records already classified as garbage/hidden.
    .neq('is_garbage', true)
    .neq('is_hidden', true)
    // Enrichment should run after quality classification to avoid scraping noisy fresh rows.
    .not('last_quality_at', 'is', null)
    .not('website', 'is', null)
    .neq('website', '')
    .neq('website', 'Not available')
    .neq('website', 'not available')
    .neq('website', 'N/A')
    .neq('website', 'n/a')
    .neq('website', '-')
    .neq('website', 'none')
    .neq('website', 'None');

  // Only filter on enrichment columns that exist
  if (schema.hasDescription && schema.hasLinkedinUrl) {
    query = query.or('description.is.null,description.eq.,linkedin_url.is.null,linkedin_url.eq.');
  } else if (schema.hasDescription) {
    query = query.or('description.is.null,description.eq.');
  } else if (schema.hasLinkedinUrl) {
    query = query.or('linkedin_url.is.null,linkedin_url.eq.');
  }
  // If neither column exists, we'll just grab entities with websites (all need enrichment)

  // Prioritize: confirmed_crypto first, then crypto_adjacent, then rest.
  // Skip entities with dead DNS to save Firecrawl credits.
  query = query
    .neq('dns_status', 'dead')
    .neq('dns_status', 'no_website')
    .order('crypto_status', { ascending: true })
    .order('quality_score', { ascending: true, nullsFirst: true })
    .limit(limit);

  if (cryptoOnly) {
    query = query.in('crypto_status', ['confirmed_crypto', 'crypto_adjacent']);
  }

  if (country) {
    query = query.eq('country_code', country);
  }

  const { data, error } = await query;

  if (error) throw new Error(`Failed to fetch entities: ${error.message}`);

  // Map results, defaulting missing columns to null
  // Skip entities that already have enrichment data in raw_data (when dedicated columns don't exist)
  return (data ?? [])
    .filter((row: Record<string, unknown>) => {
      // If dedicated columns exist, the .or() filter above already handles this
      if (schema.hasDescription || schema.hasLinkedinUrl) return true;
      // Without dedicated columns, skip if raw_data already has enrichment_description
      const rd = row.raw_data as Record<string, unknown> | null;
      if (rd?.enrichment_description) return false;
      return true;
    })
    .map((row: Record<string, unknown>) => ({
      id: row.id as string,
      name: row.name as string,
      country_code: row.country_code as string,
      website: row.website as string,
      description: (row.description as string | null) ?? null,
      linkedin_url: (row.linkedin_url as string | null) ?? null,
    }));
}

/** Write ONE enrichment result immediately after scraping (incremental) */
async function writeOneEnrichmentResult(
  r: EnrichmentResult,
  schema: SchemaInfo,
): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabase();
  if (config.flags.dryRun) {
    logger.info(SCOPE, `[DRY-RUN] Would update ${r.entityName}`);
    return { ok: true };
  }

  const updates: Record<string, unknown> = {};
  if (r.description && schema.hasDescription) updates.description = r.description;
  if (r.linkedinUrl && schema.hasLinkedinUrl) updates.linkedin_url = r.linkedinUrl;
  if (r.twitterUrl && schema.hasTwitterUrl) updates.twitter_url = r.twitterUrl;
  if (r.brandName && schema.hasBrandName) updates.brand_name = r.brandName;
  if (schema.hasEnrichedAt) updates.enriched_at = new Date().toISOString();

  // New fields go into raw_data alongside any existing data
  const extraData: Record<string, unknown> = {};
  if (r.logoUrl) extraData.logo_url = r.logoUrl;
  if (r.contactEmail) extraData.contact_email = r.contactEmail;
  if (r.keywords.length > 0) extraData.keywords = r.keywords;

  // If dedicated columns exist, do a direct update
  if (Object.keys(updates).length > 0) {
    const { error } = await sb.from('entities').update(updates).eq('id', r.entityId);
    if (error) {
      logger.warn(SCOPE, `Failed to update ${r.entityName}: ${error.message}`);
      return { ok: false, error: `${r.entityName}: ${error.message}` };
    }
  }

  // Stash extra enrichment data in raw_data JSONB
  if (Object.keys(extraData).length > 0 || Object.keys(updates).length === 0) {
    if (r.siteLanguages.length > 0) extraData.site_languages = r.siteLanguages;
    if (r.descriptionLanguage) extraData.site_primary_language = r.descriptionLanguage;
    if (r.descriptionOriginal) extraData.enrichment_description_original = r.descriptionOriginal;
    if (r.targetRegions.length > 0) extraData.target_regions = r.targetRegions;
    if (r.targetAudience.length > 0) extraData.target_audience = r.targetAudience;
    if (r.fiatOnRamp !== null) extraData.fiat_onramp = r.fiatOnRamp;
    if (r.appPlatforms.length > 0) extraData.app_platforms = r.appPlatforms;
    if (r.tradingPairs !== null) extraData.trading_pairs = r.tradingPairs;
    if (r.foundedYear !== null) extraData.founded_year = r.foundedYear;
    if (r.yearsOnMarket !== null) extraData.years_on_market = r.yearsOnMarket;
    if (r.businessSummary) extraData.site_business_summary_en = r.businessSummary;
    // Also stash main fields as fallback if dedicated columns are missing
    if (!schema.hasDescription && r.description) extraData.enrichment_description = r.description;
    if (!schema.hasLinkedinUrl && r.linkedinUrl) extraData.enrichment_linkedin_url = r.linkedinUrl;
    if (!schema.hasTwitterUrl && r.twitterUrl) extraData.enrichment_twitter_url = r.twitterUrl;
    if (!schema.hasBrandName && r.brandName) extraData.enrichment_brand_name = r.brandName;

    if (Object.keys(extraData).length > 0) {
      const { data: existing } = await sb.from('entities').select('raw_data').eq('id', r.entityId).single();
      const rawData = { ...(existing?.raw_data as Record<string, unknown> ?? {}), ...extraData };
      await sb.from('entities').update({ raw_data: rawData }).eq('id', r.entityId);
    }
  }

  return { ok: true };
}

/** Mark an entity as enriched (timestamp only, no data) — prevents re-scraping */
async function markEnriched(entityId: string, schema: SchemaInfo): Promise<void> {
  if (config.flags.dryRun || !schema.hasEnrichedAt) return;
  const sb = getSupabase();
  await sb.from('entities').update({ enriched_at: new Date().toISOString() }).eq('id', entityId);
}

/** Log enrichment run to scrape_runs table */
async function logEnrichmentRun(stats: RunStats, errors: string[]): Promise<void> {
  const sb = getSupabase();

  const status = stats.failed > stats.enriched ? 'error' : stats.failed > 0 ? 'partial' : 'success';

  const { error } = await sb.from('scrape_runs').insert({
    registry_id: 'enrichment-firecrawl',
    status,
    entities_found: stats.total,
    entities_new: stats.descriptionsAdded,
    entities_updated: stats.linkedinsAdded,
    entities_removed: 0,
    duration_ms: stats.durationMs,
    error_message: errors.length > 0 ? errors.slice(0, 5).join('; ') : null,
    warnings: [],
    delta_percent: 0,
    created_at: new Date().toISOString(),
  });

  if (error) {
    // Non-fatal — table might not exist yet
    logger.debug(SCOPE, `Scrape run log skipped: ${error.message}`);
  }
}

/* ── Main ── */

async function main() {
  const startTime = Date.now();
  const { country, limit: rawLimit, cryptoOnly } = parseArgs();

  // Enforce system limits + acquire process lock + set runtime timeout
  const limit = enforceBatchLimit(rawLimit, SYSTEM_LIMITS.ENRICHMENT_MAX_BATCH, SCOPE);
  const lockFile = acquireLock(SCOPE);
  const clearRuntimeTimeout = setRuntimeTimeout(SCOPE);

  logger.info(SCOPE, '=======================================');
  logger.info(SCOPE, '  Firecrawl Enrichment Worker');
  logger.info(SCOPE, '=======================================');
  logger.info(SCOPE, `Config: country=${country ?? 'all'}, limit=${limit}, cryptoOnly=${cryptoOnly}, dryRun=${config.flags.dryRun}`);

  if (!config.firecrawl.enabled) {
    logger.error(SCOPE, 'FIRECRAWL_API_KEY not set. Exiting.');
    process.exit(1);
  }

  // 0. Detect available schema columns
  logger.info(SCOPE, 'Detecting schema...');
  const schema = await detectSchema();
  logger.info(SCOPE, `Schema: description=${schema.hasDescription}, linkedin_url=${schema.hasLinkedinUrl}, twitter_url=${schema.hasTwitterUrl}, brand_name=${schema.hasBrandName}, enriched_at=${schema.hasEnrichedAt}`);

  if (!schema.hasDescription && !schema.hasLinkedinUrl) {
    logger.warn(SCOPE, 'Enrichment columns not found. Results will be stored in raw_data JSONB as fallback.');
    logger.warn(SCOPE, 'Run scripts/003_enrichment_columns.sql in Supabase SQL Editor for dedicated columns.');
  }

  // 1. Fetch entities to enrich
  logger.info(SCOPE, 'Fetching entities to enrich...');
  const entities = await fetchEntitiesToEnrich(country, limit, schema, cryptoOnly);
  logger.info(SCOPE, `Found ${entities.length} entities to enrich`);

  if (entities.length === 0) {
    logger.info(SCOPE, 'No entities need enrichment. Done.');
    return;
  }

  // Show country breakdown
  const countryBreakdown = new Map<string, number>();
  entities.forEach((e) => {
    countryBreakdown.set(e.country_code, (countryBreakdown.get(e.country_code) ?? 0) + 1);
  });
  const breakdown = [...countryBreakdown.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([code, count]) => `${code}:${count}`)
    .join(', ');
  logger.info(SCOPE, `Country breakdown: ${breakdown}`);

  // 2. Initialize Firecrawl
  const firecrawl = initFirecrawl();

  // 3. Process entities with INCREMENTAL writes (write after each scrape)
  const stats: RunStats = {
    total: entities.length,
    enriched: 0,
    failed: 0,
    skipped: 0,
    dnsDead: 0,
    descriptionsAdded: 0,
    linkedinsAdded: 0,
    durationMs: 0,
  };
  let written = 0;
  const errors: string[] = [];

  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i];
    const progress = `[${i + 1}/${entities.length}]`;

    logger.info(SCOPE, `${progress} Scraping ${entity.name} (${entity.country_code}) — ${entity.website}`);

    const result = await scrapeEntity(firecrawl, entity);

    if (result.success) {
      const found: string[] = [];
      if (result.description) found.push('description');
      if (result.linkedinUrl) found.push('linkedin');
      if (result.twitterUrl) found.push('twitter');
      if (result.brandName) found.push('brand');
      if (result.logoUrl) found.push('logo');
      if (result.contactEmail) found.push('email');
      if (result.keywords.length) found.push('keywords');

      if (found.length > 0) {
        logger.info(SCOPE, `${progress} Found: ${found.join(', ')}`);
        stats.enriched++;
        if (result.description) stats.descriptionsAdded++;
        if (result.linkedinUrl) stats.linkedinsAdded++;

        // INCREMENTAL WRITE — save immediately so progress isn't lost on timeout
        const writeResult = await writeOneEnrichmentResult(result, schema);
        if (writeResult.ok) {
          written++;
        } else if (writeResult.error) {
          errors.push(writeResult.error);
        }
      } else {
        // Mark as enriched even if no new data, so we don't re-scrape
        await markEnriched(result.entityId, schema);
        stats.skipped++;
      }
    } else {
      const isDead = result.error?.startsWith('DNS dead:');
      const isCreditsExhausted = result.error?.includes('Insufficient credits');
      if (isDead) {
        logger.debug(SCOPE, `${progress} DNS dead: ${entity.website}`);
        stats.dnsDead++;
      } else if (isCreditsExhausted) {
        logger.error(SCOPE, `${progress} Firecrawl credits exhausted! Stopping batch.`);
        stats.failed++;
        break;
      } else {
        logger.warn(SCOPE, `${progress} Failed: ${result.error}`);
      }
      // Mark failed entities as enriched too (with just the timestamp) so we don't retry dead sites immediately
      await markEnriched(result.entityId, schema);
      stats.failed++;
    }

    // Rate limiting — only wait after actual Firecrawl API calls (skip for DNS-dead)
    const isDnsDead = !result.success && result.error?.startsWith('DNS dead:');
    if (i < entities.length - 1 && !isDnsDead) {
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_MS));
    }
  }

  logger.info(SCOPE, `Written: ${written} entities updated`);

  // 5. Log run
  stats.durationMs = Date.now() - startTime;
  await logEnrichmentRun(stats, errors);

  // 6. Summary
  logger.info(SCOPE, '');
  logger.info(SCOPE, '=======================================');
  logger.info(SCOPE, '  Enrichment Complete');
  logger.info(SCOPE, '=======================================');
  logger.info(SCOPE, `  Total processed:     ${stats.total}`);
  logger.info(SCOPE, `  Successfully scraped: ${stats.enriched}`);
  logger.info(SCOPE, `  No new data:         ${stats.skipped}`);
  logger.info(SCOPE, `  Failed:              ${stats.failed} (${stats.dnsDead} DNS dead)`);
  logger.info(SCOPE, `  Descriptions added:  ${stats.descriptionsAdded}`);
  logger.info(SCOPE, `  LinkedIns added:     ${stats.linkedinsAdded}`);
  logger.info(SCOPE, `  DB writes:           ${written}`);
  logger.info(SCOPE, `  Duration:            ${(stats.durationMs / 1000).toFixed(1)}s`);
  logger.info(SCOPE, '=======================================');

  // 7. Alert on high failure rate
  if (stats.failed > stats.total * 0.5 && stats.total > 5) {
    await sendTelegramAlert(
      SCOPE,
      `High failure rate: ${stats.failed}/${stats.total} (${((stats.failed / stats.total) * 100).toFixed(0)}%)`,
      true,
    );
  }

  // 8. Cleanup
  clearRuntimeTimeout();
  releaseLock(lockFile);
}

main().catch(async (err) => {
  logger.error(SCOPE, `Fatal: ${err.message}`);
  await sendTelegramAlert(SCOPE, `Fatal error: ${err.message}`);
  process.exit(1);
});
