/**
 * Verification Worker — periodic health checks on parsed data.
 *
 * Checks:
 * 1. Staleness: registries not scraped in >7 days
 * 2. URL health: sample entity source URLs still reachable
 * 3. Data quality: missing fields, anomalous counts
 *
 * Usage:
 *   npx tsx parsers/workers/verify.ts
 *   npx tsx parsers/workers/verify.ts --check staleness
 *   npx tsx parsers/workers/verify.ts --check url-health
 *   npx tsx parsers/workers/verify.ts --check data-quality
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { logger, sendTelegramAlert } from '../core/logger.js';

// ─── Configuration ──────────────────────────────────────────
export const STALENESS_THRESHOLD_DAYS = 7;
export const URL_HEALTH_SAMPLE_SIZE = 5; // per registry
export const URL_HEALTH_TIMEOUT_MS = 15_000;

/** All known registry IDs */
export const KNOWN_REGISTRIES = [
  'za-fsca', 'jp-fsa', 'fr-amf', 'de-bafin', 'au-austrac',
  'sg-mas', 'nl-dnb', 'ch-finma', 'ca-fintrac', 'gb-fca',
  'us-fincen', 'ae-vara',
];

// ─── Types ──────────────────────────────────────────────────
export interface ScrapeRunRow {
  registry_id: string;
  status: string;
  entities_found: number;
  created_at: string;
}

export interface EntityRow {
  parser_id: string;
  source_url: string | null;
  name: string;
  license_number: string;
  country_code: string;
}

export interface CheckResult {
  check: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  details: Record<string, unknown>;
}

export interface VerificationReport {
  timestamp: string;
  overall: 'pass' | 'warn' | 'fail';
  checks: CheckResult[];
  staleRegistries: string[];
  unreachableCount: number;
  qualityIssues: number;
}

// ─── Supabase Client ────────────────────────────────────────
export function getSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars');
  }

  return createClient(url, key);
}

// ─── Check 1: Staleness ─────────────────────────────────────
export async function checkStaleness(sb: SupabaseClient): Promise<CheckResult> {
  logger.info('verify', 'Checking registry staleness...');

  const { data: runs, error } = await sb
    .from('scrape_runs')
    .select('registry_id, status, entities_found, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    return {
      check: 'staleness',
      status: 'fail',
      message: `DB error: ${error.message}`,
      details: { error: error.message },
    };
  }

  // Get latest successful run per registry
  const latestByRegistry = new Map<string, ScrapeRunRow>();
  for (const run of (runs ?? []) as ScrapeRunRow[]) {
    if (!latestByRegistry.has(run.registry_id) && run.status !== 'error') {
      latestByRegistry.set(run.registry_id, run);
    }
  }

  const now = Date.now();
  const staleRegistries: string[] = [];
  const neverRun: string[] = [];

  for (const registryId of KNOWN_REGISTRIES) {
    const latest = latestByRegistry.get(registryId);
    if (!latest) {
      neverRun.push(registryId);
      continue;
    }

    const ageMs = now - new Date(latest.created_at).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);

    if (ageDays > STALENESS_THRESHOLD_DAYS) {
      staleRegistries.push(registryId);
      logger.warn('verify', `${registryId}: last scrape ${ageDays.toFixed(1)} days ago`);
    }
  }

  const total = staleRegistries.length + neverRun.length;
  const status: CheckResult['status'] = total === 0 ? 'pass' : neverRun.length > 0 && staleRegistries.length === 0 ? 'warn' : 'fail';

  return {
    check: 'staleness',
    status,
    message: total === 0
      ? `All ${KNOWN_REGISTRIES.length} registries scraped within ${STALENESS_THRESHOLD_DAYS} days`
      : `${staleRegistries.length} stale, ${neverRun.length} never scraped`,
    details: {
      staleRegistries,
      neverRun,
      thresholdDays: STALENESS_THRESHOLD_DAYS,
      totalRegistries: KNOWN_REGISTRIES.length,
    },
  };
}

