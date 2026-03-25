/**
 * Quality Audit Worker — daily pipeline health check.
 *
 * Scans the DB for data quality issues, updates QUALITY-ISSUES.md,
 * and sends a Telegram digest.
 *
 * Usage:
 *   npx tsx workers/quality-audit/run.ts                    # Full audit + Telegram
 *   npx tsx workers/quality-audit/run.ts --no-telegram      # Skip Telegram
 *   npx tsx workers/quality-audit/run.ts --no-file          # Skip QUALITY-ISSUES.md update
 */

import { writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from '../../shared/config.js';
import { getSupabase } from '../../shared/supabase.js';
import { logger, sendTelegramAlert } from '../../shared/logger.js';
import { isRegistryWebsite } from '../../shared/registry-domains.js';

const SCOPE = 'quality-audit';
const LOOKBACK_HOURS = 48;

/* ── Types ── */

interface Issue {
  severity: 'critical' | 'warning' | 'info';
  category: string;
  title: string;
  detail: string;
  count?: number;
}

interface ParserStatus {
  registryId: string;
  status: string;
  entitiesFound: number;
  lastRun: string;
  errorMessage?: string;
}

interface AuditReport {
  timestamp: string;
  metrics: {
    totalEntities: number;
    nonGarbage: number;
    withWebsite: number;
    enriched: number;
    dnsAlive: number;
    dnsDead: number;
    dnsUnknown: number;
    cryptoConfirmed: number;
    cryptoAdjacent: number;
    traditional: number;
    cryptoUnknown: number;
    noWebsite: number;
    noDescription: number;
    registryUrlInWebsite: number;
  };
  parserStatuses: ParserStatus[];
  issues: Issue[];
}

/* ── CLI Args ── */

const skipTelegram = process.argv.includes('--no-telegram');
const skipFile = process.argv.includes('--no-file');

/* ── Main ── */

async function main() {
  const sb = getSupabase();
  const startedAt = Date.now();

  logger.info(SCOPE, '═══════════════════════════════════════════');
  logger.info(SCOPE, '  Quality Audit — Daily Pipeline Health');
  logger.info(SCOPE, '═══════════════════════════════════════════');

  const report = await buildReport(sb);

  if (!skipFile) {
    writeQualityIssuesFile(report);
    logger.info(SCOPE, 'Updated QUALITY-ISSUES.md');
  }

  if (!skipTelegram) {
    await sendDigest(report);
    logger.info(SCOPE, 'Sent Telegram digest');
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  logger.info(SCOPE, `Audit complete in ${elapsed}s — ${report.issues.length} issues found`);
}

/* ── Report Builder ── */

async function buildReport(sb: ReturnType<typeof getSupabase>): Promise<AuditReport> {
  const issues: Issue[] = [];

  // 1. Entity metrics
  const [totalEntities, nonGarbage, withWebsite, enriched, dnsAlive, dnsDead,
    cryptoConfirmed, cryptoAdjacent, traditional, cryptoUnknown] = await Promise.all([
    countEntities(sb, {}),
    countEntities(sb, { neq: ['is_garbage', true] }),
    countEntities(sb, { notNull: 'website', neqStr: ['website', ''] }),
    countEntities(sb, { notNull: 'enriched_at' }),
    countEntities(sb, { eq: ['dns_status', 'alive'] }),
    countEntities(sb, { eq: ['dns_status', 'dead'] }),
    countEntities(sb, { eq: ['crypto_status', 'confirmed_crypto'] }),
    countEntities(sb, { eq: ['crypto_status', 'crypto_adjacent'] }),
    countEntities(sb, { eq: ['crypto_status', 'traditional'] }),
    countEntities(sb, { eq: ['crypto_status', 'unknown'] }),
  ]);

  const noWebsite = totalEntities - withWebsite;
  const noDescription = nonGarbage - enriched;
  const dnsUnknown = totalEntities - dnsAlive - dnsDead;

  // 2. Registry URL check
  const registryUrlInWebsite = await countRegistryUrls(sb);

  // 3. Parser statuses (last 48h)
  const parserStatuses = await getParserStatuses(sb);

  // 4. Generate issues — classify error types accurately
  const allErrors = parserStatuses.filter(p => p.status === 'error');
  const partialParsers = parserStatuses.filter(p => p.status === 'partial');

  // Split errors: anomaly rejections vs real failures vs worker entries
  const anomalyRejections = allErrors.filter(p =>
    p.errorMessage?.startsWith('Anomaly') || (p.entitiesFound > 0 && !p.errorMessage),
  );
  const workerEntries = allErrors.filter(p =>
    ['enrichment-firecrawl', 'quality-worker', 'verify-worker', 'website-discovery', 'site-scraper', 'brand-coverage'].includes(p.registryId),
  );
  const realFailures = allErrors.filter(p =>
    !anomalyRejections.includes(p) && !workerEntries.includes(p),
  );

  if (realFailures.length > 0) {
    issues.push({
      severity: realFailures.length > 10 ? 'critical' : 'warning',
      category: 'parsers',
      title: `${realFailures.length} parsers BROKEN (0 entities)`,
      detail: realFailures.map(p => p.registryId).join(', '),
      count: realFailures.length,
    });
  }

  if (anomalyRejections.length > 0) {
    issues.push({
      severity: 'info',
      category: 'parsers',
      title: `${anomalyRejections.length} parsers blocked by anomaly detection`,
      detail: 'Parsers worked but delta was too high. Review and re-run with --force if data is correct.',
      count: anomalyRejections.length,
    });
  }

  if (partialParsers.length > 0) {
    issues.push({
      severity: 'info',
      category: 'parsers',
      title: `${partialParsers.length} parsers PARTIAL`,
      detail: partialParsers.map(p => `${p.registryId} (${p.entitiesFound})`).join(', '),
      count: partialParsers.length,
    });
  }

  if (registryUrlInWebsite > 0) {
    issues.push({
      severity: 'warning',
      category: 'data-quality',
      title: `${registryUrlInWebsite} entities have registry URLs in website field`,
      detail: 'Run scripts/fix-registry-websites.ts --apply to clean up',
      count: registryUrlInWebsite,
    });
  }

  const websitePct = totalEntities > 0 ? (withWebsite / totalEntities * 100) : 0;
  if (websitePct < 50) {
    issues.push({
      severity: 'warning',
      category: 'coverage',
      title: `Website coverage only ${websitePct.toFixed(0)}%`,
      detail: `${noWebsite} entities without a website. Run website-discovery to improve.`,
      count: noWebsite,
    });
  }

  const enrichPct = nonGarbage > 0 ? (enriched / nonGarbage * 100) : 0;
  if (enrichPct < 60) {
    issues.push({
      severity: 'info',
      category: 'coverage',
      title: `Enrichment coverage ${enrichPct.toFixed(0)}% of non-garbage entities`,
      detail: `${noDescription} entities still need enrichment.`,
      count: noDescription,
    });
  }

  if (cryptoUnknown > 500) {
    issues.push({
      severity: 'info',
      category: 'classification',
      title: `${cryptoUnknown} entities with crypto_status = unknown`,
      detail: 'May need manual review or better keyword/parser mapping.',
      count: cryptoUnknown,
    });
  }

  const garbageRate = totalEntities > 0 ? ((totalEntities - nonGarbage) / totalEntities * 100) : 0;
  if (garbageRate > 15) {
    issues.push({
      severity: 'warning',
      category: 'data-quality',
      title: `Garbage rate ${garbageRate.toFixed(1)}% (${totalEntities - nonGarbage} entities)`,
      detail: 'Higher than expected. Check if new parser is producing junk.',
      count: totalEntities - nonGarbage,
    });
  }

  return {
    timestamp: new Date().toISOString(),
    metrics: {
      totalEntities, nonGarbage, withWebsite, enriched,
      dnsAlive, dnsDead, dnsUnknown,
      cryptoConfirmed, cryptoAdjacent, traditional, cryptoUnknown,
      noWebsite, noDescription, registryUrlInWebsite,
    },
    parserStatuses,
    issues,
  };
}

/* ── DB Helpers ── */

interface CountFilter {
  eq?: [string, unknown];
  neq?: [string, unknown];
  notNull?: string;
  neqStr?: [string, string];
}

async function countEntities(sb: ReturnType<typeof getSupabase>, filter: CountFilter): Promise<number> {
  let query = sb.from('entities').select('id', { count: 'exact', head: true });
  if (filter.eq) query = query.eq(filter.eq[0], filter.eq[1]);
  if (filter.neq) query = query.neq(filter.neq[0], filter.neq[1]);
  if (filter.notNull) query = query.not(filter.notNull, 'is', null);
  if (filter.neqStr) query = query.neq(filter.neqStr[0], filter.neqStr[1]);
  const { count } = await query;
  return count ?? 0;
}

async function countRegistryUrls(sb: ReturnType<typeof getSupabase>): Promise<number> {
  const PAGE = 1000;
  let offset = 0;
  let found = 0;

  while (true) {
    const { data } = await sb.from('entities')
      .select('website')
      .not('website', 'is', null)
      .neq('website', '')
      .range(offset, offset + PAGE - 1);

    if (!data || data.length === 0) break;
    for (const row of data) {
      if (isRegistryWebsite(row.website)) found++;
    }
    if (data.length < PAGE) break;
    offset += PAGE;
  }

  return found;
}

async function getParserStatuses(sb: ReturnType<typeof getSupabase>): Promise<ParserStatus[]> {
  const since = new Date(Date.now() - LOOKBACK_HOURS * 3600000).toISOString();
  const { data } = await sb.from('scrape_runs')
    .select('registry_id, status, entities_found, error_message, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(500);

  if (!data) return [];

  const latest = new Map<string, ParserStatus>();
  for (const row of data) {
    if (!latest.has(row.registry_id)) {
      latest.set(row.registry_id, {
        registryId: row.registry_id,
        status: row.status,
        entitiesFound: row.entities_found,
        lastRun: row.created_at,
        errorMessage: row.error_message || undefined,
      });
    }
  }

  return Array.from(latest.values()).sort((a, b) => a.registryId.localeCompare(b.registryId));
}

/* ── File Writer ── */

function writeQualityIssuesFile(report: AuditReport) {
  const m = report.metrics;
  const ts = new Date(report.timestamp).toISOString().split('T')[0];

  const criticalIssues = report.issues.filter(i => i.severity === 'critical');
  const warnings = report.issues.filter(i => i.severity === 'warning');
  const infos = report.issues.filter(i => i.severity === 'info');

  const allErrors = report.parserStatuses.filter(p => p.status === 'error');
  const okParsers = report.parserStatuses.filter(p => p.status === 'success');
  const partialParsers = report.parserStatuses.filter(p => p.status === 'partial');

  const workerIds = new Set(['enrichment-firecrawl', 'quality-worker', 'verify-worker', 'website-discovery', 'site-scraper', 'brand-coverage']);
  const anomalyParsers = allErrors.filter(p => p.errorMessage?.startsWith('Anomaly') || (p.entitiesFound > 0 && !p.errorMessage));
  const brokenParsers = allErrors.filter(p => !anomalyParsers.includes(p) && !workerIds.has(p.registryId));

  // Read existing file to preserve Manual Notes section
  const filePath = resolve(import.meta.dirname, '../../QUALITY-ISSUES.md');
  let manualNotes = '';
  try {
    const existing = readFileSync(filePath, 'utf-8');
    const manualIdx = existing.indexOf('## Manual Notes');
    if (manualIdx !== -1) {
      manualNotes = existing.substring(manualIdx);
    }
  } catch { /* file doesn't exist yet */ }

  if (!manualNotes) {
    manualNotes = '## Manual Notes\n\n> Add manual observations below.\n';
  }

  const content = `# VASP Tracker — Quality Issues Log

> Auto-generated by \`workers/quality-audit/run.ts\`.
> Manual entries in "Manual Notes" section are preserved across runs.
>
> **Last audit:** ${report.timestamp}

---

## Summary

| Metric | Count | % |
|--------|-------|---|
| Total entities | ${m.totalEntities.toLocaleString()} | 100% |
| Non-garbage | ${m.nonGarbage.toLocaleString()} | ${pct(m.nonGarbage, m.totalEntities)} |
| With website | ${m.withWebsite.toLocaleString()} | ${pct(m.withWebsite, m.totalEntities)} |
| Enriched | ${m.enriched.toLocaleString()} | ${pct(m.enriched, m.nonGarbage)} of non-garbage |
| DNS alive | ${m.dnsAlive.toLocaleString()} | — |
| DNS dead | ${m.dnsDead.toLocaleString()} | — |
| Crypto confirmed | ${m.cryptoConfirmed.toLocaleString()} | ${pct(m.cryptoConfirmed, m.totalEntities)} |
| Traditional | ${m.traditional.toLocaleString()} | ${pct(m.traditional, m.totalEntities)} |
| Open issues | ${report.issues.length} | — |
| Parsers: broken | ${brokenParsers.length} | — |
| Parsers: anomaly-blocked | ${anomalyParsers.length} | — |

---

## Critical Issues

${criticalIssues.length === 0 ? 'None.' : criticalIssues.map(i => `- **${i.title}**\n  ${i.detail}`).join('\n\n')}

---

## Warnings

${warnings.length === 0 ? 'None.' : warnings.map(i => `- **${i.title}**\n  ${i.detail}`).join('\n\n')}

---

## Info

${infos.length === 0 ? 'None.' : infos.map(i => `- ${i.title}: ${i.detail}`).join('\n')}

---

## Parser Health (last ${LOOKBACK_HOURS}h)

| Status | Count | Parsers |
|--------|-------|---------|
| ✅ Success | ${okParsers.length} | ${okParsers.map(p => p.registryId).join(', ') || '—'} |
| 🟡 Partial | ${partialParsers.length} | ${partialParsers.map(p => `${p.registryId} (${p.entitiesFound})`).join(', ') || '—'} |
| 🔴 Broken (0 entities) | ${brokenParsers.length} | ${brokenParsers.map(p => p.registryId).join(', ') || '—'} |
| 🟠 Anomaly-blocked | ${anomalyParsers.length} | ${anomalyParsers.map(p => p.registryId).join(', ') || '—'} |

---

## Data Quality Gaps

| Gap | Count | Action |
|-----|-------|--------|
| No website | ${m.noWebsite.toLocaleString()} | website-discovery worker |
| Not enriched | ${m.noDescription.toLocaleString()} | enrichment + site-scraper |
| Registry URL in website | ${m.registryUrlInWebsite} | fix-registry-websites.ts |
| Crypto unknown | ${m.cryptoUnknown.toLocaleString()} | quality worker / manual |
| DNS not checked | ${m.dnsUnknown.toLocaleString()} | verify worker |

---

${manualNotes}`;

  writeFileSync(filePath, content, 'utf-8');
}

function pct(part: number, total: number): string {
  if (total === 0) return '0%';
  return `${(part / total * 100).toFixed(1)}%`;
}

/* ── Telegram Digest (direct API, clean format) ── */

async function sendTelegramDirect(text: string): Promise<void> {
  const { botToken, chatId, enabled } = config.telegram;
  if (!enabled || !botToken || !chatId) {
    logger.debug(SCOPE, 'Telegram not configured, skipping digest');
    return;
  }
  if (config.flags.dryRun) {
    logger.info(SCOPE, `[DRY-RUN] Would send Telegram digest`);
    return;
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  });

  if (!res.ok) {
    const body = await res.text();
    logger.error(SCOPE, `Telegram API ${res.status}: ${body}`);
  }
}

async function sendDigest(report: AuditReport) {
  const m = report.metrics;
  const allErrors = report.parserStatuses.filter(p => p.status === 'error');
  const okParsers = report.parserStatuses.filter(p => p.status === 'success');
  const criticals = report.issues.filter(i => i.severity === 'critical');
  const warnings = report.issues.filter(i => i.severity === 'warning');

  const workerIds = new Set(['enrichment-firecrawl', 'quality-worker', 'verify-worker', 'website-discovery', 'site-scraper', 'brand-coverage']);
  const anomalies = allErrors.filter(p => p.errorMessage?.startsWith('Anomaly') || (p.entitiesFound > 0 && !p.errorMessage));
  const broken = allErrors.filter(p => !anomalies.includes(p) && !workerIds.has(p.registryId));

  const date = new Date().toISOString().split('T')[0];

  const lines: string[] = [
    `📊 *VASP Tracker — Daily Audit*`,
    `_${date}_`,
    ``,
    `*Pipeline:*`,
    `  Entities: *${m.totalEntities.toLocaleString()}* total, *${m.nonGarbage.toLocaleString()}* clean`,
    `  Website: *${m.withWebsite.toLocaleString()}* (${pct(m.withWebsite, m.totalEntities)})`,
    `  Enriched: *${m.enriched.toLocaleString()}* (${pct(m.enriched, m.nonGarbage)} of clean)`,
    `  DNS: ${m.dnsAlive.toLocaleString()} alive, ${m.dnsDead.toLocaleString()} dead`,
    ``,
    `*Classification:*`,
    `  🟢 Crypto: ${m.cryptoConfirmed.toLocaleString()}`,
    `  🔵 TradFi: ${m.traditional.toLocaleString()}`,
    `  ⚪ Unknown: ${m.cryptoUnknown.toLocaleString()}`,
    ``,
  ];

  if (criticals.length > 0) {
    lines.push(`🔴 *CRITICAL (${criticals.length}):*`);
    for (const c of criticals) lines.push(`  • ${c.title}`);
    lines.push('');
  }

  if (warnings.length > 0) {
    lines.push(`🟡 *Warnings (${warnings.length}):*`);
    for (const w of warnings) lines.push(`  • ${w.title}`);
    lines.push('');
  }

  lines.push(`*Parsers:*`);
  lines.push(`  ✅ ${okParsers.length} ok`);
  if (broken.length > 0) {
    lines.push(`  🔴 ${broken.length} broken (0 entities):`);
    for (const p of broken.slice(0, 6)) lines.push(`    • ${p.registryId}`);
    if (broken.length > 6) lines.push(`    _... and ${broken.length - 6} more_`);
  }
  if (anomalies.length > 0) {
    lines.push(`  🟠 ${anomalies.length} anomaly-blocked (data changed, review needed)`);
  }

  lines.push('');
  lines.push(`*Gaps:*`);
  lines.push(`  📭 No website: ${m.noWebsite.toLocaleString()}`);
  lines.push(`  📝 Not enriched: ${m.noDescription.toLocaleString()}`);
  if (m.registryUrlInWebsite > 0) {
    lines.push(`  ⚠️ Registry URL as website: ${m.registryUrlInWebsite}`);
  }

  await sendTelegramDirect(lines.join('\n'));
}

/* ── Entry ── */

main()
  .then(() => process.exit(0))
  .catch(async (err) => {
    logger.error(SCOPE, `Fatal: ${err.message}`);
    await sendTelegramAlert(SCOPE, `Quality audit FAILED: ${err.message}`);
    process.exit(1);
  });
