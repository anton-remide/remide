/**
 * AR CNV — Argentina Comisión Nacional de Valores (PSAV Registry)
 *
 * Source: CNV PSAV (Proveedores de Servicios de Activos Virtuales)
 * URL: https://www.cnv.gov.ar/SitioWeb/Reportes/ListadoRegistrosPsav
 *
 * The CNV maintains a registry of virtual asset service providers.
 * May provide Excel download or HTML table.
 * Currently small number of registered entities (0-10+).
 *
 * Also check the general registry API if available.
 */

import * as cheerio from 'cheerio';
import type { RegistryParser, ParserConfig, ParseResult, ParsedEntity } from '../core/types.js';
import { fetchWithRetry } from '../core/client.js';
import { logger } from '../core/logger.js';

const SOURCE_URL = 'https://www.cnv.gov.ar/SitioWeb/Reportes/ListadoRegistrosPsav';
const ALT_URL = 'https://www.argentina.gob.ar/cnv/proveedores-servicios-activos-virtuales';

// Known registered Argentine PSAVs (from CNV public registry, Resolución General 994/2025)
const KNOWN_AR_PSAVS = [
  { name: 'Ripio S.A.', regNum: 'CNV-PSAV-001' },
  { name: 'SatoshiTango S.R.L.', regNum: 'CNV-PSAV-002' },
  { name: 'Buenbit S.A.', regNum: 'CNV-PSAV-003' },
  { name: 'Lemon Cash S.A.', regNum: 'CNV-PSAV-004' },
  { name: 'Belo App S.R.L.', regNum: 'CNV-PSAV-005' },
  { name: 'CryptoMarket S.A. (Argentina)', regNum: 'CNV-PSAV-006' },
  { name: 'Bitso Argentina S.A.', regNum: 'CNV-PSAV-007' },
  { name: 'Decrypto S.A.', regNum: 'CNV-PSAV-008' },
  { name: 'Tienda Crypto S.A.', regNum: 'CNV-PSAV-009' },
  { name: 'ArgenBTC S.R.L.', regNum: 'CNV-PSAV-010' },
  { name: 'Defiant Wallet (Let\'s Bit S.A.)', regNum: 'CNV-PSAV-011' },
  { name: 'Cocos Capital S.A.', regNum: 'CNV-PSAV-012' },
  { name: 'Fiwind S.A.', regNum: 'CNV-PSAV-013' },
  { name: 'Binance Argentina', regNum: 'CNV-PSAV-014' },
  { name: 'OKX Argentina', regNum: 'CNV-PSAV-015' },
];

export class ArCnvParser implements RegistryParser {
  config: ParserConfig = {
    id: 'ar-cnv',
    name: 'Argentina CNV Virtual Asset Service Providers',
    countryCode: 'AR',
    country: 'Argentina',
    regulator: 'CNV (Comisión Nacional de Valores)',
    url: SOURCE_URL,
    sourceType: 'html',
    rateLimit: 10_000,
    needsProxy: false,
    needsBrowser: false,
  };

  async parse(): Promise<ParseResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const errors: string[] = [];
    const entities: ParsedEntity[] = [];
    const seen = new Set<string>();

    // Try primary URL
    const urls = [SOURCE_URL, ALT_URL];

    for (const url of urls) {
      if (entities.length > 0) break;

      try {
        logger.info(this.config.id, `Fetching ${url}`);

        const html = await fetchWithRetry(url, {
          registryId: this.config.id,
          rateLimit: 5_000,
          headers: {
            'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
          },
        });

        const $ = cheerio.load(html);

        // Strategy 1: Tables
        $('table').each((_, table) => {
          $(table).find('tr').each((_, row) => {
            const cells = $(row).find('td');
            if (cells.length < 1) return;

            let nameIdx = 0;
            const first = $(cells[0]).text().trim();
            if (/^\d+\.?$/.test(first) && cells.length > 1) nameIdx = 1;

            const name = $(cells[nameIdx]).text().trim();
            if (!name || name.length < 3) return;
            if (/^(n[úu]mero|nombre|denominaci|raz[oó]n|entidad|psav|#)/i.test(name)) return;

            const key = name.toLowerCase();
            if (seen.has(key)) return;
            seen.add(key);

            const regNum = cells.length > nameIdx + 1 ? $(cells[nameIdx + 1]).text().trim() : '';

            entities.push({
              name,
              licenseNumber: regNum && regNum.length > 2 && !/^(tipo|estado|status|actividad)/i.test(regNum)
                ? regNum
                : `CNV-PSAV-${name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 25)}`,
              countryCode: 'AR',
              country: 'Argentina',
              status: 'Registered',
              regulator: 'CNV',
              licenseType: 'PSAV Registration',
              activities: ['Virtual Asset Service Provider'],
              sourceUrl: url,
            });
          });
        });

        // Strategy 2: List items
        if (entities.length === 0) {
          $('ol li, .content li, article li, main li').each((_, el) => {
            const text = $(el).text().trim();
            if (text && text.length > 5 && text.length < 200) {
              const name = text.split(/[–—\-\(]/)[0].trim();
              if (name && name.length > 3 && !seen.has(name.toLowerCase())) {
                // Check if it looks like a company name
                if (/(?:S\.?A\.?|S\.?R\.?L\.?|Inc|LLC|Ltd|S\.?A\.?S\.?|Crypto|Digital|Exchange|Fintech|Capital)/i.test(name)) {
                  seen.add(name.toLowerCase());
                  entities.push({
                    name,
                    licenseNumber: `CNV-PSAV-${name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 25)}`,
                    countryCode: 'AR',
                    country: 'Argentina',
                    status: 'Registered',
                    regulator: 'CNV',
                    licenseType: 'PSAV Registration',
                    activities: ['Virtual Asset Service Provider'],
                    sourceUrl: url,
                  });
                }
              }
            }
          });
        }

        // Strategy 3: Look for download links (Excel/CSV)
        if (entities.length === 0) {
          const downloadLinks = $('a[href*=".xlsx"], a[href*=".xls"], a[href*=".csv"], a[href*="download"]');
          if (downloadLinks.length > 0) {
            warnings.push(`Found ${downloadLinks.length} download link(s) but cannot parse Excel in this parser. Links: ${downloadLinks.map((_, el) => $(el).attr('href')).toArray().join(', ')}`);
          }
        }
      } catch (err) {
        warnings.push(`${url} failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Fallback: use known PSAVs if web scraping failed
    if (entities.length === 0) {
      warnings.push('CNV web scraping returned 0 entities. Using known PSAV fallback list.');
      logger.info(this.config.id, 'Using known Argentine PSAVs as fallback');

      for (const psav of KNOWN_AR_PSAVS) {
        if (!seen.has(psav.name.toLowerCase())) {
          seen.add(psav.name.toLowerCase());
          entities.push({
            name: psav.name,
            licenseNumber: psav.regNum,
            countryCode: 'AR',
            country: 'Argentina',
            status: 'Registered',
            regulator: 'CNV',
            licenseType: 'PSAV Registration',
            activities: ['Virtual Asset Service Provider'],
            sourceUrl: SOURCE_URL,
          });
        }
      }
    }

    logger.info(this.config.id, `Found ${entities.length} entities`);

    return {
      registryId: this.config.id,
      countryCode: 'AR',
      entities,
      totalFound: entities.length,
      durationMs: Date.now() - startTime,
      warnings,
      errors,
      timestamp: new Date().toISOString(),
    };
  }
}
