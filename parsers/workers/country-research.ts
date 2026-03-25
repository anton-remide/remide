/**
 * Country Research Worker — AI-powered country intelligence gathering
 *
 * For each jurisdiction in the database, researches:
 *   - Number of crypto/VASP companies operating
 *   - Regulatory framework & primary regulator
 *   - Travel Rule implementation status
 *   - CBDC status
 *   - Stablecoin licensing (regulated vs unregulated)
 *   - Official registry URL for parser building
 *
 * Outputs:
 *   - Parser Registry: creates entries for countries needing parsers
 *   - Knowledge Base: creates tasks for building new parsers
 *   - Jurisdictions: updates missing regulatory data
 *
 * Usage:
 *   npx tsx parsers/workers/country-research.ts
 *   npx tsx parsers/workers/country-research.ts --country CA
 *   npx tsx parsers/workers/country-research.ts --region Europe
 *   npx tsx parsers/workers/country-research.ts --missing-only
 *
 * Requires:
 *   - ANTHROPIC_API_KEY — Claude Sonnet API
 *   - NOTION_TOKEN — Notion integration token (optional, prints to console if missing)
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../core/logger.js';

// ── Config ──────────────────────────────────────────────────────────────

const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const NOTION_VERSION = '2022-06-28';

// Notion database IDs
const NOTION_JURISDICTIONS_DB = '9618ad8b-302f-421f-9d30-de322226c4d1';
const NOTION_PARSER_REGISTRY_DB = '9618ad8b-302f-421f-9d30-de322226c4d1';
const NOTION_KB_DB = 'c973a8be-f1be-462c-bf14-55c47f0c5708';

interface CountryResearch {
  countryCode: string;
  country: string;
  region: string;

  // Regulatory
  regulatoryRegime: 'Comprehensive' | 'Partial' | 'In Progress' | 'None' | 'Banned' | 'Unknown';
  regulator: string;
  vaspDefinition: string;

  // Travel Rule
  travelRule: 'Enforced' | 'In Progress' | 'Not Implemented' | 'Unknown';

  // Entities
  estimatedEntityCount: number;
  registryUrl: string;
  registrySourceType: 'HTML Table' | 'PDF' | 'API/JSON' | 'CSV/Excel' | 'Dynamic JS' | '';

  // Stablecoins & CBDCs
  cbdcStatus: string;
  stablecoinRegulation: string;

  // Parser
  parserDifficulty: 'easy' | 'medium' | 'hard' | 'impossible';
  parserNotes: string;

  // Confidence
  confidence: 'high' | 'medium' | 'low';
  sources: string[];
}

interface NotionJurisdiction {
  id: string;
  country: string;
  countryCode: string;
  region: string;
  regulatoryRegime: string;
  travelRule: string;
  regulator: string;
  sourceUrl: string;
  entityCount: number;
}

interface NotionParserEntry {
  id: string;
  parser: string;
  country: string;
}

// ── Notion helpers ──────────────────────────────────────────────────────

function getNotionToken(): string | null {
  return process.env.NOTION_TOKEN ?? process.env.NOTION_API_KEY ?? null;
}

async function notionApi(path: string, method = 'GET', body?: unknown): Promise<unknown> {
  const token = getNotionToken();
  if (!token) throw new Error('No NOTION_TOKEN');

  const response = await fetch(`https://api.notion.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Notion-Version': NOTION_VERSION,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Notion API ${response.status}: ${text}`);
  }

  return response.json();
}

/** Fetch all jurisdictions from Notion */
async function getJurisdictions(): Promise<NotionJurisdiction[]> {
  const results: NotionJurisdiction[] = [];
  let cursor: string | undefined;

  do {
    const body: Record<string, unknown> = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;

    const resp = (await notionApi(
      `/databases/${NOTION_JURISDICTIONS_DB}/query`,
      'POST',
      body,
    )) as { results: Array<Record<string, unknown>>; has_more: boolean; next_cursor?: string };

    for (const page of resp.results) {
      const props = page.properties as Record<string, unknown>;
      results.push({
        id: page.id as string,
        country: extractTitle(props.Country),
        countryCode: extractText(props['Country Code']),
        region: extractSelect(props.Region),
        regulatoryRegime: extractSelect(props['Regulatory Regime']),
        travelRule: extractSelect(props['Travel Rule']),
        regulator: extractText(props.Regulator),
        sourceUrl: extractUrl(props['Source URL']),
        entityCount: extractNumber(props['Licensed Entity Count']),
      });
    }

    cursor = resp.has_more ? (resp.next_cursor as string) : undefined;
  } while (cursor);

  return results;
}

