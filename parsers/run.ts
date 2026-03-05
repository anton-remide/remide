/**
 * CLI entry point for running parsers.
 *
 * Usage:
 *   npx tsx parsers/run.ts --registry za-fsca
 *   npx tsx parsers/run.ts --registry all
 *   npx tsx parsers/run.ts --registry za-fsca --dry-run
 *   npx tsx parsers/run.ts --list
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { logger, sendTelegramAlert } from './core/logger.js';
import { getEntityCount, upsertEntities, logScrapeRun, isDryRun } from './core/db.js';
import { verify } from './core/validator.js';
import { isNotionEnabled, upsertEntitiesToNotion, updateJurisdictionCount } from './core/notion.js';
import type { RegistryParser, ScrapeRun } from './core/types.js';

// Import all registry parsers
import { ZaFscaParser } from './registries/za-fsca.js';
import { JpFsaParser } from './registries/jp-fsa.js';
import { FrAmfParser } from './registries/fr-amf.js';
import { DeBafinParser } from './registries/de-bafin.js';
import { AuAustracParser } from './registries/au-austrac.js';
import { SgMasParser } from './registries/sg-mas.js';
import { NlDnbParser } from './registries/nl-dnb.js';
import { ChFinmaParser } from './registries/ch-finma.js';
import { CaFintracParser } from './registries/ca-fintrac.js';
import { GbFcaParser } from './registries/gb-fca.js';
import { UsFincenParser } from './registries/us-fincen.js';
import { AeVaraParser } from './registries/ae-vara.js';

// Tier 2: ESMA-based EU parsers
import { ItConsobParser } from './registries/it-consob.js';
import { EsCnmvParser } from './registries/es-cnmv.js';
import { AtFmaParser } from './registries/at-fma.js';
import { IeCbiParser } from './registries/ie-cbi.js';
import { PtCmvmParser } from './registries/pt-cmvm.js';
import { LuCssfParser } from './registries/lu-cssf.js';
import { BeFsmaParser } from './registries/be-fsma.js';
import { MtMfsaParser } from './registries/mt-mfsa.js';
import { LtBolParser } from './registries/lt-bol.js';
import { EeFsaParser } from './registries/ee-fsa.js';
import { PlKnfParser } from './registries/pl-knf.js';
import { CzCnbParser } from './registries/cz-cnb.js';
import { CyCysecParser } from './registries/cy-cysec.js';
import { SeFiParser } from './registries/se-fi.js';
import { FiFinfsaParser } from './registries/fi-finfsa.js';
import { DkDfsaParser } from './registries/dk-dfsa.js';
import { NoFsaParser } from './registries/no-fsa.js';

// ESMA Unified (all MiCA register types)
import { EsmaUnifiedParser } from './registries/esma-unified.js';

// EBA EUCLID (EU Payment Institutions Register)
import { EbaEuclidParser } from './registries/eba-euclid.js';

// Tier 3: Non-EU Wave 2 parsers
import { ThSecParser } from './registries/th-sec.js';
import { MyScParser } from './registries/my-sc.js';
import { ScFsaParser } from './registries/sc-fsa.js';
import { GiGfscParser } from './registries/gi-gfsc.js';
import { ImFsaParser } from './registries/im-fsa.js';

// Tier 3: Wave 3 — Medium-tier parsers
import { LiFmaParser } from './registries/li-fma.js';
import { TwFscParser } from './registries/tw-fsc.js';
import { KyCimaParser } from './registries/ky-cima.js';
import { IdOjkParser } from './registries/id-ojk.js';

// Tier 4: Wave 4 — US, UK, APAC, LatAm, Africa parsers
import { UsNydfsParser } from './registries/us-nydfs.js';
import { UsFdicParser } from './registries/us-fdic.js';
import { HkSfcParser } from './registries/hk-sfc.js';
import { BrBcbParser } from './registries/br-bcb.js';
import { NgSecParser } from './registries/ng-sec.js';
import { SvCnadParser } from './registries/sv-cnad.js';
import { KrFiuParser } from './registries/kr-fiu.js';
import { GbPraParser } from './registries/gb-pra.js';
import { PhBspParser } from './registries/ph-bsp.js';
import { ArCnvParser } from './registries/ar-cnv.js';

/** Registry of all available parsers */
const PARSERS: Record<string, () => RegistryParser> = {
  // Tier 1
  'za-fsca': () => new ZaFscaParser(),
  'jp-fsa': () => new JpFsaParser(),
  'fr-amf': () => new FrAmfParser(),
  'de-bafin': () => new DeBafinParser(),
  'au-austrac': () => new AuAustracParser(),
  'sg-mas': () => new SgMasParser(),
  'nl-dnb': () => new NlDnbParser(),
  'ch-finma': () => new ChFinmaParser(),
  'ca-fintrac': () => new CaFintracParser(),
  'gb-fca': () => new GbFcaParser(),
  'us-fincen': () => new UsFincenParser(),
  'ae-vara': () => new AeVaraParser(),
  // Tier 2: ESMA EU countries
  'it-consob': () => new ItConsobParser(),
  'es-cnmv': () => new EsCnmvParser(),
  'at-fma': () => new AtFmaParser(),
  'ie-cbi': () => new IeCbiParser(),
  'pt-cmvm': () => new PtCmvmParser(),
  'lu-cssf': () => new LuCssfParser(),
  'be-fsma': () => new BeFsmaParser(),
  'mt-mfsa': () => new MtMfsaParser(),
  'lt-bol': () => new LtBolParser(),
  'ee-fsa': () => new EeFsaParser(),
  'pl-knf': () => new PlKnfParser(),
  'cz-cnb': () => new CzCnbParser(),
  'cy-cysec': () => new CyCysecParser(),
  'se-fi': () => new SeFiParser(),
  'fi-finfsa': () => new FiFinfsaParser(),
  'dk-dfsa': () => new DkDfsaParser(),
  'no-fsa': () => new NoFsaParser(),
  // ESMA Unified (replaces per-country EU parsers)
  'esma-unified': () => new EsmaUnifiedParser(),
  // EBA EUCLID (EU Payment Institutions Register)
  'eba-euclid': () => new EbaEuclidParser(),
  // Tier 3: Non-EU Wave 2
  'th-sec': () => new ThSecParser(),
  'my-sc': () => new MyScParser(),
  'sc-fsa': () => new ScFsaParser(),
  'gi-gfsc': () => new GiGfscParser(),
  'im-fsa': () => new ImFsaParser(),
  // Tier 3: Wave 3 — Medium-tier parsers
  'li-fma': () => new LiFmaParser(),
  'tw-fsc': () => new TwFscParser(),
  'ky-cima': () => new KyCimaParser(),
  'id-ojk': () => new IdOjkParser(),
  // Tier 4: Wave 4 — US, UK, APAC, LatAm, Africa
  'us-nydfs': () => new UsNydfsParser(),
  'us-fdic': () => new UsFdicParser(),
  'hk-sfc': () => new HkSfcParser(),
  'br-bcb': () => new BrBcbParser(),
  'ng-sec': () => new NgSecParser(),
  'sv-cnad': () => new SvCnadParser(),
  'kr-fiu': () => new KrFiuParser(),
  'gb-pra': () => new GbPraParser(),
  'ph-bsp': () => new PhBspParser(),
  'ar-cnv': () => new ArCnvParser(),
};