// ─── Check 2: URL Health ────────────────────────────────────
export async function checkUrlHealth(sb: SupabaseClient): Promise<CheckResult> {
  logger.info('verify', 'Checking source URL health...');

  // Get sample of entities with source_url grouped by parser_id
  const { data: entities, error } = await sb
    .from('entities')
    .select('parser_id, source_url, name, license_number, country_code')
    .not('source_url', 'is', null)
    .not('parser_id', 'is', null)
    .limit(URL_HEALTH_SAMPLE_SIZE * KNOWN_REGISTRIES.length);

  if (error) {
    return {
      check: 'url-health',
      status: 'fail',
      message: `DB error: ${error.message}`,
      details: { error: error.message },
    };
  }

  // Group by parser_id, sample per registry
  const byRegistry = new Map<string, EntityRow[]>();
  for (const entity of (entities ?? []) as EntityRow[]) {
    const list = byRegistry.get(entity.parser_id) ?? [];
    if (list.length < URL_HEALTH_SAMPLE_SIZE) {
      list.push(entity);
      byRegistry.set(entity.parser_id, list);
    }
  }

  // Collect unique source URLs to check
  const urlsToCheck = new Set<string>();
  for (const entityList of byRegistry.values()) {
    for (const e of entityList) {
      if (e.source_url) urlsToCheck.add(e.source_url);
    }
  }

  // HEAD request each unique URL
  const unreachable: { url: string; status: number | string }[] = [];
  let checked = 0;

  for (const url of urlsToCheck) {
    checked++;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), URL_HEALTH_TIMEOUT_MS);

      const response = await fetch(url, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; RemiDe-VerifyBot/1.0)',
        },
        signal: controller.signal,
        redirect: 'follow',
      });

      clearTimeout(timeoutId);

      if (!response.ok && response.status !== 403 && response.status !== 405) {
        // 403/405 are acceptable — many registries block HEAD but serve GET
        unreachable.push({ url, status: response.status });
        logger.warn('verify', `URL ${response.status}: ${url}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      unreachable.push({ url, status: msg });
      logger.warn('verify', `URL unreachable: ${url} (${msg})`);
    }

    // Small delay between requests
    await new Promise((r) => setTimeout(r, 1000));
  }

  const status: CheckResult['status'] =
    unreachable.length === 0 ? 'pass' :
    unreachable.length <= 2 ? 'warn' : 'fail';

  return {
    check: 'url-health',
    status,
    message: `${checked} URLs checked, ${unreachable.length} unreachable`,
    details: {
      checked,
      unreachable,
      registriesChecked: byRegistry.size,
    },
  };
}

// ─── Check 3: Data Quality ──────────────────────────────────
export async function checkDataQuality(sb: SupabaseClient): Promise<CheckResult> {
  logger.info('verify', 'Checking data quality...');

  const issues: string[] = [];

  // 3a. Check for entities with missing critical fields
  const { count: missingName, error: e1 } = await sb
    .from('entities')
    .select('*', { count: 'exact', head: true })
    .or('name.is.null,name.eq.');

  if (e1) {
    issues.push(`DB error checking names: ${e1.message}`);
  } else if (missingName && missingName > 0) {
    issues.push(`${missingName} entities with missing/empty name`);
  }

  // 3b. Check for entities with missing license_number
  const { count: missingLicense, error: e2 } = await sb
    .from('entities')
    .select('*', { count: 'exact', head: true })
    .or('license_number.is.null,license_number.eq.');

  if (e2) {
    issues.push(`DB error checking licenses: ${e2.message}`);
  } else if (missingLicense && missingLicense > 0) {
    issues.push(`${missingLicense} entities with missing/empty license_number`);
  }

  // 3c. Entity count per registry — check for anomalously low counts
  const { data: registryCounts, error: e3 } = await sb
    .from('entities')
    .select('parser_id')
    .not('parser_id', 'is', null);

  if (e3) {
    issues.push(`DB error checking registry counts: ${e3.message}`);
  } else if (registryCounts) {
    const counts = new Map<string, number>();
    for (const row of registryCounts as { parser_id: string }[]) {
      counts.set(row.parser_id, (counts.get(row.parser_id) ?? 0) + 1);
    }

    // Any registry with 0 entities after being scraped is suspicious
    for (const [parserId, count] of counts) {
      if (count === 0) {
        issues.push(`${parserId}: 0 entities in DB`);
      }
    }
  }

  // 3d. Check for recent scrape failures
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentErrors, error: e4 } = await sb
    .from('scrape_runs')
    .select('registry_id, error_message, created_at')
    .eq('status', 'error')
    .gte('created_at', threeDaysAgo);

  if (e4) {
    issues.push(`DB error checking recent failures: ${e4.message}`);
  } else if (recentErrors && recentErrors.length > 0) {
    const errorRegistries = [...new Set((recentErrors as unknown as { registry_id: string }[]).map((r) => r.registry_id))];
    issues.push(`${recentErrors.length} scrape errors in last 3 days from: ${errorRegistries.join(', ')}`);
  }

  const status: CheckResult['status'] =
    issues.length === 0 ? 'pass' :
    issues.length <= 2 ? 'warn' : 'fail';

  return {
    check: 'data-quality',
    status,
    message: issues.length === 0
      ? 'Data quality checks passed'
      : `${issues.length} issues found`,
    details: { issues },
  };
}

// ─── Log Verification Run ───────────────────────────────────
export async function logVerificationRun(
  sb: SupabaseClient,
  report: VerificationReport,
  checkType: string
): Promise<void> {
  try {
    await sb.from('verification_runs').insert({
      check_type: checkType,
      status: report.overall,
      summary: report.checks.map((c) => `[${c.status}] ${c.check}: ${c.message}`).join(' | '),
      details: { checks: report.checks },
      stale_registries: report.staleRegistries,
      unreachable_count: report.unreachableCount,
      quality_issues: report.qualityIssues,
    });
  } catch (err) {
    logger.error('verify', `Failed to log verification run: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ─── Main ───────────────────────────────────────────────────
export async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const checkIdx = args.indexOf('--check');
  const checkType = checkIdx !== -1 ? args[checkIdx + 1] : 'full';

  logger.info('verify', `Starting verification: ${checkType}`);
  const sb = getSupabase();

  const checks: CheckResult[] = [];

  if (checkType === 'full' || checkType === 'staleness') {
    checks.push(await checkStaleness(sb));
  }

  if (checkType === 'full' || checkType === 'url-health') {
    checks.push(await checkUrlHealth(sb));
  }

  if (checkType === 'full' || checkType === 'data-quality') {
    checks.push(await checkDataQuality(sb));
  }

  // Determine overall status
  const hasFailure = checks.some((c) => c.status === 'fail');
  const hasWarning = checks.some((c) => c.status === 'warn');
  const overall: VerificationReport['overall'] = hasFailure ? 'fail' : hasWarning ? 'warn' : 'pass';

  // Extract details for report
  const staleRegistries = checks
    .filter((c) => c.check === 'staleness')
    .flatMap((c) => (c.details.staleRegistries as string[]) ?? []);

  const unreachableCount = checks
    .filter((c) => c.check === 'url-health')
    .reduce((sum, c) => sum + ((c.details.unreachable as unknown[])?.length ?? 0), 0);

  const qualityIssues = checks
    .filter((c) => c.check === 'data-quality')
    .reduce((sum, c) => sum + ((c.details.issues as string[])?.length ?? 0), 0);

  const report: VerificationReport = {
    timestamp: new Date().toISOString(),
    overall,
    checks,
    staleRegistries,
    unreachableCount,
    qualityIssues,
  };

  // Log to DB
  await logVerificationRun(sb, report, checkType);

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log(`VERIFICATION REPORT — ${report.timestamp}`);
  console.log('='.repeat(60));

  for (const check of checks) {
    const icon = check.status === 'pass' ? '✅' : check.status === 'warn' ? '⚠️' : '❌';
    console.log(`${icon} ${check.check}: ${check.message}`);
  }

  console.log('-'.repeat(60));
  console.log(`Overall: ${overall.toUpperCase()}`);
  console.log('='.repeat(60) + '\n');

  // Send Telegram alert if failures detected
  if (hasFailure) {
    const summary = checks
      .filter((c) => c.status === 'fail')
      .map((c) => `${c.check}: ${c.message}`)
      .join('\n');

    await sendTelegramAlert('verify', `Verification FAILED:\n${summary}`, true);
  }

  // Exit with non-zero code on failure
  if (hasFailure) {
    process.exit(1);
  }
}

// Only run when invoked directly (not when imported for testing)
const isDirectRun = process.argv[1]?.includes('verify');
if (isDirectRun) {
  main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