/** Fetch existing parser entries */
async function getExistingParsers(): Promise<NotionParserEntry[]> {
  const results: NotionParserEntry[] = [];
  let cursor: string | undefined;

  do {
    const body: Record<string, unknown> = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;

    const resp = (await notionApi(
      `/databases/${NOTION_PARSER_REGISTRY_DB}/query`,
      'POST',
      body,
    )) as { results: Array<Record<string, unknown>>; has_more: boolean; next_cursor?: string };

    for (const page of resp.results) {
      const props = page.properties as Record<string, unknown>;
      results.push({
        id: page.id as string,
        parser: extractTitle(props.Parser),
        country: extractText(props.Country),
      });
    }

    cursor = resp.has_more ? (resp.next_cursor as string) : undefined;
  } while (cursor);

  return results;
}

// Notion property extractors
function extractTitle(prop: unknown): string {
  const p = prop as { title?: Array<{ plain_text: string }> };
  return p?.title?.[0]?.plain_text ?? '';
}
function extractText(prop: unknown): string {
  const p = prop as { rich_text?: Array<{ plain_text: string }> };
  return p?.rich_text?.[0]?.plain_text ?? '';
}
function extractSelect(prop: unknown): string {
  const p = prop as { select?: { name: string } | null };
  return p?.select?.name ?? '';
}
function extractUrl(prop: unknown): string {
  const p = prop as { url?: string | null };
  return p?.url ?? '';
}
function extractNumber(prop: unknown): number {
  const p = prop as { number?: number | null };
  return p?.number ?? 0;
}

// ── Claude API ──────────────────────────────────────────────────────────

function getAnthropic(): Anthropic {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('Missing ANTHROPIC_API_KEY');
  return new Anthropic({ apiKey: key });
}

