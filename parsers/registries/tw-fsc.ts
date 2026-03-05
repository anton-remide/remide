/**
 * Taiwan FSC — VASP AML Registration
 *
 * Source: Securities and Futures Bureau (SFB) under FSC
 * URL: https://www.sfb.gov.tw/ch/home.jsp?id=1053&parentpath=0,8
 * ~8 active registered VASPs + ~18 non-registered (banned) entities
 * Format: Static HTML (server-side rendered JSP)
 *
 * Taiwan regulates VASPs under the Money Laundering Control Act (amended July 2024).
 * Three categories: Registered, Self-Cancelled, Non-Registered (failed to register).
 *
 * Usage:
 *   npx tsx parsers/registries/tw-fsc.ts --dry-run
 *   npx tsx parsers/registries/tw-fsc.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as cheerio from 'cheerio';
import type { RegistryParser, ParserConfig, ParseResult, ParsedEntity } from '../core/types.js';
import { fetchWithRetry } from '../core/client.js';
import { logger } from '../core/logger.js';

/** Chinese page with all data */
const CHINESE_URL = 'https://www.sfb.gov.tw/ch/home.jsp?id=1053&parentpath=0,8';
/** English page for English names */
const ENGLISH_URL = 'https://www.sfb.gov.tw/en/home.jsp?id=286&parentpath=0,117';

interface RawEntity {
  name: string;
  ubn: string;
}

/** UBN regex for Chinese and English pages */
const UBN_ZH = /(.+?)(?:\(|（)統一編號：?(\d{8})(?:\)|）)/g;
const UBN_EN = /(.+?)(?:\(|（)(?:UBN:\s*|Unified Business Number:\s*)(\d{8})(?:\)|）)/g;

/** Extract entities by splitting flat text into sections */
function parseEntitiesFromHtml(
  html: string,
  lang: 'zh' | 'en',
  registryId: string,
): { registered: RawEntity[]; cancelled: RawEntity[]; nonRegistered: RawEntity[] } {
  const $ = cheerio.load(html);
  const registered: RawEntity[] = [];
  const cancelled: RawEntity[] = [];
  const nonRegistered: RawEntity[] = [];

  // Content is in .page_content or .main-a_01 as flat HTML with <br> separators
  const contentArea = $('.page_content, .main-a_01, #maincontent').first();
  if (!contentArea.length) {
    logger.warn(registryId, `[${lang}] Could not find main content area`);
    return { registered, cancelled, nonRegistered };
  }

  // Get full text and split by section headers
  const fullText = contentArea.text();
  const pattern = lang === 'zh' ? UBN_ZH : UBN_EN;

  // Chinese page: sections start with numbered headers containing keywords
  // 1. "已完成洗錢防制登記" → registered
  // 2. "自行申請廢止" → cancelled
  // 3. "未完成洗錢防制登記" → nonRegistered
  // English page: similar numbered sections with "Registered", "Cancelled", "Non-Registered"

  // Split approach: find all UBN entities, determine section by surrounding text
  let currentSection: 'registered' | 'cancelled' | 'nonRegistered' = 'registered';

  // Split text into lines
  const lines = fullText.split(/\n/).map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    // Detect section changes from header lines
    if (lang === 'zh') {
      if (line.includes('已完成洗錢防制登記')) currentSection = 'registered';
      else if (line.includes('自行申請廢止') || line.includes('自行註銷')) currentSection = 'cancelled';
      else if (line.includes('未完成洗錢防制登記') || line.includes('不得提供虛擬資產服務之原')) currentSection = 'nonRegistered';
    } else {
      const lower = line.toLowerCase();
      if (lower.includes('registered vasp') && !lower.includes('non-register') && !lower.includes('cancel')) currentSection = 'registered';
      else if (lower.includes('cancel') || lower.includes('revok')) currentSection = 'cancelled';
      else if (lower.includes('non-register') || lower.includes('fail')) currentSection = 'nonRegistered';
    }

    // Try to extract entity from this line
    const linePattern = new RegExp(pattern.source);
    const match = line.match(linePattern);
    if (match) {
      const name = match[1].trim().replace(/^\d+[.、)\s]+/, '').replace(/\*+$/, '');
      const ubn = match[2];
      if (name && ubn) {
        switch (currentSection) {
          case 'registered': registered.push({ name, ubn }); break;
          case 'cancelled': cancelled.push({ name, ubn }); break;
          case 'nonRegistered': nonRegistered.push({ name, ubn }); break;
        }
      }
    }
  }

  return { registered, cancelled, nonRegistered };
}

