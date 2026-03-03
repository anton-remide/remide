/**
 * South Africa FSCA — Crypto Asset Service Providers (CASPs)
 *
 * Source: PDF published by FSCA (site redesigned 2025 — old URLs 404)
 * URL: https://www.fsca.co.za/ (list linked from homepage and Latest News)
 * The PDF contains a table of authorized/licensed CASPs (~300+ entities as of Dec 2025)
 * Format: PDF with structured table
 */

import type { RegistryParser, ParserConfig, ParseResult, ParsedEntity } from '../core/types.js';
import { logger } from '../core/logger.js';

/** FSCA pages where the PDF link may be published (site was redesigned in 2025) */
const FSCA_PAGE_URLS = [
  'https://www.fsca.co.za/',
  'https://www.fsca.co.za/Latest-News/',
  'https://www.fsca.co.za/Regulated-Entities/',
];

/** Known PDF URLs (FSCA updates the filename periodically; newest first) */
const PDF_URLS = [
  // New CMS API-style URL — "list of licensed crypto asset service providers" (2025+)
  'https://www.fsca.co.za/_api/cr3ad_newses(e8230219-bbdb-f011-8544-000d3ab44730)/cr3ad_document/$value',
  // December 2024 published list (248 approved)
  'https://www.fsca.co.za/Regulatory%20Frameworks/Documents/Published%20list%20of%20Authorised%20CASPs_18%20December%202024.pdf',
  // Generic "Published list of Licensed CASPs" (may be updated in-place)
  'https://www.fsca.co.za/Regulatory%20Frameworks/Documents/Published%20list%20of%20Licensed%20CASPs.pdf',
  // April 2024 list (75 approved) — fallback
  'https://www.fsca.co.za/Regulatory%20Frameworks/Documents/List%20of%20approved%20crypto%20asset%20service%20providers%20(CASPs).pdf',
  // www2 subdomain variant (referenced on FSCA homepage)
  'https://www2.fsca.co.za/Regulatory%20Frameworks/Documents/Published%20list%20of%20Authorised%20CASPs_18%20December%202024.pdf',
];

export class ZaFscaParser implements RegistryParser {
  config: ParserConfig = {
    id: 'za-fsca',
    name: 'South Africa FSCA Crypto Asset Service Providers',
    countryCode: 'ZA',
    country: 'South Africa',
    regulator: 'FSCA (Financial Sector Conduct Authority)',
    url: FSCA_PAGE_URLS[0],
    sourceType: 'pdf',
    rateLimit: 10_000,
    needsProxy: false,
    needsBrowser: false,
  };

  async parse(): Promise<ParseResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const errors: string[] = [];

    // Try to download PDF from known URLs
    let pdfBuffer: ArrayBuffer | null = null;
    let sourceUrl = '';