async function researchCountry(
  country: string,
  countryCode: string,
  region: string,
  existingData: {
    regulatoryRegime: string;
    travelRule: string;
    regulator: string;
    sourceUrl: string;
    entityCount: number;
  },
): Promise<CountryResearch> {
  const anthropic = getAnthropic();

  const prompt = `You are a crypto regulatory intelligence researcher. Research the following country's crypto/VASP regulatory landscape.

COUNTRY: ${country} (${countryCode})
REGION: ${region}
EXISTING DATA (may be outdated or incomplete):
  Regulatory Regime: ${existingData.regulatoryRegime || 'Unknown'}
  Travel Rule: ${existingData.travelRule || 'Unknown'}
  Regulator: ${existingData.regulator || 'Unknown'}
  Registry URL: ${existingData.sourceUrl || 'none'}
  Licensed Entities: ${existingData.entityCount || 'unknown'}

Research and return a JSON object with these fields:

{
  "regulatoryRegime": "Comprehensive" | "Partial" | "In Progress" | "None" | "Banned" | "Unknown",
  "regulator": "Name of primary crypto/VASP regulator",
  "vaspDefinition": "Brief description of how VASPs are defined and licensed (1-2 sentences)",
  "travelRule": "Enforced" | "In Progress" | "Not Implemented" | "Unknown",
  "estimatedEntityCount": <number of known licensed/registered crypto companies, 0 if unknown>,
  "registryUrl": "URL of the official public registry where licensed entities are listed, or empty string",
  "registrySourceType": "HTML Table" | "PDF" | "API/JSON" | "CSV/Excel" | "Dynamic JS" | "",
  "cbdcStatus": "Brief status: launched/pilot/research/none/banned (1 sentence)",
  "stablecoinRegulation": "Brief: how stablecoins are regulated, licensed or not (1 sentence)",
  "parserDifficulty": "easy" | "medium" | "hard" | "impossible",
  "parserNotes": "Technical notes on how to parse the registry (data format, pagination, auth, etc). 2-3 sentences.",
  "confidence": "high" | "medium" | "low",
  "sources": ["url1", "url2"]
}

Guidelines:
- "estimatedEntityCount" should be your best estimate of licensed/registered crypto entities in 2024-2025
- "registryUrl" should be the OFFICIAL government/regulator page where licensed entities are publicly listed. Not a news article.
- "registrySourceType" describes the format of the registry data (table on web page, downloadable CSV, API, etc.)
- "parserDifficulty": easy = static HTML/CSV, medium = paginated/JS, hard = requires auth/captcha/Playwright, impossible = no public registry
- If a country has BANNED crypto, set regime to "Banned" and entity count to 0
- If no public registry exists, set registryUrl to "" and parserDifficulty to "impossible"
- Be specific about the regulator name (e.g., "BaFin" not "German financial authority")

Return ONLY the JSON object, no markdown wrapping.`;

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0]?.type === 'text' ? response.content[0].text : '';

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');

    const data = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    return {
      countryCode,
      country,
      region,
      regulatoryRegime: (data.regulatoryRegime as CountryResearch['regulatoryRegime']) || 'Unknown',
      regulator: (data.regulator as string) || '',
      vaspDefinition: (data.vaspDefinition as string) || '',
      travelRule: (data.travelRule as CountryResearch['travelRule']) || 'Unknown',
      estimatedEntityCount: Number(data.estimatedEntityCount) || 0,
      registryUrl: (data.registryUrl as string) || '',
      registrySourceType: (data.registrySourceType as CountryResearch['registrySourceType']) || '',
      cbdcStatus: (data.cbdcStatus as string) || '',
      stablecoinRegulation: (data.stablecoinRegulation as string) || '',
      parserDifficulty: (data.parserDifficulty as CountryResearch['parserDifficulty']) || 'impossible',
      parserNotes: (data.parserNotes as string) || '',
      confidence: (data.confidence as CountryResearch['confidence']) || 'low',
      sources: (data.sources as string[]) || [],
    };
  } catch {
    logger.warn('country-research', `Failed to parse Claude response for ${countryCode}`);
    return {
      countryCode,
      country,
      region,
      regulatoryRegime: 'Unknown',
      regulator: '',
      vaspDefinition: '',
      travelRule: 'Unknown',
      estimatedEntityCount: 0,
      registryUrl: '',
      registrySourceType: '',
      cbdcStatus: '',
      stablecoinRegulation: '',
      parserDifficulty: 'impossible',
      parserNotes: 'Failed to research — retry manually',
      confidence: 'low',
      sources: [],
    };
  }
}

// ── Write to Notion ─────────────────────────────────────────────────────

async function updateJurisdiction(jurId: string, research: CountryResearch): Promise<void> {
  const token = getNotionToken();
  if (!token) return;

  // Only update fields that are currently empty/unknown
  const updates: Record<string, unknown> = {};

  // Always update these from research
  if (research.regulatoryRegime !== 'Unknown') {
    updates['Regulatory Regime'] = { select: { name: research.regulatoryRegime } };
  }
  if (research.travelRule !== 'Unknown') {
    updates['Travel Rule'] = { select: { name: research.travelRule } };
  }
  if (research.regulator) {
    updates['Regulator'] = { rich_text: [{ text: { content: research.regulator } }] };
  }
  if (research.registryUrl) {
    updates['Source URL'] = { url: research.registryUrl };
  }
  if (research.vaspDefinition) {
    updates['VASP Definition'] = { rich_text: [{ text: { content: research.vaspDefinition } }] };
  }
  if (research.estimatedEntityCount > 0) {
    updates['Licensed Entity Count'] = { number: research.estimatedEntityCount };
  }
  updates['Last Updated'] = { date: { start: new Date().toISOString().split('T')[0] } };

  if (Object.keys(updates).length <= 1) return; // Only Last Updated — skip

  await notionApi(`/pages/${jurId}`, 'PATCH', { properties: updates });
  logger.info('country-research', `Updated jurisdiction: ${research.country}`);
}

