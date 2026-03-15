/**
 * Full Data Pipeline — runs Quality → DNS Verify → Enrichment in sequence.
 *
 * Usage:
 *   npx tsx scripts/pipeline.ts                    # Full pipeline
 *   npx tsx scripts/pipeline.ts --quality-only     # Just quality
 *   npx tsx scripts/pipeline.ts --skip-dns         # Skip DNS step
 *   npx tsx scripts/pipeline.ts --skip-enrichment  # Skip enrichment step
 *   npx tsx scripts/pipeline.ts --force            # Force re-process all
 *   DRY_RUN=true npx tsx scripts/pipeline.ts       # Dry run
 */

import { execSync } from 'child_process';

const STEPS = ['quality', 'dns', 'enrichment'] as const;

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    qualityOnly: args.includes('--quality-only'),
    skipDns: args.includes('--skip-dns'),
    skipEnrichment: args.includes('--skip-enrichment'),
    force: args.includes('--force'),
    dryRun: process.env.DRY_RUN === 'true',
  };
}

function runStep(name: string, command: string, dryRun: boolean) {
  const start = Date.now();
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  PIPELINE: Starting ${name}${dryRun ? ' [DRY RUN]' : ''}`);
  console.log(`${'═'.repeat(60)}\n`);

  try {
    execSync(command, {
      stdio: 'inherit',
      env: { ...process.env },
      cwd: process.cwd(),
    });
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`\n  ✓ ${name} completed in ${elapsed}s\n`);
    return true;
  } catch (err) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.error(`\n  ✗ ${name} failed after ${elapsed}s\n`);
    return false;
  }
}

function main() {
  const { qualityOnly, skipDns, skipEnrichment, force, dryRun } = parseArgs();
  const startTime = Date.now();

  console.log('\n' + '═'.repeat(60));
  console.log('  VASP TRACKER — DATA PIPELINE');
  console.log('═'.repeat(60));
  console.log(`  Time:   ${new Date().toISOString()}`);
  console.log(`  Mode:   ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`  Force:  ${force}`);
  console.log(`  Steps:  ${qualityOnly ? 'quality only' : STEPS.filter((_, i) => !(i === 1 && skipDns) && !(i === 2 && skipEnrichment)).join(' → ')}`);
  console.log('═'.repeat(60));

  const results: Record<string, boolean> = {};
  const forceFlag = force ? ' --force' : '';

  // Step 1: Quality Worker
  results.quality = runStep(
    'Quality Worker',
    `npx tsx workers/quality/run.ts --limit 10000${forceFlag}`,
    dryRun,
  );

  if (qualityOnly) {
    printSummary(results, startTime);
    return;
  }

  // Step 2: DNS Verify
  if (!skipDns) {
    results.dns = runStep(
      'DNS Verify',
      `npx tsx workers/verify/run.ts --limit 2000`,
      dryRun,
    );
  }

  // Step 3: Enrichment
  if (!skipEnrichment) {
    results.enrichment = runStep(
      'Enrichment (Firecrawl)',
      `npx tsx workers/enrichment/run.ts --limit 5000`,
      dryRun,
    );
  }

  printSummary(results, startTime);
}

function printSummary(results: Record<string, boolean>, startTime: number) {
  const totalMs = Date.now() - startTime;
  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;

  console.log('\n' + '═'.repeat(60));
  console.log('  PIPELINE SUMMARY');
  console.log('═'.repeat(60));
  for (const [step, ok] of Object.entries(results)) {
    console.log(`  ${ok ? '✓' : '✗'} ${step}`);
  }
  console.log(`\n  ${passed}/${total} steps succeeded in ${(totalMs / 1000).toFixed(0)}s`);
  console.log('═'.repeat(60) + '\n');

  if (passed < total) process.exit(1);
}

main();