    for (const url of PDF_URLS) {
      try {
        logger.info(this.config.id, `Trying PDF: ${url}`);
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            Accept: 'application/pdf,*/*',
          },
        });

        if (response.ok) {
          pdfBuffer = await response.arrayBuffer();
          sourceUrl = url;
          logger.info(this.config.id, `Downloaded PDF: ${(pdfBuffer.byteLength / 1024).toFixed(1)} KB`);
          break;
        }
      } catch {
        logger.debug(this.config.id, `PDF not found at ${url}`);
      }
    }

    if (!pdfBuffer) {
      // Fallback: try to find the PDF link from the FSCA page
      try {
        const pageUrl = await this.findPdfUrl();
        if (pageUrl) {
          const response = await fetch(pageUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            },
          });
          if (response.ok) {
            pdfBuffer = await response.arrayBuffer();
            sourceUrl = pageUrl;
          }
        }
      } catch (err) {
        warnings.push(`Failed to find PDF link: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (!pdfBuffer) {
      throw new Error('Could not download FSCA CASP PDF from any known URL');
    }

    // Parse PDF
    const entities = await this.parsePdf(pdfBuffer, sourceUrl, warnings);
    logger.info(this.config.id, `Parsed ${entities.length} entities from PDF`);

    return {
      registryId: this.config.id,
      countryCode: 'ZA',
      entities,
      totalFound: entities.length,
      durationMs: Date.now() - startTime,
      warnings,
      errors,
      timestamp: new Date().toISOString(),
    };
  }

  /** Try to find the current PDF download link by scraping multiple FSCA pages */
  private async findPdfUrl(): Promise<string | null> {
    for (const pageUrl of FSCA_PAGE_URLS) {
      try {
        logger.debug(this.config.id, `Scanning page for PDF links: ${pageUrl}`);
        const response = await fetch(pageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          },
          signal: AbortSignal.timeout(15_000),
        });

        if (!response.ok) continue;

        const html = await response.text();

        // Look for PDF links containing CASP-related keywords
        const pdfPattern = /href="([^"]*(?:CASP|casp|Crypto|crypto|Authorised|Licensed|approved)[^"]*\.pdf)"/gi;
        let match;
        while ((match = pdfPattern.exec(html)) !== null) {
          const href = match[1];
          if (href.startsWith('http')) return href;
          if (href.startsWith('/')) return `https://www.fsca.co.za${href}`;
        }

        // Also look for the new API-style document URLs (cr3ad_newses)
        const apiPattern = /href="([^"]*_api\/cr3ad_newses[^"]*\$value)"/gi;
        while ((match = apiPattern.exec(html)) !== null) {
          const href = match[1];
          if (href.startsWith('http')) return href;
          if (href.startsWith('/')) return `https://www.fsca.co.za${href}`;
        }
      } catch {
        // Continue to next page
      }
    }
    return null;
  }

  /** Parse the FSCA PDF to extract entity data */
  private async parsePdf(buffer: ArrayBuffer, sourceUrl: string, warnings: string[]): Promise<ParsedEntity[]> {
    // pdf-parse v2 uses PDFParse class (v1 had default export function)
    const { PDFParse } = await import('pdf-parse');

    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const data = await parser.getText();
    const text: string = data.text;

    logger.info(this.config.id, `PDF text length: ${text.length} chars, ${data.total} pages`);

    const entities: ParsedEntity[] = [];
    const lines = text.split('\n').map((l: string) => l.trim()).filter(Boolean);

    // Dec 2025 PDF format:
    //   Section A: Licensed CASPs (numbered 1..N)
    //     "NO FSP_NUMBER COMPANY_NAME CAT_CATEGORY • Activities"
    //   Section B: CASPs with product categories removed
    //   Section C: Lapsed licences
    //   Section D: Provisionally withdrawn
    //
    // Company names sometimes wrap to the next line. Activities use "•" bullets.
    // FSP numbers are plain digits (e.g. 51867), not prefixed with "FSP".
    // CAT categories: "CAT I", "CAT I & II", "CAT I, II & IIA", etc.

    // Determine current section status for each entity
    type SectionStatus = 'Authorized' | 'Removed' | 'Lapsed' | 'Withdrawn';
    let currentSection: SectionStatus = 'Authorized';

    // Match rows: "NO FSP_NUMBER NAME ... CAT ..."
    // Pattern: starts with a row number, then FSP number (digits), then name, then CAT
    const rowPattern = /^(\d+)\s+(\d+)\s+(.+?)\s+(CAT\s+.*)$/;

    // Track to avoid spurious matches from page headers, footers, etc.
    const isSkipLine = (line: string): boolean => {
      const lower = line.toLowerCase();
      return (
        lower.startsWith('list of ') ||
        lower.startsWith('no.') ||
        lower.startsWith('no ') && lower.includes('fsp') ||
        lower.includes('page ') && lower.includes(' of ') ||
        lower.startsWith('-- ') ||
        lower.startsWith('fsp number') ||
        lower.startsWith('category') ||
        lower.startsWith('authorised') ||
        /^\d+ of \d+$/.test(lower.trim())
      );
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detect section transitions
      if (/^B\.\s+CASPs?\s+WITH\s+PRODUCT/i.test(line)) {
        currentSection = 'Removed';
        continue;
      }
      if (/^C\.\s+LICENCES?\s+THAT\s+HAVE\s+LAPSED/i.test(line)) {
        currentSection = 'Lapsed';
        continue;
      }
      if (/^D\.\s+LICENCES?\s+THAT\s+HAVE\s+BEEN\s+PROVISIONALLY\s+WITHDRAWN/i.test(line)) {
        currentSection = 'Withdrawn';
        continue;
      }

      if (isSkipLine(line)) continue;

      // Try to match a table row on this line
      let match = line.match(rowPattern);

      if (!match) {
        // Sometimes the name wraps: the row number + FSP number are on this line,
        // and the rest (name + CAT) continues on the next line(s).
        // Pattern: "NO FSP_NUMBER" then optional partial name
        const partialMatch = line.match(/^(\d+)\s+(\d+)\s*(.*)$/);
        if (partialMatch && !line.match(/^•/)) {
          const rowNum = partialMatch[1];
          const fsp = partialMatch[2];
          let rest = partialMatch[3] ?? '';

          // Accumulate continuation lines until we find "CAT "
          while (i + 1 < lines.length && !rest.includes('CAT ')) {
            const nextLine = lines[i + 1];
            if (isSkipLine(nextLine)) break;
            if (/^(\d+)\s+(\d+)\s/.test(nextLine)) break; // next row
            if (/^[A-D]\.\s/.test(nextLine)) break; // section header
            if (nextLine.startsWith('•')) break; // activity bullet
            i++;
            rest += ' ' + nextLine;
          }

          if (rest.includes('CAT ')) {
            match = `${rowNum} ${fsp} ${rest}`.match(rowPattern);
          }
        }
      }

      if (match) {
        const fspNumber = match[2].trim();
        let name = match[3].trim();
        const catRest = match[4].trim();

        // Extract category from catRest (e.g. "CAT I & II")
        const catMatch = catRest.match(/^(CAT\s+[IV,&\s]+(?:IIA)?)/i);
        const category = catMatch ? catMatch[1].trim() : catRest.split('•')[0].trim();

        // Collect activities from bullet points on same line and subsequent lines
        const activities: string[] = [];
        const bulletMatch = catRest.match(/•\s*(.+)/);
        if (bulletMatch) {
          activities.push(bulletMatch[1].trim());
        }
        // Look ahead for more bullet lines
        while (i + 1 < lines.length && lines[i + 1].startsWith('•')) {
          i++;
          activities.push(lines[i].replace(/^•\s*/, '').trim());
        }

        // Clean up name: remove "Now NEWNAME (PTY) LTD" — keep original
        // e.g. "ZANIVEST (PTY) LTD Now COINS DIGITAL MARKETS (PTY) LTD"
        const nowIdx = name.indexOf(' Now ');
        if (nowIdx > 0) {
          name = name.substring(0, nowIdx).trim();
        }

        // Map section to status string
        let status: string;
        switch (currentSection) {
          case 'Authorized': status = 'Authorized'; break;
          case 'Removed':    status = 'Removed';     break;
          case 'Lapsed':     status = 'Lapsed';      break;
          case 'Withdrawn':  status = 'Withdrawn';    break;
        }

        if (name.length > 2) {
          entities.push({
            name,
            licenseNumber: `FSP ${fspNumber}`,
            countryCode: 'ZA',
            country: 'South Africa',
            status,
            regulator: 'FSCA',
            licenseType: category || 'CASP',
            activities: activities.length > 0 ? activities : ['Crypto Asset Services'],
            sourceUrl,
          });
        }
      }
    }

    if (entities.length === 0) {
      warnings.push('PDF parsing yielded 0 entities — table format may have changed');
    }

    return entities;
  }
}