async function createParserRegistryEntry(research: CountryResearch): Promise<void> {
  const token = getNotionToken();
  if (!token) {
    printParserEntry(research);
    return;
  }

  if (!research.registryUrl || research.parserDifficulty === 'impossible') {
    logger.debug('country-research', `Skipping parser entry for ${research.countryCode} — no registry URL`);
    return;
  }

  const parserId = `${research.countryCode.toLowerCase()}-${research.regulator.split(/[\s(]/)[0]?.toLowerCase() || 'unknown'}`;

  await notionApi('/pages', 'POST', {
    parent: { database_id: NOTION_PARSER_REGISTRY_DB },
    properties: {
      Parser: {
        title: [{ text: { content: parserId } }],
      },
      Country: {
        rich_text: [{ text: { content: `${research.countryCode} — ${research.country}` } }],
      },
      Registry: {
        rich_text: [{ text: { content: research.regulator } }],
      },
      'Source URL': { url: research.registryUrl },
      'Source Type': research.registrySourceType
        ? { select: { name: research.registrySourceType } }
        : undefined,
      Frequency: { select: { name: 'Weekly' } },
      'Entity Count': { number: research.estimatedEntityCount },
      Notes: {
        rich_text: [
          {
            text: {
              content: [
                `Difficulty: ${research.parserDifficulty}`,
                `Confidence: ${research.confidence}`,
                research.parserNotes,
                `CBDC: ${research.cbdcStatus}`,
                `Stablecoins: ${research.stablecoinRegulation}`,
                research.sources.length > 0 ? `Sources: ${research.sources.join(', ')}` : '',
              ]
                .filter(Boolean)
                .join('\n')
                .substring(0, 2000),
            },
          },
        ],
      },
    },
  });

  logger.info('country-research', `Created parser registry: ${parserId}`);
}

async function createKBTask(research: CountryResearch): Promise<void> {
  const token = getNotionToken();
  if (!token) {
    printKBTask(research);
    return;
  }

  if (research.parserDifficulty === 'impossible' || !research.registryUrl) {
    return; // No point creating a task for impossible parsers
  }

  const parserId = `${research.countryCode.toLowerCase()}-${research.regulator.split(/[\s(]/)[0]?.toLowerCase() || 'unknown'}`;

  // Determine priority based on entity count
  let priority = 'Optional';
  if (research.estimatedEntityCount >= 100) priority = 'Core';
  else if (research.estimatedEntityCount >= 20) priority = 'Standard';

  await notionApi('/pages', 'POST', {
    parent: { database_id: NOTION_KB_DB },
    properties: {
      Task: {
        title: [
          {
            text: {
              content: `🤖 Build parser: ${parserId} (${research.country})`,
            },
          },
        ],
      },
      Type: { select: { name: 'Task' } },
      Status: { select: { name: 'Backlog' } },
      Priority: { select: { name: priority } },
      Owner: { select: { name: 'Claude Code' } },
      Stage: { select: { name: 'v1.1 — Parsers' } },
      Sprint: { select: { name: 'S4: Scale' } },
      Notes: {
        rich_text: [
          {
            text: {
              content: [
                `**Country:** ${research.country} (${research.countryCode})`,
                `**Regulator:** ${research.regulator}`,
                `**Registry URL:** ${research.registryUrl}`,
                `**Source Type:** ${research.registrySourceType || 'Unknown'}`,
                `**Estimated Entities:** ${research.estimatedEntityCount}`,
                `**Difficulty:** ${research.parserDifficulty}`,
                `**Confidence:** ${research.confidence}`,
                '',
                `**Parser Notes:**`,
                research.parserNotes,
                '',
                `**Regulatory Regime:** ${research.regulatoryRegime}`,
                `**Travel Rule:** ${research.travelRule}`,
                `**VASP Definition:** ${research.vaspDefinition}`,
                `**CBDC:** ${research.cbdcStatus}`,
                `**Stablecoins:** ${research.stablecoinRegulation}`,
                '',
                `_Auto-generated by Country Research Worker_`,
              ]
                .join('\n')
                .substring(0, 2000),
            },
          },
        ],
      },
    },
  });

  logger.info('country-research', `Created KB task: Build parser: ${parserId}`);
}