/** Run a single parser */
async function runParser(parser: RegistryParser): Promise<void> {
  const { id, countryCode } = parser.config;
  const dryRun = isDryRun();

  logger.info(id, `Starting parser${dryRun ? ' (DRY RUN)' : ''}`);
  const startTime = Date.now();

  try {
    // 1. Parse
    const result = await parser.parse();
    const durationMs = Date.now() - startTime;

    logger.info(id, `Parsed ${result.entities.length} entities in ${(durationMs / 1000).toFixed(1)}s`);

    if (result.warnings.length > 0) {
      logger.warn(id, `Warnings: ${result.warnings.join('; ')}`);
    }

    // 2. Verify
    const previousCount = dryRun ? 0 : await getEntityCount(countryCode);
    const verification = await verify(result, previousCount);

    if (!verification.valid) {
      logger.warn(id, `Verification issues: ${verification.schemaErrors.length} schema errors, anomaly=${verification.anomaly}`);
      if (verification.schemaErrors.length > 0) {
        logger.warn(id, `Schema errors: ${verification.schemaErrors.slice(0, 5).join('; ')}${verification.schemaErrors.length > 5 ? `... (+${verification.schemaErrors.length - 5} more)` : ''}`);
      }
    }

    // 3. Write to DB (unless dry-run or anomaly)
    // Schema errors on individual entities are non-fatal — we filter out bad entities
    // Only block writes on anomaly (large delta)
    let inserted = 0;
    let writeErrors: string[] = [];
    const forceMode = process.env.FORCE_WRITE === 'true';
    const canWrite = !dryRun && (!verification.anomaly || forceMode) && result.entities.length > 0;
    if (forceMode && verification.anomaly) {
      logger.warn(id, `FORCE: ignoring anomaly (delta ${verification.deltaPercent.toFixed(1)}%)`);
    }

    if (canWrite) {
      // Filter out entities with missing required fields
      const validEntities = result.entities.filter(
        (e) => e.name?.trim() && e.licenseNumber?.trim() && e.countryCode?.length === 2
      );
      const skipped = result.entities.length - validEntities.length;
      if (skipped > 0) {
        logger.warn(id, `Filtered out ${skipped} invalid entities (missing name/license/country)`);
      }

      const cleanResult = { ...result, entities: validEntities };
      const writeResult = await upsertEntities(cleanResult);
      inserted = writeResult.inserted;
      writeErrors = writeResult.errors;
    } else if (dryRun) {
      logger.info(id, `DRY RUN: would upsert ${result.entities.length} entities`);
    } else if (verification.anomaly) {
      logger.error(id, `BLOCKED: anomaly detected (delta ${verification.deltaPercent.toFixed(1)}%), skipping write`);
      await sendTelegramAlert(id, `Write blocked: anomaly ${verification.deltaPercent.toFixed(1)}% delta`);
    }

    // 3b. Write to Notion (dual-write, non-blocking on error)
    if (canWrite && isNotionEnabled()) {
      try {
        const cleanResult = { ...result, entities: result.entities.filter(
          (e) => e.name?.trim() && e.licenseNumber?.trim() && e.countryCode?.length === 2
        )};
        const notionResult = await upsertEntitiesToNotion(cleanResult);
        logger.info(id, `[Notion] ${notionResult.inserted} entities written`);

        // Update jurisdiction entity count
        await updateJurisdictionCount(countryCode, notionResult.inserted);
      } catch (notionErr) {
        // Non-fatal: Notion failures should not block the pipeline
        logger.warn(id, `[Notion] Write failed (non-fatal): ${notionErr instanceof Error ? notionErr.message : String(notionErr)}`);
      }
    }

    // 4. Log scrape run
    const runStatus = verification.anomaly ? 'error' : (
      writeErrors.length > 0 ? 'partial' : (
        inserted > 0 ? 'success' : (result.entities.length > 0 ? 'partial' : 'error')
      )
    );
    const scrapeRun: ScrapeRun = {
      registry_id: id,
      status: runStatus,
      entities_found: result.entities.length,
      entities_new: inserted,
      entities_updated: 0,
      entities_removed: 0,
      duration_ms: durationMs,
      error_message: writeErrors.length > 0 ? writeErrors.join('; ') : null,
      warnings: result.warnings,
      delta_percent: verification.deltaPercent,
      timestamp: new Date().toISOString(),
    };

    if (!dryRun) {
      await logScrapeRun(scrapeRun);
    }

    logger.info(id, `Done: ${result.entities.length} found, ${inserted} upserted, delta=${verification.deltaPercent.toFixed(1)}%`);
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const message = err instanceof Error ? err.message : String(err);

    logger.error(id, `Parser failed: ${message}`);
    await sendTelegramAlert(id, `Parser failed: ${message}`);

    if (!dryRun) {
      await logScrapeRun({
        registry_id: id,
        status: 'error',
        entities_found: 0,
        entities_new: 0,
        entities_updated: 0,
        entities_removed: 0,
        duration_ms: durationMs,
        error_message: message,
        warnings: [],
        delta_percent: 0,
        timestamp: new Date().toISOString(),
      });
    }
  }
}

