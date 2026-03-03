/**
 * QA Worker — AI-powered data quality analysis
 *
 * Runs after parsers complete. Analyzes entity data quality,
 * uses Claude API to research improvements, creates Notion tasks.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=xxx npx tsx parsers/workers/qa-worker.ts
 *   ANTHROPIC_API_KEY=xxx npx tsx parsers/workers/qa-worker.ts --country CA
 *
 * Requires:
 *   - ANTHROPIC_API_KEY — Claude Sonnet API
 *   - NOTION_TOKEN — Notion integration token (for creating tasks)
 *   - SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY — read entity data
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../core/logger.js';

// ── Config ──────────────────────────────────────────────────────────────

const NOTION_KB_ID = 'b48d85fc-29a9-4e68-b331-cbbc5595bc5f';
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

interface QAIssue {
  country: string;
  countryCode: string;
  severity: 'critical' | 'warning' | 'info';
  issue: string;
  fixSpec: string;
  estimatedEffort: string;
  category: 'data_quality' | 'coverage' | 'enrichment' | 'parser_fix';
}

interface CountryStats {
  countryCode: string;
  country: string;
  entityCount: number;
  numericNames: number;
  emptyWebsites: number;
  emptyLicense: number;
  duplicateNames: number;
  statusDistribution: Record<string, number>;
  parserId: string | null;
  lastParsedAt: string | null;
}

// ── Supabase helpers ────────────────────────────────────────────────────

function getSupabase() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key);
}

/** Gather stats for a single country */
async function getCountryStats(countryCode: string): Promise<CountryStats | null> {
  const sb = getSupabase();

  const { data: entities, error } = await sb
    .from('entities')
    .select('name, license_number, website, status, parser_id, parsed_at')
    .eq('country_code', countryCode);

  if (error || !entities || entities.length === 0) return null;

  const numericNames = entities.filter((e) => /^\d{5,}/.test(e.name || '')).length;
  const emptyWebsites = entities.filter((e) => !e.website || e.website.trim() === '').length;
  const emptyLicense = entities.filter((e) => !e.license_number).length;

  // Duplicate names
  const nameCounts = new Map<string, number>();
  for (const e of entities) {
    const n = (e.name || '').toLowerCase().trim();
    nameCounts.set(n, (nameCounts.get(n) || 0) + 1);
  }
  const duplicateNames = [...nameCounts.values()].filter((c) => c > 1).reduce((a, b) => a + b, 0);

  // Status distribution
  const statusDist: Record<string, number> = {};
  for (const e of entities) {
    const s = e.status || 'Unknown';
    statusDist[s] = (statusDist[s] || 0) + 1;
  }

  // Parser info (from first entity with parser_id)
  const withParser = entities.find((e) => e.parser_id);

  // Country name from jurisdictions
  const { data: jur } = await sb
    .from('jurisdictions')
    .select('name')
    .eq('country_code', countryCode)
    .single();

  return {
    countryCode,
    country: jur?.name || countryCode,
    entityCount: entities.length,
    numericNames,
    emptyWebsites,
    emptyLicense,
    duplicateNames,
    statusDistribution: statusDist,
    parserId: withParser?.parser_id || null,
    lastParsedAt: withParser?.parsed_at || null,
  };
}

/** Get all countries with entities */
async function getAllCountryCodes(): Promise<string[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('entities')
    .select('country_code')
    .order('country_code');

  if (error || !data) return [];

  return [...new Set(data.map((d) => d.country_code))];
}

// ── Claude API ──────────────────────────────────────────────────────────

function getAnthropic(): Anthropic {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('Missing ANTHROPIC_API_KEY');
  return new Anthropic({ apiKey: key });
}