// ── Fallback console output ─────────────────────────────────────────────

function printParserEntry(r: CountryResearch): void {
  console.log(`\n📋 Parser Entry: ${r.countryCode} — ${r.country}`);
  console.log(`  Regulator: ${r.regulator}`);
  console.log(`  Registry: ${r.registryUrl || '(none)'}`);
  console.log(`  Source Type: ${r.registrySourceType || 'Unknown'}`);
  console.log(`  Entities: ~${r.estimatedEntityCount}`);
  console.log(`  Difficulty: ${r.parserDifficulty}`);
  console.log(`  Notes: ${r.parserNotes}`);
}

function printKBTask(r: CountryResearch): void {
  console.log(`\n📝 Task: Build parser for ${r.country}`);
  console.log(`  Regime: ${r.regulatoryRegime} | Travel Rule: ${r.travelRule}`);
  console.log(`  CBDC: ${r.cbdcStatus}`);
  console.log(`  Stablecoins: ${r.stablecoinRegulation}`);
}

function printResearchSummary(r: CountryResearch): void {
  const icon = r.parserDifficulty === 'impossible' ? '⛔' :
    r.parserDifficulty === 'hard' ? '🟠' :
    r.parserDifficulty === 'medium' ? '🟡' : '🟢';

  console.log(
    `  ${icon} ${r.countryCode.padEnd(4)} ${r.country.padEnd(25)} ` +
    `Regime:${r.regulatoryRegime.padEnd(14)} ` +
    `Entities:${String(r.estimatedEntityCount).padStart(5)} ` +
    `Difficulty:${r.parserDifficulty.padEnd(10)} ` +
    `Travel Rule:${r.travelRule}`,
  );
}

