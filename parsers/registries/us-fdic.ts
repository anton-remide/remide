/**
 * US FDIC — BankFind Suite (FDIC-Insured Banking Institutions)
 *
 * Source: FDIC BankFind API
 * URL: https://banks.data.fdic.gov/api/
 *
 * Free JSON API, no authentication needed.
 * Returns all FDIC-insured banking institutions.
 * ~4,300+ active institutions.
 *
 * We filter to:
 * - Active institutions only (REPDTE = most recent)
 * - Focus on commercial banks, savings banks, and industrial banks
 * - Include institution name, CERT number, city, state, website
 */

import type { RegistryParser, ParserConfig, ParseResult, ParsedEntity } from '../core/types.js';
import { fetchJsonWithRetry } from '../core/client.js';
import { logger } from '../core/logger.js';

const API_BASE = 'https://banks.data.fdic.gov/api';
const SOURCE_URL = 'https://www.fdic.gov/bank/individual/';

interface FdicResponse {
  data: Array<{
    data: {
      CERT?: number;
      NAME?: string;
      CITY?: string;
      STALP?: string;
      WEBADDR?: string;
      SPECGRP?: number;
      SPECGRPN?: string;
      BKCLASS?: string;
      REGAGNT?: string;
      CHRTAGNT?: string;
      STNAME?: string;
    };
  }>;
  totals?: {
    count?: number;
  };
  meta?: {
    total?: number;
  };
}

export class UsFdicParser implements RegistryParser {
  config: ParserConfig = {
    id: 'us-fdic',
    name: 'US FDIC Insured Banking Institutions',
    countryCode: 'US',
    country: 'United States',
    regulator: 'FDIC (Federal Deposit Insurance Corporation)',
    url: SOURCE_URL,
    sourceType: 'api',
    rateLimit: 2_000,
    needsProxy: false,
    needsBrowser: false,
  };

  async parse(): Promise<ParseResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const errors: string[] = [];
    const entities: ParsedEntity[] = [];
    const seen = new Set<string>();

    try {
      logger.info(this.config.id, 'Fetching FDIC institutions via BankFind API');

      // Fetch active institutions in batches
      const batchSize = 1000;
      let offset = 0;
      let total = 0;
      let hasMore = true;

      while (hasMore && offset < 10000) {
        // Filter: active institutions, fields we need
        const url = `${API_BASE}/institutions?filters=ACTIVE%3A1&fields=CERT,NAME,CITY,STALP,WEBADDR,SPECGRP,SPECGRPN,BKCLASS,REGAGNT,CHRTAGNT,STNAME&sort_by=ASSET&sort_order=DESC&limit=${batchSize}&offset=${offset}`;

        logger.info(this.config.id, `Fetching batch offset=${offset}...`);

        const response = await fetchJsonWithRetry<FdicResponse>(url, {
          registryId: this.config.id,
          rateLimit: 1_500,
          headers: {
            Accept: 'application/json',
          },
        });

        if (!response.data || !Array.isArray(response.data)) {
          warnings.push(`Unexpected response at offset ${offset}`);
          break;
        }

        if (total === 0) {
          total = response.meta?.total || response.totals?.count || 0;
          logger.info(this.config.id, `Total institutions: ${total}`);
        }

        for (const item of response.data) {
          const d = item.data;
          const name = d.NAME?.trim?.() || '';
          const cert = String(d.CERT || '');

          if (!name || !cert) continue;

          const key = cert;
          if (seen.has(key)) continue;
          seen.add(key);

          // Map bank class to license type
          const bkclass = d.BKCLASS?.trim?.() || '';
          const specgrpn = d.SPECGRPN?.trim?.() || '';
          let licenseType = 'FDIC-Insured Bank';
          const activities: string[] = ['Banking', 'Deposit Taking'];

          if (/commercial/i.test(specgrpn)) {
            licenseType = 'Commercial Bank';
          } else if (/savings/i.test(specgrpn) || bkclass === 'SB' || bkclass === 'SL') {
            licenseType = 'Savings Bank';
            activities.push('Savings');
          } else if (bkclass === 'NM' || bkclass === 'N') {
            licenseType = 'National Bank';
          } else if (bkclass === 'SM' || bkclass === 'SA') {
            licenseType = 'State Bank';
          }

          // Determine regulator
          const regulator = d.REGAGNT?.trim?.() || d.CHRTAGNT?.trim?.() || 'FDIC';

          const website = d.WEBADDR?.trim?.() || '';
          const state = d.STNAME?.trim?.() || d.STALP?.trim?.() || '';

          entities.push({
            name,
            licenseNumber: `FDIC-${cert}`,
            countryCode: 'US',
            country: 'United States',
            status: 'Active',
            regulator: regulator || 'FDIC',
            licenseType,
            activities,
            entityTypes: [specgrpn, bkclass].filter(Boolean),
            website: website && (website.startsWith('http') || website.includes('.'))
              ? (website.startsWith('http') ? website : `https://${website}`)
              : undefined,
            sourceUrl: SOURCE_URL,
          });
        }

        offset += batchSize;
        hasMore = response.data.length === batchSize;

        logger.info(this.config.id, `Batch done: ${entities.length} entities so far`);
      }

      if (entities.length === 0) {
        warnings.push('FDIC API returned 0 entities. API may be temporarily down.');
      }

      logger.info(this.config.id, `Total: ${entities.length} FDIC-insured institutions`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`FDIC API failed: ${msg}`);
      logger.error(this.config.id, msg);
    }

    return {
      registryId: this.config.id,
      countryCode: 'US',
      entities,
      totalFound: entities.length,
      durationMs: Date.now() - startTime,
      warnings,
      errors,
      timestamp: new Date().toISOString(),
    };
  }
}
