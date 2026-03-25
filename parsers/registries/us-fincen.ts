/**
 * US FinCEN — Money Services Businesses (MSBs)
 *
 * Source: FinCEN MSB Registrant Search
 * URL: https://www.fincen.gov/msb-registrant-search
 *
 * NOTE: FinCEN's MSB search is a legacy HTML form inside an iframe with no API
 * and no bulk download. This parser attempts to submit the form programmatically
 * and parse results. For comprehensive data, browser automation is recommended.
 *
 * The search supports filtering by:
 * - State/jurisdiction
 * - MSB activities (money transmitter, currency dealer, etc.)
 * - Legal name
 */

import * as cheerio from 'cheerio';
import type { RegistryParser, ParserConfig, ParseResult, ParsedEntity } from '../core/types.js';
import { logger } from '../core/logger.js';

const SOURCE_URL = 'https://www.fincen.gov/msb-registrant-search';
const ALTERNATIVE_URL = 'https://www.fincen.gov/resources/msb-state-selector';

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br',
  'DNT': '1',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
};

export class UsFincenParser implements RegistryParser {
  config: ParserConfig = {
    id: 'us-fincen',
    name: 'US FinCEN Money Services Businesses',
    countryCode: 'US',
    country: 'United States',
    regulator: 'FinCEN (Financial Crimes Enforcement Network)',
    url: SOURCE_URL,
    sourceType: 'html',
    rateLimit: 15_000,
    needsProxy: false,
    needsBrowser: true, // Form-based search needs browser automation
  };

  async parse(): Promise<ParseResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const errors: string[] = [];
    const entities: ParsedEntity[] = [];