// ── Main ────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const countryIdx = args.indexOf('--country');
  const regionIdx = args.indexOf('--region');
  const missingOnly = args.includes('--missing-only');
  const dryRun = args.includes('--dry-run');

  const targetCountry = countryIdx !== -1 ? args[countryIdx + 1]?.toUpperCase() : null;
  const targetRegion = regionIdx !== -1 ? args[regionIdx + 1] : null;

  logger.info('country-research', 'Starting country research worker');

  // 1. Load jurisdictions from Notion
  let jurisdictions: NotionJurisdiction[];
  const token = getNotionToken();

  if (token) {
    logger.info('country-research', 'Loading jurisdictions from Notion...');
    jurisdictions = await getJurisdictions();
    logger.info('country-research', `Loaded ${jurisdictions.length} jurisdictions`);
  } else {
    logger.warn('country-research', 'No NOTION_TOKEN — using hardcoded list for testing');
    // Fallback: minimal list for testing without Notion
    jurisdictions = [
      { id: '', country: 'Canada', countryCode: 'CA', region: 'Americas', regulatoryRegime: 'Comprehensive', travelRule: 'Enforced', regulator: 'FINTRAC', sourceUrl: '', entityCount: 430 },
      { id: '', country: 'United Kingdom', countryCode: 'GB', region: 'Europe', regulatoryRegime: 'Comprehensive', travelRule: 'Enforced', regulator: 'FCA', sourceUrl: '', entityCount: 44 },
    ];
  }

  // 2. Filter jurisdictions
  if (targetCountry) {
    jurisdictions = jurisdictions.filter((j) => j.countryCode === targetCountry);
  }
  if (targetRegion) {
    jurisdictions = jurisdictions.filter((j) =>
      j.region.toLowerCase().includes(targetRegion.toLowerCase()),
    );
  }

  // 3. Load existing parsers to skip already-covered countries
  let existingParsers: NotionParserEntry[] = [];
  if (token && missingOnly) {
    existingParsers = await getExistingParsers();
    const coveredCountries = new Set(
      existingParsers.map((p) => p.country.split(' — ')[0]?.trim().toUpperCase()),
    );
    const before = jurisdictions.length;
    jurisdictions = jurisdictions.filter((j) => !coveredCountries.has(j.countryCode));
    logger.info('country-research', `Filtered to ${jurisdictions.length} countries (${before - jurisdictions.length} already have parsers)`);
  }

  if (jurisdictions.length === 0) {
    logger.info('country-research', 'No jurisdictions to research');
    return;
  }

  logger.info('country-research', `Researching ${jurisdictions.length} countries...`);
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log(' COUNTRY RESEARCH RESULTS');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  let totalResearched = 0;
  let totalParsable = 0;
  const allResearch: CountryResearch[] = [];

  for (const jur of jurisdictions) {
    logger.info('country-research', `Researching ${jur.country} (${jur.countryCode})...`);

    const research = await researchCountry(jur.country, jur.countryCode, jur.region, {
      regulatoryRegime: jur.regulatoryRegime,
      travelRule: jur.travelRule,
      regulator: jur.regulator,
      sourceUrl: jur.sourceUrl,
      entityCount: jur.entityCount,
    });

    allResearch.push(research);
    printResearchSummary(research);
    totalResearched++;

    if (research.parserDifficulty !== 'impossible') {
      totalParsable++;
    }

    // Write to Notion (unless dry-run)
    if (!dryRun && token) {
      try {
        // Update jurisdiction with research data
        if (jur.id) await updateJurisdiction(jur.id, research);

        // Create parser registry entry (only for parsable countries)
        if (research.registryUrl && research.parserDifficulty !== 'impossible') {
          await createParserRegistryEntry(research);
        }

        // Create KB task for building parser
        if (research.registryUrl && research.parserDifficulty !== 'impossible') {
          await createKBTask(research);
        }
      } catch (err) {
        logger.warn('country-research', `Notion write failed for ${jur.countryCode}: ${err}`);
      }
    }

    // Rate limit: 1.5 sec between Claude calls
    await new Promise((r) => setTimeout(r, 1500));
  }

  // ── Summary ────────────────────────────────────────────────────────

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log(' SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const byDifficulty = { easy: 0, medium: 0, hard: 0, impossible: 0 };
  const byRegime: Record<string, number> = {};
  const byTravelRule: Record<string, number> = {};
  let totalEntities = 0;

  for (const r of allResearch) {
    byDifficulty[r.parserDifficulty]++;
    byRegime[r.regulatoryRegime] = (byRegime[r.regulatoryRegime] || 0) + 1;
    byTravelRule[r.travelRule] = (byTravelRule[r.travelRule] || 0) + 1;
    totalEntities += r.estimatedEntityCount;
  }

  console.log(`Countries researched: ${totalResearched}`);
  console.log(`Parsable (have registry): ${totalParsable}`);
  console.log(`Estimated total entities: ${totalEntities.toLocaleString()}`);
  console.log();
  console.log('Parser Difficulty:');
  console.log(`  🟢 Easy: ${byDifficulty.easy}`);
  console.log(`  🟡 Medium: ${byDifficulty.medium}`);
  console.log(`  🟠 Hard: ${byDifficulty.hard}`);
  console.log(`  ⛔ Impossible: ${byDifficulty.impossible}`);
  console.log();
  console.log('Regulatory Regime:');
  for (const [regime, count] of Object.entries(byRegime).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${regime}: ${count}`);
  }
  console.log();
  console.log('Travel Rule:');
  for (const [status, count] of Object.entries(byTravelRule).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${status}: ${count}`);
  }

  if (dryRun) {
    console.log('\n⚠️  DRY RUN — no Notion changes made');
  }
}

main().catch((err) => {
  console.error('Country Research Worker failed:', err);
  process.exit(1);
});
