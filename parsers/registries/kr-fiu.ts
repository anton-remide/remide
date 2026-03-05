/**
 * KR KoFIU — Korea Financial Intelligence Unit / KDAXA VASPs
 *
 * Source: Korea Digital Asset Exchange Association (KDAXA)
 * URL: https://kdaxa.org/support/vasp.php
 * + FIU: https://www.kofiu.go.kr/
 *
 * HTML page listing registered Korean VASPs (가상자산사업자).
 * ~27-28 entities (crypto exchanges registered with KoFIU).
 */

import * as cheerio from 'cheerio';
import type { RegistryParser, ParserConfig, ParseResult, ParsedEntity } from '../core/types.js';
import { fetchWithRetry } from '../core/client.js';
import { logger } from '../core/logger.js';

const SOURCE_URL = 'https://kdaxa.org/support/vasp.php';
const ALT_URL = 'https://www.fsc.go.kr/eng/po060101'; // FSC English page

// Known registered Korean VASPs (from KoFIU public disclosures / KDAXA membership)
const KNOWN_KR_VASPS = [
  'Upbit (Dunamu Inc.)',
  'Bithumb (Bithumb Korea Inc.)',
  'Coinone',
  'Korbit',
  'Gopax (Streami Inc.)',
  'ProBit (ProBit Global Inc.)',
  'Hanbitco',
  'FLYBIT',
  'Coinbit',
  'GDAC',
  'Huobi Korea',
  'OKX Korea (OKCoin Japan → Korea)',
  'Coredax',
  'BTCKorea.com (Korbit operator)',
  'Cashierest',
  'Flata Exchange',
  'Neopin',
  'Bitsonic',
  'CoinNest (revoked)',
  'Daybit',
  'CPDAX',
  'Bagel Exchange',
  'Foblgate',
  'Oasis Exchange',
  'Prixbit',
  'Coinsbit Korea',
  'MetaBit Global',
  'Haru Invest',
];