/** Main CLI entry */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--list')) {
    console.log('Available parsers:');
    for (const [id, factory] of Object.entries(PARSERS)) {
      const p = factory();
      console.log(`  ${id.padEnd(15)} ${p.config.name} (${p.config.countryCode}, ${p.config.sourceType})`);
    }
    return;
  }

  const registryIdx = args.indexOf('--registry');
  if (registryIdx === -1 || !args[registryIdx + 1]) {
    console.error('Usage: npx tsx parsers/run.ts --registry <id|all> [--dry-run]');
    console.error('       npx tsx parsers/run.ts --list');
    process.exit(1);
  }

  if (args.includes('--dry-run')) {
    process.env.DRY_RUN = 'true';
  }

  if (args.includes('--force')) {
    process.env.FORCE_WRITE = 'true';
    logger.info('runner', 'FORCE mode: anomaly detection disabled');
  }

  if (args.includes('--no-notion')) {
    delete process.env.NOTION_TOKEN;
    delete process.env.NOTION_API_KEY;
    logger.info('runner', 'Notion writes disabled by --no-notion flag');
  }

  // Log Notion status
  if (isNotionEnabled()) {
    logger.info('runner', 'Notion dual-write: ENABLED');
  } else {
    logger.info('runner', 'Notion dual-write: disabled (no NOTION_TOKEN)');
  }

  const registryId = args[registryIdx + 1];

  if (registryId === 'all') {
    logger.info('runner', `Running all ${Object.keys(PARSERS).length} parsers`);
    for (const [id, factory] of Object.entries(PARSERS)) {
      try {
        await runParser(factory());
      } catch (err) {
        logger.error(id, `Unhandled error: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } else {
    const factory = PARSERS[registryId];
    if (!factory) {
      console.error(`Unknown registry: ${registryId}`);
      console.error(`Available: ${Object.keys(PARSERS).join(', ')}`);
      process.exit(1);
    }
    await runParser(factory());
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
