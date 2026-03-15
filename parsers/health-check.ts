/**
 * Parser Health Check — dry-run all registered parsers and report status.
 *
 * Usage:
 *   npx tsx parsers/health-check.ts                   # Check all parsers
 *   npx tsx parsers/health-check.ts --timeout 60      # Custom timeout (seconds)
 *   npx tsx parsers/health-check.ts --json             # JSON output only
 *   npx tsx parsers/health-check.ts --parser za-fsca   # Single parser
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PARSERS } from './registry.js';
import { getEntityCount } from './core/db.js';
import { validateParseResult } from './core/validator.js';

interface HealthResult {
  parserId: string;
  name: string;
  countryCode: string;
  sourceType: string;
  status: 'ok' | 'error' | 'timeout' | 'empty';
  entityCount: number;
  dbCount: number;
  deltaPercent: number;
  durationMs: number;
  schemaErrors: number;
  error: string | null;
}

const TIMEOUT_DEFAULT_S = 45;

function parseArgs() {
  const args = process.argv.slice(2);
  const timeoutIdx = args.indexOf('--timeout');
  const timeout = timeoutIdx !== -1 ? parseInt(args[timeoutIdx + 1], 10) : TIMEOUT_DEFAULT_S;
  const jsonOnly = args.includes('--json');
  const parserIdx = args.indexOf('--parser');
  const parserId = parserIdx !== -1 ? args[parserIdx + 1] : null;
  return { timeout, jsonOnly, parserId };
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timeout after ${ms / 1000}s`)), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer!);
  }
}

async function checkParser(id: string, timeoutMs: number): Promise<HealthResult> {
  const factory = PARSERS[id];
  if (!factory) throw new Error(`Unknown parser: ${id}`);

  const parser = factory();
  const { name, countryCode, sourceType } = parser.config;
  const start = Date.now();

  try {
    const result = await withTimeout(parser.parse(), timeoutMs);
    const durationMs = Date.now() - start;
    const schemaErrors = validateParseResult(result);

    let dbCount = 0;
    try {
      dbCount = await getEntityCount(countryCode);
    } catch { /* DB not available in some envs */ }

    const deltaPercent = dbCount > 0
      ? Math.abs(((result.entities.length - dbCount) / dbCount) * 100)
      : 0;

    const status: HealthResult['status'] =
      result.entities.length === 0 ? 'empty' : 'ok';

    return {
      parserId: id, name, countryCode, sourceType, status,
      entityCount: result.entities.length, dbCount, deltaPercent,
      durationMs, schemaErrors: schemaErrors.length, error: null,
    };
  } catch (err) {
    const durationMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    const isTimeout = message.startsWith('Timeout after');

    return {
      parserId: id, name, countryCode, sourceType,
      status: isTimeout ? 'timeout' : 'error',
      entityCount: 0, dbCount: 0, deltaPercent: 0,
      durationMs, schemaErrors: 0, error: message,
    };
  }
}

function printTable(results: HealthResult[]) {
  const ok = results.filter(r => r.status === 'ok');
  const empty = results.filter(r => r.status === 'empty');
  const errors = results.filter(r => r.status === 'error');
  const timeouts = results.filter(r => r.status === 'timeout');

  console.log('\n' + '='.repeat(100));
  console.log('PARSER HEALTH CHECK REPORT');
  console.log('='.repeat(100));
  console.log(`Total: ${results.length} | OK: ${ok.length} | Empty: ${empty.length} | Error: ${errors.length} | Timeout: ${timeouts.length}`);
  console.log('='.repeat(100));

  const pad = (s: string, n: number) => s.slice(0, n).padEnd(n);
  const header = `${pad('Parser', 16)} ${pad('Status', 8)} ${pad('Entities', 10)} ${pad('DB Count', 10)} ${pad('Delta%', 8)} ${pad('Time(s)', 8)} ${pad('Errors', 8)} Error`;
  console.log(header);
  console.log('-'.repeat(100));

  for (const r of results) {
    const statusIcon = { ok: '  OK', error: ' ERR', timeout: 'TOUT', empty: 'NONE' }[r.status];
    const line = `${pad(r.parserId, 16)} ${pad(statusIcon, 8)} ${pad(String(r.entityCount), 10)} ${pad(String(r.dbCount), 10)} ${pad(r.deltaPercent > 0 ? r.deltaPercent.toFixed(1) : '-', 8)} ${pad((r.durationMs / 1000).toFixed(1), 8)} ${pad(String(r.schemaErrors), 8)} ${r.error ? r.error.slice(0, 60) : ''}`;
    console.log(line);
  }

  if (errors.length > 0 || timeouts.length > 0) {
    console.log('\n' + '='.repeat(100));
    console.log('FAILURES');
    console.log('='.repeat(100));
    for (const r of [...errors, ...timeouts]) {
      console.log(`\n[${r.status.toUpperCase()}] ${r.parserId} (${r.name})`);
      console.log(`  Error: ${r.error}`);
    }
  }

  console.log('\n' + '='.repeat(100));
  const totalEntities = ok.reduce((sum, r) => sum + r.entityCount, 0);
  console.log(`SUMMARY: ${ok.length}/${results.length} healthy, ${totalEntities} total entities parsed`);
  console.log('='.repeat(100) + '\n');
}

async function main() {
  const { timeout, jsonOnly, parserId } = parseArgs();
  const timeoutMs = timeout * 1000;

  const ids = parserId ? [parserId] : Object.keys(PARSERS);

  if (!jsonOnly) {
    console.log(`\nRunning health check on ${ids.length} parsers (timeout: ${timeout}s each)...\n`);
  }

  const results: HealthResult[] = [];

  for (const id of ids) {
    if (!jsonOnly) {
      process.stdout.write(`  Checking ${id}...`);
    }
    const result = await checkParser(id, timeoutMs);
    results.push(result);
    if (!jsonOnly) {
      const icon = { ok: 'OK', error: 'FAIL', timeout: 'TIMEOUT', empty: 'EMPTY' }[result.status];
      console.log(` ${icon} (${result.entityCount} entities, ${(result.durationMs / 1000).toFixed(1)}s)`);
    }
  }

  if (jsonOnly) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    printTable(results);
  }

  const reportPath = 'parsers/health-report.json';
  const fs = await import('fs');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    total: results.length,
    ok: results.filter(r => r.status === 'ok').length,
    empty: results.filter(r => r.status === 'empty').length,
    error: results.filter(r => r.status === 'error').length,
    timeout: results.filter(r => r.status === 'timeout').length,
    results,
  }, null, 2));

  if (!jsonOnly) {
    console.log(`Report saved to ${reportPath}`);
  }

  const failCount = results.filter(r => r.status === 'error' || r.status === 'timeout').length;
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
