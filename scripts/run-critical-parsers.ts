/**
 * Run critical parser set in one command.
 *
 * Usage:
 *   npx tsx scripts/run-critical-parsers.ts
 *   npx tsx scripts/run-critical-parsers.ts --dry-run --no-notion
 *   npx tsx scripts/run-critical-parsers.ts --with-quality
 */

import { execSync } from 'node:child_process';

const CRITICAL_PARSERS = [
  'gb-fca',
  'sg-mas',
  'au-austrac',
  'us-fincen',
  'it-oam-vasp',
  'ch-vqf',
  'ch-sofit',
] as const;

function hasFlag(flag: string): boolean {
  return process.argv.slice(2).includes(flag);
}

function run(cmd: string): boolean {
  try {
    execSync(cmd, { stdio: 'inherit', cwd: process.cwd(), env: { ...process.env } });
    return true;
  } catch {
    return false;
  }
}

function main() {
  const dryRun = hasFlag('--dry-run');
  const noNotion = hasFlag('--no-notion');
  const withQuality = hasFlag('--with-quality');

  const commonFlags = `${dryRun ? ' --dry-run' : ''}${noNotion ? ' --no-notion' : ''}`;

  let ok = 0;
  for (const parserId of CRITICAL_PARSERS) {
    console.log(`\n${'='.repeat(72)}`);
    console.log(`CRITICAL PARSER: ${parserId}`);
    console.log(`${'='.repeat(72)}\n`);

    const cmd = `npx tsx parsers/run.ts --registry ${parserId}${commonFlags}`;
    const success = run(cmd);
    if (success) ok += 1;
  }

  if (withQuality) {
    console.log(`\n${'='.repeat(72)}`);
    console.log('QUALITY WORKER');
    console.log(`${'='.repeat(72)}\n`);
    run(`npx tsx workers/quality/run.ts --limit 10000${dryRun ? ' --dry-run' : ''}`);
  }

  console.log(`\n${'='.repeat(72)}`);
  console.log(`DONE: ${ok}/${CRITICAL_PARSERS.length} critical parsers succeeded`);
  console.log(`${'='.repeat(72)}\n`);

  if (ok < CRITICAL_PARSERS.length) process.exit(1);
}

main();