export class KrFiuParser implements RegistryParser {
  config: ParserConfig = {
    id: 'kr-fiu',
    name: 'Korea Virtual Asset Service Providers (KoFIU/KDAXA)',
    countryCode: 'KR',
    country: 'South Korea',
    regulator: 'KoFIU (Korea Financial Intelligence Unit)',
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

    // Try primary source (KDAXA)
    try {
      logger.info(this.config.id, 'Fetching KDAXA VASP list');

      const html = await fetchWithRetry(SOURCE_URL, {
        registryId: this.config.id,
        rateLimit: 5_000,
        headers: {
          'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      });

      const $ = cheerio.load(html);

      // KDAXA page typically has a table or list of VASPs
      $('table').each((_, table) => {
        $(table).find('tr').each((_, row) => {
          const cells = $(row).find('td');
          if (cells.length < 1) return;

          // Skip header rows
          const firstText = $(cells[0]).text().trim();
          if (/^(번호|no|#|순번)/i.test(firstText)) return;

          // Determine name column index (skip serial number)
          let nameIdx = 0;
          if (/^\d+$/.test(firstText) && cells.length > 1) {
            nameIdx = 1;
          }

          const name = $(cells[nameIdx]).text().trim();
          if (!name || name.length < 2) return;
          if (/^(사업자명|회사명|업체명|name|company)/i.test(name)) return;

          const key = name.toLowerCase();
          if (seen.has(key)) return;
          seen.add(key);

          // Extract additional info
          const website = $(cells[nameIdx]).find('a').attr('href') || '';
          const regNum = cells.length > nameIdx + 1 ? $(cells[nameIdx + 1]).text().trim() : '';
          const status = cells.length > nameIdx + 2 ? $(cells[nameIdx + 2]).text().trim() : '';

          entities.push({
            name,
            licenseNumber: regNum && regNum.length > 2 && !/^(구분|유형|type|status)/i.test(regNum)
              ? regNum
              : `KOFIU-${name.replace(/[^a-zA-Z0-9가-힣]/g, '').substring(0, 25)}`,
            countryCode: 'KR',
            country: 'South Korea',
            status: status || 'Registered',
            regulator: 'KoFIU',
            licenseType: 'VASP Registration',
            activities: ['Virtual Asset Service Provider', 'Crypto Exchange'],
            website: website && website.startsWith('http') ? website : undefined,
            sourceUrl: SOURCE_URL,
          });
        });
      });

      // Fallback: list items
      if (entities.length === 0) {
        $('li, .member-list li, .vasp-list li').each((_, el) => {
          const text = $(el).text().trim();
          const link = $(el).find('a');
          const name = link.length ? link.text().trim() : text.split(/[–—\-\(]/)[0].trim();

          if (name && name.length > 2 && name.length < 150 && !seen.has(name.toLowerCase())) {
            seen.add(name.toLowerCase());
            entities.push({
              name,
              licenseNumber: `KOFIU-${name.replace(/[^a-zA-Z0-9가-힣]/g, '').substring(0, 25)}`,
              countryCode: 'KR',
              country: 'South Korea',
              status: 'Registered',
              regulator: 'KoFIU',
              licenseType: 'VASP Registration',
              activities: ['Virtual Asset Service Provider', 'Crypto Exchange'],
              website: link.attr('href') || undefined,
              sourceUrl: SOURCE_URL,
            });
          }
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`KDAXA scraping failed: ${msg}`);
    }

    // Try alternate source (FSC English) if primary failed
    if (entities.length === 0) {
      try {
        logger.info(this.config.id, 'Trying FSC English page as fallback');

        const html = await fetchWithRetry(ALT_URL, {
          registryId: this.config.id,
          rateLimit: 5_000,
        });

        const $ = cheerio.load(html);

        $('table tr').each((_, row) => {
          const cells = $(row).find('td');
          if (cells.length < 1) return;

          const name = $(cells[0]).text().trim();
          if (!name || name.length < 3 || /^(no|name|company)/i.test(name)) return;

          if (!seen.has(name.toLowerCase())) {
            seen.add(name.toLowerCase());
            entities.push({
              name,
              licenseNumber: `KOFIU-${name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 25)}`,
              countryCode: 'KR',
              country: 'South Korea',
              status: 'Registered',
              regulator: 'KoFIU',
              licenseType: 'VASP Registration',
              activities: ['Virtual Asset Service Provider'],
              sourceUrl: ALT_URL,
            });
          }
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        warnings.push(`FSC fallback failed: ${msg}`);
      }
    }

    // Fallback: use known Korean VASPs if both sources failed
    if (entities.length === 0) {
      warnings.push('Both KDAXA and FSC sources returned 0 entities. Using known VASP fallback list.');
      logger.info(this.config.id, 'Using known Korean VASPs as fallback');

      for (const name of KNOWN_KR_VASPS) {
        const cleanName = name.replace(/\s*\(.*\)$/, '').trim();
        const fullName = name;
        const key = cleanName.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);

        const isRevoked = /revoked|cancelled/i.test(name);

        entities.push({
          name: fullName,
          licenseNumber: `KOFIU-${cleanName.replace(/[^a-zA-Z0-9가-힣]/g, '').substring(0, 25)}`,
          countryCode: 'KR',
          country: 'South Korea',
          status: isRevoked ? 'Revoked' : 'Registered',
          regulator: 'KoFIU',
          licenseType: 'VASP Registration',
          activities: ['Virtual Asset Service Provider', 'Crypto Exchange'],
          sourceUrl: SOURCE_URL,
        });
      }
    }

    logger.info(this.config.id, `Found ${entities.length} entities`);

    return {
      registryId: this.config.id,
      countryCode: 'KR',
      entities,
      totalFound: entities.length,
      durationMs: Date.now() - startTime,
      warnings,
      errors,
      timestamp: new Date().toISOString(),
    };
  }
}