export class TwFscParser implements RegistryParser {
  config: ParserConfig = {
    id: 'tw-fsc',
    name: 'Taiwan SFB VASP Register',
    countryCode: 'TW',
    country: 'Taiwan',
    regulator: 'FSC / SFB (Financial Supervisory Commission)',
    url: CHINESE_URL,
    sourceType: 'html',
    rateLimit: 5_000,
    needsProxy: false,
    needsBrowser: false,
  };

  async parse(): Promise<ParseResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const errors: string[] = [];
    const allEntities: ParsedEntity[] = [];

    // Fetch Chinese page (primary — has all entities)
    logger.info(this.config.id, 'Fetching Chinese VASP register page...');
    const zhHtml = await fetchWithRetry(CHINESE_URL, { registryId: this.config.id, rateLimit: 5_000 });
    const zhParsed = parseEntitiesFromHtml(zhHtml, 'zh', this.config.id);

    logger.info(this.config.id, `Chinese page: ${zhParsed.registered.length} registered, ${zhParsed.cancelled.length} cancelled, ${zhParsed.nonRegistered.length} non-registered`);

    // Fetch English page for English names
    let enMap = new Map<string, string>(); // UBN → English name
    try {
      logger.info(this.config.id, 'Fetching English VASP register page...');
      const enHtml = await fetchWithRetry(ENGLISH_URL, { registryId: this.config.id, rateLimit: 5_000 });
      const enParsed = parseEntitiesFromHtml(enHtml, 'en', this.config.id);

      for (const e of [...enParsed.registered, ...enParsed.cancelled, ...enParsed.nonRegistered]) {
        enMap.set(e.ubn, e.name);
      }
      logger.info(this.config.id, `English page: ${enMap.size} names matched`);
    } catch (err) {
      warnings.push(`Failed to fetch English page: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Map registered entities
    for (const raw of zhParsed.registered) {
      const englishName = enMap.get(raw.ubn);
      allEntities.push({
        name: englishName ?? raw.name,
        countryCode: 'TW',
        country: 'Taiwan',
        licenseNumber: `UBN-${raw.ubn}`,
        licenseType: 'VASP AML Registration',
        status: 'Active',
        regulator: 'FSC / SFB',
        sourceUrl: CHINESE_URL,
      });
    }

    // Map cancelled entities
    for (const raw of zhParsed.cancelled) {
      const englishName = enMap.get(raw.ubn);
      allEntities.push({
        name: englishName ?? raw.name,
        countryCode: 'TW',
        country: 'Taiwan',
        licenseNumber: `UBN-${raw.ubn}`,
        licenseType: 'VASP AML Registration (Cancelled)',
        status: 'Revoked',
        regulator: 'FSC / SFB',
        sourceUrl: CHINESE_URL,
      });
    }

    // Map non-registered (banned) entities
    for (const raw of zhParsed.nonRegistered) {
      const englishName = enMap.get(raw.ubn);
      allEntities.push({
        name: englishName ?? raw.name,
        countryCode: 'TW',
        country: 'Taiwan',
        licenseNumber: `UBN-${raw.ubn}`,
        licenseType: 'Non-Registered VASP (Banned)',
        status: 'Rejected',
        regulator: 'FSC / SFB',
        sourceUrl: CHINESE_URL,
      });
    }

    return {
      registryId: this.config.id,
      countryCode: 'TW',
      entities: allEntities,
      totalFound: allEntities.length,
      durationMs: Date.now() - startTime,
      warnings,
      errors,
      timestamp: new Date().toISOString(),
    };
  }
}

/** CLI entry */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--dry-run')) process.env.DRY_RUN = 'true';

  const parser = new TwFscParser();
  const result = await parser.parse();

  console.log(`\n✅ ${result.entities.length} entities parsed in ${(result.durationMs / 1000).toFixed(1)}s`);
  for (const e of result.entities) {
    console.log(`  [${e.status}] ${e.name} | ${e.licenseType} | ${e.licenseNumber}`);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