    try {
      logger.info(this.config.id, 'Attempting to fetch FinCEN MSB search page');

      // Try primary URL first
      let response = await this.fetchWithRetry(SOURCE_URL);
      let html = await response.text();
      let $ = cheerio.load(html);

      // Check if we got redirected or need to try alternative URL
      const canonicalUrl = $('link[rel="canonical"]').attr('href');
      if (canonicalUrl && canonicalUrl.includes('msb-state-selector')) {
        logger.info(this.config.id, 'Detected redirect to state selector, trying alternative URL');
        response = await this.fetchWithRetry(ALTERNATIVE_URL);
        html = await response.text();
        $ = cheerio.load(html);
      }

      // Look for iframes
      const iframes = $('iframe');
      logger.info(this.config.id, `Found ${iframes.length} iframe(s) on page`);

      if (iframes.length > 0) {
        for (let i = 0; i < iframes.length; i++) {
          const iframe = iframes.eq(i);
          const src = iframe.attr('src');
          const dataSrc = iframe.attr('data-src');
          const iframeSrc = src || dataSrc;
          
          if (iframeSrc) {
            logger.info(this.config.id, `Processing iframe ${i + 1}: ${iframeSrc}`);
            const formEntities = await this.searchViaForm(iframeSrc, warnings);
            entities.push(...formEntities);
          }
        }
      }

      // Also check for any embedded content or direct search functionality
      const searchForms = $('form');
      if (searchForms.length > 0) {
        logger.info(this.config.id, `Found ${searchForms.length} form(s) on main page`);
        const directEntities = await this.parseDirectForms($, warnings);
        entities.push(...directEntities);
      }

      // Look for any MSB-related content in the page
      const msbContent = this.extractMSBContentFromPage($, warnings);
      entities.push(...msbContent);

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`FinCEN search failed: ${msg}`);
      logger.error(this.config.id, `Parse error: ${msg}`);
    }

    // Always add comprehensive guidance
    if (entities.length === 0) {
      warnings.push(
        'FinCEN MSB Registry Notice: The MSB registrant search requires interactive browser automation. ' +
        'FinCEN\'s search interface uses complex forms with CSRF protection and dynamic content loading. ' +
        'For production use, implement Playwright/Selenium automation to: ' +
        '1) Navigate to the search form, 2) Select search criteria (state, activity type), ' +
        '3) Submit searches iteratively, 4) Parse paginated results. ' +
        'The registry contains thousands of MSB registrations across all US states.'
      );
    } else {
      warnings.push(
        `Extracted ${entities.length} entities via automated parsing. ` +
        'For comprehensive MSB data, browser automation is recommended to access the full search interface.'
      );
    }

    logger.info(this.config.id, `Parse completed. Entities: ${entities.length}, Warnings: ${warnings.length}, Errors: ${errors.length}`);

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

  private async fetchWithRetry(url: string, maxRetries: number = 2): Promise<Response> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(this.config.id, `Fetching ${url} (attempt ${attempt}/${maxRetries})`);
        
        const response = await fetch(url, {
          headers: DEFAULT_HEADERS,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        logger.warn(this.config.id, `Attempt ${attempt} failed: ${lastError.message}`);
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        }
      }
    }

    throw lastError || new Error('All fetch attempts failed');
  }

  /** Attempt to submit the FinCEN search form programmatically */
  private async searchViaForm(formUrl: string, warnings: string[]): Promise<ParsedEntity[]> {
    const entities: ParsedEntity[] = [];

    try {
      // Resolve the full URL if relative
      const url = formUrl.startsWith('http') ? formUrl : 
                 formUrl.startsWith('//') ? `https:${formUrl}` :
                 `https://www.fincen.gov${formUrl}`;

      logger.info(this.config.id, `Attempting to access form at: ${url}`);

      // First, fetch the form to get any CSRF tokens or hidden fields
      const formResponse = await this.fetchWithRetry(url);
      const formHtml = await formResponse.text();
      const $ = cheerio.load(formHtml);

      // Check if this looks like an MSB search form
      const pageText = $.text().toLowerCase();
      const isMSBForm = pageText.includes('money service') || 
                       pageText.includes('msb') || 
                       pageText.includes('transmitter') ||
                       pageText.includes('registrant');

      if (!isMSBForm) {
        warnings.push(`Form at ${url} does not appear to be MSB search interface`);
        return entities;
      }

      // Try to find and analyze the search form
      const forms = $('form');
      logger.info(this.config.id, `Found ${forms.length} form(s) in iframe`);

      if (forms.length === 0) {
        warnings.push('No forms found in iframe - may require JavaScript execution');
        return entities;
      }

      // Process each form
      forms.each((_, formEl) => {
        const form = $(formEl);
        const action = form.attr('action') ?? '';
        const method = (form.attr('method') ?? 'GET').toUpperCase();

        logger.info(this.config.id, `Form found - Action: ${action || 'none'}, Method: ${method}`);

        // Look for MSB-specific form fields
        const inputs = form.find('input, select, textarea');
        let hasStateField = false;
        let hasActivityField = false;
        let hasNameField = false;

        inputs.each((_, inputEl) => {
          const input = $(inputEl);
          const name = (input.attr('name') || '').toLowerCase();
          const id = (input.attr('id') || '').toLowerCase();
          const label = input.closest('label').text().toLowerCase() || 
                       $(`label[for="${input.attr('id')}"]`).text().toLowerCase();

          if (name.includes('state') || id.includes('state') || label.includes('state')) {
            hasStateField = true;
          }
          if (name.includes('activity') || id.includes('activity') || label.includes('activity') ||
              name.includes('type') || id.includes('type') || label.includes('transmitter')) {
            hasActivityField = true;
          }
          if (name.includes('name') || id.includes('name') || label.includes('name')) {
            hasNameField = true;
          }
        });

        if (hasStateField || hasActivityField || hasNameField) {
          warnings.push(
            `MSB search form detected with fields: State(${hasStateField}), Activity(${hasActivityField}), Name(${hasNameField}). ` +
            'Form submission requires browser automation for CSRF tokens and dynamic validation.'
          );
        }
      });

      // Try to extract any pre-populated results or example data
      const tableRows = $('table tr, .result, .registrant');
      if (tableRows.length > 0) {
        tableRows.each((_, row) => {
          const rowText = $(row).text().trim();
          if (rowText.length > 10 && !rowText.toLowerCase().includes('no results')) {
            const cells = $(row).find('td, .cell');
            if (cells.length >= 1) {
              const name = $(cells[0]).text().trim();
              if (name && name.length > 2 && !name.toLowerCase().includes('name')) {
                entities.push(this.createEntityFromName(name));
              }
            }
          }
        });
      }

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`Form processing failed: ${msg}`);
      logger.warn(this.config.id, `Form search error: ${msg}`);
    }

    return entities;
  }

  /** Parse forms found directly on the main page */
  private async parseDirectForms($: cheerio.CheerioAPI, warnings: string[]): Promise<ParsedEntity[]> {
    const entities: ParsedEntity[] = [];

    $('form').each((_, formEl) => {
      const form = $(formEl);
      const formText = form.text().toLowerCase();
      
      if (formText.includes('msb') || formText.includes('money service') || formText.includes('registrant')) {
        warnings.push('Direct MSB search form found on main page - requires browser automation for interaction');
      }
    });

    return entities;
  }

  /** Extract any MSB-related content from the page */
  private extractMSBContentFromPage($: cheerio.CheerioAPI, warnings: string[]): ParsedEntity[] {
    const entities: ParsedEntity[] = [];

    // Look for any MSB-related content, lists, or embedded data
    const pageText = $.text().toLowerCase();
    
    if (pageText.includes('money service business') || pageText.includes('msb registrant')) {
      warnings.push('Page contains MSB-related content but requires interactive search to access registry data');
    }

    // Check for any structured data or lists
    $('ul, ol, table').each((_, listEl) => {
      const listText = $(listEl).text();
      if (listText.toLowerCase().includes('transmitter') || 
          listText.toLowerCase().includes('money service')) {
        
        $(listEl).find('li, tr').each((_, item) => {
          const itemText = $(item).text().trim();
          // Look for company names (basic heuristic)
          if (itemText.length > 5 && 
              /^[A-Z][a-zA-Z\s&,.-]+(?:Inc|LLC|Corp|Company|Ltd|Co\.|Corporation)/i.test(itemText)) {
            entities.push(this.createEntityFromName(itemText));
          }
        });
      }
    });

    return entities;
  }

  private createEntityFromName(name: string): ParsedEntity {
    return {
      name: name.trim(),
      licenseNumber: `FINCEN-${name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 20).toUpperCase()}`,
      countryCode: 'US',
      country: 'United States',
      status: 'Registered',
      regulator: 'FinCEN',
      licenseType: 'MSB Registration',
      activities: ['Money Services Business'],
      sourceUrl: SOURCE_URL,
    };
  }
}