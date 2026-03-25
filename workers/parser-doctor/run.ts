/**
 * Parser Doctor — monitors scrape_runs for broken parsers,
 * diagnoses failures by re-fetching source pages, and attempts
 * automated fixes via Claude API.
 *
 * Flow:
 *   1. Query scrape_runs for recent errors
 *   2. For each broken parser:
 *      a. Re-fetch the source URL to see current HTML structure
 *      b. Read the parser source code
 *      c. Send both to Claude API with fix instructions
 *      d. Apply the patch, test the fix
 *      e. If test passes → create branch + commit + PR
 *      f. If test fails → create GitHub Issue with diagnosis
 *   3. Send summary to Telegram
 *
 * Usage:
 *   npx tsx workers/parser-doctor/run.ts
 *   npx tsx workers/parser-doctor/run.ts --parser us-nydfs   # Fix specific parser
 *   npx tsx workers/parser-doctor/run.ts --dry-run           # Diagnose only
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../../shared/config.js';
import { logger, sendTelegramAlert } from '../../shared/logger.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

const SCOPE = 'parser-doctor';
const PARSERS_DIR = path.resolve(import.meta.dirname, '../../parsers/registries');
const MAX_HTML_CHARS = 15_000;
const MAX_FIX_ATTEMPTS = 1;

interface BrokenParser {
  registryId: string;
  errorMessage: string | null;
  lastRunAt: string;
  sourceUrl: string | null;
  parserFile: string | null;
}

interface DiagnosisResult {
  registryId: string;
  diagnosis: string;
  suggestedFix: string | null;
  fixedCode: string | null;
  testPassed: boolean;
  error?: string;
}

/* ── CLI ── */

function parseArgs() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const parserIdx = args.indexOf('--parser');
  const parser = parserIdx !== -1 ? args[parserIdx + 1] : null;
  const lookbackHours = 48;
  return { dryRun, parser, lookbackHours };
}

/* ── Step 1: Find broken parsers ── */

async function findBrokenParsers(lookbackHours: number, specificParser: string | null): Promise<BrokenParser[]> {
  const sb = createClient(config.supabase.url, config.supabase.serviceKey);
  const since = new Date(Date.now() - lookbackHours * 3600_000).toISOString();

  let query = sb
    .from('scrape_runs')
    .select('registry_id, status, error_message, created_at')
    .in('status', ['error', 'partial'])
    .gte('created_at', since)
    .order('created_at', { ascending: false });

  if (specificParser) {
    query = query.eq('registry_id', specificParser);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to query scrape_runs: ${error.message}`);

  const seen = new Set<string>();
  const broken: BrokenParser[] = [];

  for (const row of data ?? []) {
    const rid = row.registry_id as string;
    if (seen.has(rid)) continue;
    seen.add(rid);

    const parserFile = findParserFile(rid);
    const sourceUrl = parserFile ? extractSourceUrl(parserFile) : null;

    broken.push({
      registryId: rid,
      errorMessage: row.error_message as string | null,
      lastRunAt: row.created_at as string,
      sourceUrl,
      parserFile,
    });
  }

  return broken;
}

function findParserFile(registryId: string): string | null {
  const file = path.join(PARSERS_DIR, `${registryId}.ts`);
  if (fs.existsSync(file)) return file;
  const altFile = path.join(PARSERS_DIR, `${registryId.replace(/-/g, '_')}.ts`);
  if (fs.existsSync(altFile)) return altFile;
  return null;
}

function extractSourceUrl(parserFile: string): string | null {
  const code = fs.readFileSync(parserFile, 'utf-8');
  const match = code.match(/(?:SOURCE_URL|url|URL)\s*=\s*['"`]([^'"`]+)['"`]/);
  return match?.[1] ?? null;
}

/* ── Step 2: Diagnose ── */

async function fetchSourcePage(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
      },
    });
    if (!res.ok) return `HTTP ${res.status}: ${res.statusText}`;
    const html = await res.text();
    return html.slice(0, MAX_HTML_CHARS);
  } catch (err) {
    return `Fetch error: ${err instanceof Error ? err.message : String(err)}`;
  } finally {
    clearTimeout(timeout);
  }
}

async function diagnoseAndFix(parser: BrokenParser): Promise<DiagnosisResult> {
  const result: DiagnosisResult = {
    registryId: parser.registryId,
    diagnosis: '',
    suggestedFix: null,
    fixedCode: null,
    testPassed: false,
  };

  if (!parser.parserFile) {
    result.diagnosis = `No parser file found for ${parser.registryId}`;
    return result;
  }

  const parserCode = fs.readFileSync(parser.parserFile, 'utf-8');
  let sourceHtml = '';

  if (parser.sourceUrl) {
    logger.info(SCOPE, `Fetching source page: ${parser.sourceUrl}`);
    sourceHtml = await fetchSourcePage(parser.sourceUrl);
  }

  const anthropicKey = config.anthropic.apiKey;
  if (!anthropicKey) {
    result.diagnosis = 'ANTHROPIC_API_KEY not configured — cannot auto-diagnose';
    return result;
  }

  logger.info(SCOPE, `Sending ${parser.registryId} to Claude for diagnosis...`);

  const prompt = buildDiagnosisPrompt(parser, parserCode, sourceHtml);

  try {
    const response = await callClaude(anthropicKey, prompt);
    const parsed = parseClaudeResponse(response);
    result.diagnosis = parsed.diagnosis;
    result.suggestedFix = parsed.suggestedFix;
    result.fixedCode = parsed.fixedCode;
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
    result.diagnosis = `Claude API error: ${result.error}`;
  }

  return result;
}