async function analyzeCountry(stats: CountryStats): Promise<QAIssue[]> {
  const anthropic = getAnthropic();

  const prompt = `You are a data quality analyst for a VASP (Virtual Asset Service Provider) regulatory tracker.

Analyze this country's entity data and identify issues. Return a JSON array of issues.

COUNTRY: ${stats.country} (${stats.countryCode})
ENTITY COUNT: ${stats.entityCount}
NUMERIC NAMES: ${stats.numericNames} (${((stats.numericNames / stats.entityCount) * 100).toFixed(1)}%)
EMPTY WEBSITES: ${stats.emptyWebsites} (${((stats.emptyWebsites / stats.entityCount) * 100).toFixed(1)}%)
EMPTY LICENSE: ${stats.emptyLicense}
DUPLICATE NAMES: ${stats.duplicateNames}
STATUS DISTRIBUTION: ${JSON.stringify(stats.statusDistribution)}
PARSER: ${stats.parserId || 'none'}
LAST PARSED: ${stats.lastParsedAt || 'never'}

Rules for analysis:
- If >20% names are numeric → critical data_quality issue, suggest enrichment via detail pages or cross-referencing
- If >50% websites missing → warning enrichment issue
- If entity count seems low for the country (e.g. UK has 100+ crypto firms) → coverage issue
- If no parser exists → coverage issue, suggest building one
- If data is stale (>30 days) → warning parser_fix issue
- If all statuses are "Unknown" → warning data_quality issue

Return ONLY a JSON array of objects with fields:
- severity: "critical" | "warning" | "info"
- issue: short description
- fixSpec: detailed specification of how to fix (2-4 sentences)
- estimatedEffort: "small" | "medium" | "large"
- category: "data_quality" | "coverage" | "enrichment" | "parser_fix"

If no issues found, return []. Be concise. Max 3 issues per country.`;

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0]?.type === 'text' ? response.content[0].text : '';

  try {
    // Extract JSON from response (handles markdown code blocks)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const issues: Array<{
      severity: string;
      issue: string;
      fixSpec: string;
      estimatedEffort: string;
      category: string;
    }> = JSON.parse(jsonMatch[0]);

    return issues.map((i) => ({
      country: stats.country,
      countryCode: stats.countryCode,
      severity: i.severity as QAIssue['severity'],
      issue: i.issue,
      fixSpec: i.fixSpec,
      estimatedEffort: i.estimatedEffort,
      category: i.category as QAIssue['category'],
    }));
  } catch {
    logger.warn('qa-worker', `Failed to parse Claude response for ${stats.countryCode}`);
    return [];
  }
}

// ── Notion task creation ────────────────────────────────────────────────

async function createNotionTask(issue: QAIssue): Promise<void> {
  const token = process.env.NOTION_TOKEN ?? process.env.NOTION_API_KEY;
  if (!token) {
    logger.warn('qa-worker', 'No NOTION_TOKEN — printing task instead of creating');
    console.log(`[${issue.severity}] ${issue.country}: ${issue.issue}`);
    console.log(`  Fix: ${issue.fixSpec}`);
    console.log(`  Effort: ${issue.estimatedEffort} | Category: ${issue.category}`);
    return;
  }

  // Use Notion API to create page in Knowledge Base
  const response = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({
      parent: { database_id: NOTION_KB_ID },
      properties: {
        Task: {
          title: [
            {
              text: {
                content: `🤖 [QA] ${issue.country}: ${issue.issue}`,
              },
            },
          ],
        },
        Type: { select: { name: 'Task' } },
        Status: { select: { name: 'Backlog' } },
        Priority: {
          select: {
            name: issue.severity === 'critical' ? 'Core' : issue.severity === 'warning' ? 'Standard' : 'Optional',
          },
        },
        Owner: { select: { name: 'Claude Code' } },
        Stage: { select: { name: 'v1.1 — Parsers' } },
        Sprint: {
          select: {
            name: issue.category === 'coverage' ? 'S4: Scale' : 'S2: First Parsers',
          },
        },
        Notes: {
          rich_text: [
            {
              text: {
                content: `**Category:** ${issue.category}\n**Severity:** ${issue.severity}\n**Effort:** ${issue.estimatedEffort}\n\n**Spec:**\n${issue.fixSpec}\n\n_Auto-generated by QA Worker_`,
              },
            },
          ],
        },
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    logger.warn('qa-worker', `Notion API error: ${response.status} ${text}`);
  } else {
    logger.info('qa-worker', `Created Notion task: ${issue.issue}`);
  }
}

// ── Main ────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const countryIdx = args.indexOf('--country');
  const targetCountry = countryIdx !== -1 ? args[countryIdx + 1] : null;

  logger.info('qa-worker', `Starting QA analysis${targetCountry ? ` for ${targetCountry}` : ' for all countries'}`);

  const countryCodes = targetCountry ? [targetCountry.toUpperCase()] : await getAllCountryCodes();

  let totalIssues = 0;

  for (const cc of countryCodes) {
    const stats = await getCountryStats(cc);
    if (!stats) {
      logger.debug('qa-worker', `No data for ${cc}, skipping`);
      continue;
    }

    logger.info('qa-worker', `Analyzing ${stats.country} (${cc}): ${stats.entityCount} entities`);

    const issues = await analyzeCountry(stats);
    totalIssues += issues.length;

    for (const issue of issues) {
      await createNotionTask(issue);
    }

    // Rate limit: 1 request per 2 seconds
    await new Promise((r) => setTimeout(r, 2000));
  }

  logger.info('qa-worker', `QA analysis complete: ${countryCodes.length} countries, ${totalIssues} issues found`);
}

main().catch((err) => {
  console.error('QA Worker failed:', err);
  process.exit(1);
});