function buildDiagnosisPrompt(parser: BrokenParser, parserCode: string, sourceHtml: string): string {
  return `You are a parser maintenance bot. A web scraping parser has failed. Diagnose why and provide a fixed version.

## Parser ID: ${parser.registryId}
## Error message from last run: ${parser.errorMessage ?? 'No error message recorded'}
## Last run: ${parser.lastRunAt}

## Current parser code:
\`\`\`typescript
${parserCode}
\`\`\`

## Current HTML from source URL (${parser.sourceUrl ?? 'unknown'}):
\`\`\`html
${sourceHtml.slice(0, 12_000)}
\`\`\`

## Your task:
1. DIAGNOSE: Explain why the parser is failing (HTML structure changed? URL changed? API changed? Rate limited? Blocked?)
2. FIX: Provide the complete fixed parser code that will work with the current HTML structure
3. Keep the same class name, same interface, same imports — only change the parsing logic

## Response format (use these exact headers):
### DIAGNOSIS
(your diagnosis here)

### SUGGESTED_FIX
(one-line summary of what changed)

### FIXED_CODE
\`\`\`typescript
(complete fixed parser code here — full file, ready to replace)
\`\`\``;
}

async function callClaude(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Claude API ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json() as { content: Array<{ text: string }> };
  return data.content[0]?.text ?? '';
}

function parseClaudeResponse(response: string): {
  diagnosis: string;
  suggestedFix: string | null;
  fixedCode: string | null;
} {
  const diagMatch = response.match(/### DIAGNOSIS\s*\n([\s\S]*?)(?=### SUGGESTED_FIX|$)/);
  const fixMatch = response.match(/### SUGGESTED_FIX\s*\n([\s\S]*?)(?=### FIXED_CODE|$)/);
  const codeMatch = response.match(/### FIXED_CODE\s*\n```typescript\s*\n([\s\S]*?)```/);

  return {
    diagnosis: diagMatch?.[1]?.trim() ?? response.slice(0, 500),
    suggestedFix: fixMatch?.[1]?.trim() ?? null,
    fixedCode: codeMatch?.[1]?.trim() ?? null,
  };
}

/* ── Step 3: Test the fix ── */

function testFix(registryId: string, fixedCode: string, parserFile: string): boolean {
  const backupFile = parserFile + '.backup';

  try {
    fs.copyFileSync(parserFile, backupFile);
    fs.writeFileSync(parserFile, fixedCode, 'utf-8');

    logger.info(SCOPE, `Testing fix for ${registryId}...`);
    const output = execSync(
      `npx tsx parsers/run.ts --registry ${registryId} --dry-run`,
      {
        cwd: path.resolve(import.meta.dirname, '../..'),
        timeout: 60_000,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );

    const foundEntities = output.match(/Found (\d+) entities/);
    const count = foundEntities ? parseInt(foundEntities[1]) : 0;

    if (count > 0) {
      logger.info(SCOPE, `Fix verified: ${registryId} now finds ${count} entities`);
      return true;
    }

    logger.warn(SCOPE, `Fix produced 0 entities for ${registryId}`);
    return false;
  } catch (err) {
    logger.warn(SCOPE, `Fix test failed: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  } finally {
    if (fs.existsSync(backupFile)) {
      fs.copyFileSync(backupFile, parserFile);
      fs.unlinkSync(backupFile);
    }
  }
}

/* ── Step 4: Create PR or Issue ── */

function applyFixAndCommit(registryId: string, fixedCode: string, parserFile: string, diagnosis: string): string | null {
  const repoRoot = path.resolve(import.meta.dirname, '../..');
  const branch = `fix/parser-doctor-${registryId}-${Date.now()}`;

  try {
    execSync(`git checkout -b ${branch}`, { cwd: repoRoot, stdio: 'pipe' });
    fs.writeFileSync(parserFile, fixedCode, 'utf-8');
    execSync(`git add ${parserFile}`, { cwd: repoRoot, stdio: 'pipe' });
    execSync(
      `git commit -m "fix(parser): auto-fix ${registryId} — parser-doctor\n\nDiagnosis: ${diagnosis.slice(0, 200)}"`,
      { cwd: repoRoot, stdio: 'pipe' }
    );
    execSync(`git push origin ${branch}`, { cwd: repoRoot, stdio: 'pipe' });

    const prBody = `## Parser Doctor Auto-Fix\n\n**Parser:** ${registryId}\n**Diagnosis:** ${diagnosis}\n\n> Auto-generated by parser-doctor workflow. Review before merging.`;
    const prUrl = execSync(
      `gh pr create --title "fix(parser): auto-fix ${registryId}" --body "${prBody.replace(/"/g, '\\"')}" --base main`,
      { cwd: repoRoot, encoding: 'utf-8', stdio: 'pipe' }
    ).trim();

    execSync('git checkout main', { cwd: repoRoot, stdio: 'pipe' });
    return prUrl;
  } catch (err) {
    logger.warn(SCOPE, `Git/PR creation failed: ${err instanceof Error ? err.message : String(err)}`);
    try { execSync('git checkout main', { cwd: repoRoot, stdio: 'pipe' }); } catch {}
    return null;
  }
}

/* ── Main ── */

async function main() {
  const { dryRun, parser, lookbackHours } = parseArgs();
  const startTime = Date.now();

  logger.info(SCOPE, '========================================');
  logger.info(SCOPE, '  Parser Doctor');
  logger.info(SCOPE, '========================================');
  logger.info(SCOPE, `Mode: ${dryRun ? 'DIAGNOSE ONLY' : 'DIAGNOSE + FIX'}`);
  logger.info(SCOPE, `Looking back: ${lookbackHours}h, specific parser: ${parser ?? 'all'}`);

  const broken = await findBrokenParsers(lookbackHours, parser);
  logger.info(SCOPE, `Found ${broken.length} broken parser(s)`);

  if (broken.length === 0) {
    logger.info(SCOPE, 'All parsers healthy. Nothing to do.');
    return;
  }

  const results: DiagnosisResult[] = [];

  for (const bp of broken) {
    logger.info(SCOPE, `\n--- Diagnosing: ${bp.registryId} ---`);
    logger.info(SCOPE, `Error: ${bp.errorMessage ?? 'unknown'}`);
    logger.info(SCOPE, `Source: ${bp.sourceUrl ?? 'unknown'}`);
    logger.info(SCOPE, `File: ${bp.parserFile ?? 'NOT FOUND'}`);

    const diagnosis = await diagnoseAndFix(bp);

    if (!dryRun && diagnosis.fixedCode && bp.parserFile) {
      logger.info(SCOPE, 'Testing proposed fix...');
      diagnosis.testPassed = testFix(bp.registryId, diagnosis.fixedCode, bp.parserFile);

      if (diagnosis.testPassed) {
        logger.info(SCOPE, 'Test PASSED — applying fix and creating PR...');
        const prUrl = applyFixAndCommit(bp.registryId, diagnosis.fixedCode, bp.parserFile, diagnosis.diagnosis);
        if (prUrl) {
          logger.info(SCOPE, `PR created: ${prUrl}`);
          diagnosis.suggestedFix = `PR: ${prUrl}`;
        }
      } else {
        logger.warn(SCOPE, 'Test FAILED — fix not applied. Creating issue instead.');
      }
    }

    results.push(diagnosis);
  }

  // Summary
  const fixed = results.filter(r => r.testPassed).length;
  const diagnosed = results.filter(r => r.diagnosis && !r.testPassed).length;
  const failed = results.filter(r => r.error).length;

  logger.info(SCOPE, '\n========================================');
  logger.info(SCOPE, '  Parser Doctor Summary');
  logger.info(SCOPE, '========================================');
  logger.info(SCOPE, `  Broken parsers found:  ${broken.length}`);
  logger.info(SCOPE, `  Auto-fixed (PR):       ${fixed}`);
  logger.info(SCOPE, `  Diagnosed (manual):    ${diagnosed}`);
  logger.info(SCOPE, `  Diagnosis failed:      ${failed}`);
  logger.info(SCOPE, `  Duration:              ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

  for (const r of results) {
    logger.info(SCOPE, `\n  [${r.registryId}] ${r.testPassed ? 'FIXED' : 'NEEDS ATTENTION'}`);
    logger.info(SCOPE, `    Diagnosis: ${r.diagnosis.slice(0, 200)}`);
    if (r.suggestedFix) logger.info(SCOPE, `    Fix: ${r.suggestedFix}`);
  }

  // Telegram alert
  const alertLines = [
    `Parser Doctor: ${broken.length} broken, ${fixed} auto-fixed, ${diagnosed} need attention`,
    '',
    ...results.map(r =>
      `${r.testPassed ? '✅' : '⚠️'} ${r.registryId}: ${r.diagnosis.slice(0, 100)}`
    ),
  ];
  await sendTelegramAlert(SCOPE, alertLines.join('\n'));

  logger.info(SCOPE, '========================================');
}

main().catch(async (err) => {
  logger.error(SCOPE, `Fatal: ${err.message}`);
  await sendTelegramAlert(SCOPE, `Parser Doctor fatal: ${err.message}`);
  process.exit(1);
});
