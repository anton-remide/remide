/**
 * Tests for HTML/API-based registry parsers:
 * - SG-MAS (Singapore, HTML scraping with multiple CSS selector strategies)
 * - AE-VARA (UAE Dubai, HTML table/card/generic strategies)
 * - AU-AUSTRAC (Australia, HTML table + DCE page scraping)
 * - GB-FCA (UK, REST API + HTML fallback)
 * - US-FinCEN (USA, iframe form-based search)
 *
 * SG-MAS, AE-VARA, AU-AUSTRAC, and GB-FCA use fetchWithRetry / fetchJsonWithRetry
 * from ../core/client.js which has rate-limiting and retries. We mock the client
 * module to bypass delays and control returned HTML/JSON directly.
 *
 * US-FinCEN calls global fetch directly, so we mock globalThis.fetch for it.
 */

// Mock the client module BEFORE importing parsers that use it.
// vi.mock is hoisted by Vitest so the mock is active when the parser modules load.
vi.mock('../core/client.js', () => ({
  fetchWithRetry: vi.fn(),
  fetchJsonWithRetry: vi.fn(),
}));

import { fetchWithRetry, fetchJsonWithRetry } from '../core/client.js';
import { SgMasParser } from '../registries/sg-mas.js';
import { AeVaraParser } from '../registries/ae-vara.js';
import { AuAustracParser } from '../registries/au-austrac.js';
import { GbFcaParser } from '../registries/gb-fca.js';
import { GbFcaEmiParser } from '../registries/gb-fca-emi.js';
import { CaOscParser } from '../registries/ca-osc.js';
import { NzFmaParser } from '../registries/nz-fma.js';
import { HkSfcLcParser } from '../registries/hk-sfc-lc.js';
import { UsFincenParser } from '../registries/us-fincen.js';
import { ItOamVaspParser, parseOamHtml } from '../registries/it-oam-vasp.js';
import { ChVqfParser, parseVqfHtml } from '../registries/ch-vqf.js';
import { ChSofitParser, parseSofitHtml } from '../registries/ch-sofit.js';

// Cast to Vitest mock types for intellisense
const mockFetchWithRetry = fetchWithRetry as ReturnType<typeof vi.fn>;
const mockFetchJsonWithRetry = fetchJsonWithRetry as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal valid HTML page wrapping the given body content. */
function html(body: string): string {
  return `<!DOCTYPE html><html><head><title>Test</title></head><body>${body}</body></html>`;
}

// ---------------------------------------------------------------------------
// SG-MAS
// ---------------------------------------------------------------------------

describe('SG-MAS Parser', () => {
  let parser: SgMasParser;

  beforeEach(() => {
    parser = new SgMasParser();
    vi.clearAllMocks();
  });

  it('has correct config', () => {
    expect(parser.config.id).toBe('sg-mas');
    expect(parser.config.countryCode).toBe('SG');
    expect(parser.config.sourceType).toBe('html');
  });

  it('parses institution detail links from HTML', async () => {
    const pageHtml = html(`
      <div class="results">
        <a href="/fid/institution/detail/100">Alpha Crypto Pte Ltd</a>
        <a href="/fid/institution/detail/200">Beta Digital Exchange</a>
        <a href="/fid/institution/detail/300">Gamma Token Services</a>
      </div>
    `);

    // Both URLs (Major + Standard) return the same HTML
    mockFetchWithRetry.mockResolvedValue(pageHtml);

    const result = await parser.parse();

    expect(result.registryId).toBe('sg-mas');
    expect(result.countryCode).toBe('SG');
    // 3 from first URL, 3 from second URL, deduplicated to 3
    expect(result.entities.length).toBe(3);
    expect(result.entities[0].name).toBe('Alpha Crypto Pte Ltd');
    expect(result.entities[0].status).toBe('Licensed');
    expect(result.entities[0].regulator).toBe('MAS');
    expect(result.entities[0].website).toContain('https://eservices.mas.gov.sg/fid/institution/detail/100');
    expect(result.entities[0].activities).toContain('Digital Payment Token Service');

    // fetchWithRetry should have been called twice (Major + Standard)
    expect(mockFetchWithRetry).toHaveBeenCalledTimes(2);
  });

  it('deduplicates entities across Major and Standard pages', async () => {
    const majorHtml = html(`
      <a href="/fid/institution/detail/1">Shared Corp Pte Ltd</a>
      <a href="/fid/institution/detail/2">Major Only Ltd</a>
    `);

    const standardHtml = html(`
      <a href="/fid/institution/detail/1">Shared Corp Pte Ltd</a>
      <a href="/fid/institution/detail/3">Standard Only Ltd</a>
    `);

    mockFetchWithRetry
      .mockResolvedValueOnce(majorHtml)
      .mockResolvedValueOnce(standardHtml);

    const result = await parser.parse();

    // Shared Corp appears in both — should be deduplicated
    expect(result.entities.length).toBe(3);
    const names = result.entities.map((e) => e.name);
    expect(names).toContain('Shared Corp Pte Ltd');
    expect(names).toContain('Major Only Ltd');
    expect(names).toContain('Standard Only Ltd');
  });

  it('falls back to table rows when no link selectors match', async () => {
    const tableHtml = html(`
      <table>
        <tbody>
          <tr><td>Table Entity One</td><td>DPT</td></tr>
          <tr><td>Table Entity Two</td><td>DPT</td></tr>
        </tbody>
      </table>
    `);

    mockFetchWithRetry.mockResolvedValue(tableHtml);

    const result = await parser.parse();

    // 2 from each URL call, deduplicated = 2
    expect(result.entities.length).toBe(2);
    expect(result.entities[0].name).toBe('Table Entity One');
    expect(result.entities[0].licenseType).toContain('Payment Institution');
  });

  it('filters out short names and "search" text', async () => {
    const pageHtml = html(`
      <a href="/fid/institution/detail/1">AB</a>
      <a href="/fid/institution/detail/2">Search Results</a>
      <a href="/fid/institution/detail/3">Valid Company Name</a>
    `);

    mockFetchWithRetry.mockResolvedValue(pageHtml);

    const result = await parser.parse();

    // "AB" is <= 2 chars, "Search Results" contains "search" — both filtered
    expect(result.entities.length).toBe(1);
    expect(result.entities[0].name).toBe('Valid Company Name');
  });

  it('generates license number from entity name', async () => {
    const pageHtml = html(`
      <a href="/fid/institution/detail/1">Test Company 123</a>
    `);

    mockFetchWithRetry.mockResolvedValue(pageHtml);

    const result = await parser.parse();

    expect(result.entities[0].licenseNumber).toBe('MAS-DPT-TestCompany123');
  });

  it('handles fetch failure gracefully with warnings', async () => {
    mockFetchWithRetry.mockRejectedValue(new Error('Network error'));

    const result = await parser.parse();

    expect(result.entities.length).toBe(0);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('Failed to fetch');
  });

  it('constructs full detail URL from relative href', async () => {
    const pageHtml = html(`
      <a href="/fid/institution/detail/42">Acme Pte Ltd</a>
    `);

    mockFetchWithRetry.mockResolvedValue(pageHtml);

    const result = await parser.parse();

    expect(result.entities[0].website).toBe('https://eservices.mas.gov.sg/fid/institution/detail/42');
  });

  it('returns empty on fully empty HTML', async () => {
    mockFetchWithRetry.mockResolvedValue(html(''));

    const result = await parser.parse();

    expect(result.entities.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// AE-VARA
// ---------------------------------------------------------------------------

describe('AE-VARA Parser', () => {
  let parser: AeVaraParser;

  beforeEach(() => {
    parser = new AeVaraParser();
    vi.clearAllMocks();
  });

  it('has correct config', () => {
    expect(parser.config.id).toBe('ae-vara');
    expect(parser.config.countryCode).toBe('AE');
    expect(parser.config.needsBrowser).toBe(true);
  });

  it('Strategy 1: parses div rows with tr-registry class', async () => {
    const tableHtml = html(`
      <div class="tr-registry">
        <div class="td-cell">Binance FZE</div>
        <div class="td-cell">Licensed</div>
        <div class="td-cell">Exchange;Broker-Dealer</div>
      </div>
      <div class="tr-registry">
        <div class="td-cell">OKX DMCC</div>
        <div class="td-cell">In-Principle Approval</div>
        <div class="td-cell">Exchange</div>
      </div>
    `);

    mockFetchWithRetry.mockResolvedValue(tableHtml);

    const result = await parser.parse();

    expect(result.registryId).toBe('ae-vara');
    expect(result.entities.length).toBe(2);

    // First entity — Full License
    expect(result.entities[0].name).toBe('Binance FZE');
    expect(result.entities[0].status).toBe('Licensed');
    expect(result.entities[0].licenseType).toBe('Full VASP License');
    expect(result.entities[0].activities).toEqual(['Exchange', 'Broker-Dealer']);

    // Second entity — In-Principle Approval
    expect(result.entities[1].name).toBe('OKX DMCC');
    expect(result.entities[1].licenseType).toBe('In-Principle Approval');
  });

  it('Strategy 1: parses standard HTML table rows', async () => {
    const tableHtml = html(`
      <table>
        <tr>
          <td>Entity Name</td><td>Status</td><td>Activities</td>
        </tr>
        <tr>
          <td>Crypto Corp</td><td>Provisional</td><td>Custody</td>
        </tr>
        <tr>
          <td>Token Exchange LLC</td><td>Active</td><td>Trading</td>
        </tr>
      </table>
    `);

    mockFetchWithRetry.mockResolvedValue(tableHtml);

    const result = await parser.parse();

    // "Entity Name" is filtered (includes 'entity' and 'name')
    expect(result.entities.length).toBe(2);
    expect(result.entities[0].name).toBe('Crypto Corp');
    expect(result.entities[0].licenseType).toBe('Provisional License');
    expect(result.entities[1].name).toBe('Token Exchange LLC');
  });

  it('Strategy 2: parses card-based layout', async () => {
    // No table or .tr-registry match, so Strategy 1 yields 0 => Strategy 2
    const cardHtml = html(`
      <div class="register-card">
        <h3>Bybit DMCC</h3>
        <span class="status">Active</span>
        <span class="activities">Exchange</span>
      </div>
      <div class="register-card">
        <h4>Kraken FZE</h4>
        <span class="badge">IPA</span>
        <span class="services">Broker;Custody</span>
      </div>
    `);

    mockFetchWithRetry.mockResolvedValue(cardHtml);

    const result = await parser.parse();

    expect(result.entities.length).toBe(2);
    expect(result.entities[0].name).toBe('Bybit DMCC');
    expect(result.entities[0].status).toBe('Active');
    expect(result.entities[1].name).toBe('Kraken FZE');
    // "IPA" contains "ipa" which triggers In-Principle Approval detection
    expect(result.entities[1].licenseType).toBe('In-Principle Approval');
  });

  it('Strategy 3: generic list extraction by company indicators', async () => {
    // No table, no .tr-registry, no card selectors => Strategy 3
    const listHtml = html(`
      <ul>
        <li>Crypto Exchange LLC</li>
        <li>About Us</li>
        <li>Digital Token FZE</li>
        <li>nav menu item</li>
      </ul>
    `);

    mockFetchWithRetry.mockResolvedValue(listHtml);

    const result = await parser.parse();

    // "About Us" — no company indicator, "nav menu item" — contains "nav"
    expect(result.entities.length).toBe(2);
    const names = result.entities.map((e) => e.name);
    expect(names).toContain('Crypto Exchange LLC');
    expect(names).toContain('Digital Token FZE');
  });

  it('warns when no entities found (JS-rendered page)', async () => {
    const emptyHtml = html('<div>Loading...</div>');

    mockFetchWithRetry.mockResolvedValue(emptyHtml);

    const result = await parser.parse();

    expect(result.entities.length).toBe(0);
    expect(result.warnings).toContain(
      'No entities found — page may require JavaScript rendering (Playwright)'
    );
  });

  it('license type detection: IPA vs Full vs Provisional', async () => {
    const tableHtml = html(`
      <table>
        <tr><td>Firm A</td><td>In-Principle Approval</td><td></td></tr>
        <tr><td>Firm B</td><td>Licensed</td><td></td></tr>
        <tr><td>Firm C</td><td>Provisional License</td><td></td></tr>
      </table>
    `);

    mockFetchWithRetry.mockResolvedValue(tableHtml);

    const result = await parser.parse();

    expect(result.entities[0].licenseType).toBe('In-Principle Approval');
    expect(result.entities[1].licenseType).toBe('Full VASP License');
    expect(result.entities[2].licenseType).toBe('Provisional License');
  });

  it('splits activities by semicolons, commas, and pipes', async () => {
    const tableHtml = html(`
      <table>
        <tr><td>Multi Activity Firm</td><td>Licensed</td><td>Exchange|Custody,Advisory;Lending</td></tr>
      </table>
    `);

    mockFetchWithRetry.mockResolvedValue(tableHtml);

    const result = await parser.parse();

    expect(result.entities[0].activities).toEqual(['Exchange', 'Custody', 'Advisory', 'Lending']);
  });

  it('throws when fetch fails completely', async () => {
    mockFetchWithRetry.mockRejectedValue(new Error('Connection refused'));

    await expect(parser.parse()).rejects.toThrow('Failed to fetch VARA register');
  });
});

// ---------------------------------------------------------------------------
// AU-AUSTRAC
// ---------------------------------------------------------------------------

describe('AU-AUSTRAC Parser', () => {
  let parser: AuAustracParser;

  beforeEach(() => {
    parser = new AuAustracParser();
    vi.clearAllMocks();
  });

  it('has correct config', () => {
    expect(parser.config.id).toBe('au-austrac');
    expect(parser.config.countryCode).toBe('AU');
    expect(parser.config.rateLimit).toBe(15_000);
    expect(parser.config.needsBrowser).toBe(true);
  });

  it('parses actions page table with status detection', async () => {
    const actionsHtml = html(`
      <table>
        <thead>
          <tr><th>Business Name</th><th>Action</th><th>Date</th></tr>
        </thead>
        <tbody>
          <tr><td>CoinSpot Pty Ltd</td><td>Registration cancelled</td><td>2024-01-15</td></tr>
          <tr><td>BitTrade Pty Ltd</td><td>Registration suspended</td><td>2024-02-20</td></tr>
          <tr><td>EasyCrypto Pty Ltd</td><td>Condition imposed</td><td>2024-03-10</td></tr>
        </tbody>
      </table>
    `);

    // DCE page returns empty content
    const dcePlainHtml = html('<p>General information about DCEs.</p>');

    // First call = actions page, second call = DCE page
    mockFetchWithRetry
      .mockResolvedValueOnce(actionsHtml)
      .mockResolvedValueOnce(dcePlainHtml);

    const result = await parser.parse();

    expect(result.registryId).toBe('au-austrac');
    expect(result.entities.length).toBe(3);

    expect(result.entities[0].name).toBe('CoinSpot Pty Ltd');
    expect(result.entities[0].status).toBe('Cancelled');

    expect(result.entities[1].name).toBe('BitTrade Pty Ltd');
    expect(result.entities[1].status).toBe('Suspended');

    expect(result.entities[2].name).toBe('EasyCrypto Pty Ltd');
    expect(result.entities[2].status).toBe('Conditional');

    for (const entity of result.entities) {
      expect(entity.regulator).toBe('AUSTRAC');
      expect(entity.licenseType).toBe('DCE Registration');
      expect(entity.activities).toEqual(['Digital Currency Exchange']);
      expect(entity.countryCode).toBe('AU');
    }
  });

  it('detects refused/rejected status', async () => {
    const actionsHtml = html(`
      <table><tbody>
        <tr><td>Rejected Corp</td><td>Registration refused</td><td>2024-05-01</td></tr>
      </tbody></table>
    `);

    mockFetchWithRetry
      .mockResolvedValueOnce(actionsHtml)
      .mockResolvedValueOnce(html(''));

    const result = await parser.parse();

    expect(result.entities[0].status).toBe('Refused');
  });

  it('skips header rows containing "business name" or "entity"', async () => {
    // The parser filters rows whose first cell text .toLowerCase().includes('business name')
    // or .includes('entity'). Note: ANY name containing "entity" is filtered too.
    const actionsHtml = html(`
      <table>
        <tr><td>Business Name</td><td>Action</td></tr>
        <tr><td>entity details</td><td>Type</td></tr>
        <tr><td>Acme Digital Ltd</td><td>Registered</td></tr>
      </table>
    `);

    mockFetchWithRetry
      .mockResolvedValueOnce(actionsHtml)
      .mockResolvedValueOnce(html(''));

    const result = await parser.parse();

    // "Business Name" => filtered (includes 'business name')
    // "entity details" => filtered (includes 'entity')
    // "Acme Digital Ltd" => kept
    expect(result.entities.length).toBe(1);
    expect(result.entities[0].name).toBe('Acme Digital Ltd');
    expect(result.entities[0].status).toBe('Registered');
  });

  it('parses DCE page list items with company indicators', async () => {
    // Actions page is empty table
    const actionsHtml = html('<table></table>');

    const dcepHtml = html(`
      <ul>
        <li>Independent Reserve Pty Ltd (Sydney)</li>
        <li>Some general information text</li>
        <li>Swyftx Pty Ltd</li>
        <li>Contact us for more info</li>
        <li>Digital Surge exchange services</li>
      </ul>
    `);

    mockFetchWithRetry
      .mockResolvedValueOnce(actionsHtml)
      .mockResolvedValueOnce(dcepHtml);

    const result = await parser.parse();

    // "Independent Reserve Pty Ltd" — has "Pty"
    // "Swyftx Pty Ltd" — has "Pty"
    // "Digital Surge exchange services" — has "exchange"
    expect(result.entities.length).toBe(3);

    // Name should be split at "(" for Independent Reserve
    expect(result.entities[0].name).toBe('Independent Reserve Pty Ltd');
    expect(result.entities[1].name).toBe('Swyftx Pty Ltd');
    expect(result.entities[2].name).toBe('Digital Surge exchange services');
  });

  it('deduplicates between actions page and DCE page', async () => {
    const actionsHtml = html(`
      <table><tbody>
        <tr><td>CoinJar Pty Ltd</td><td>Registration cancelled</td><td>2024-01-01</td></tr>
      </tbody></table>
    `);

    const dcepHtml = html(`
      <ul>
        <li>CoinJar Pty Ltd</li>
        <li>NewEntity Ltd</li>
      </ul>
    `);

    mockFetchWithRetry
      .mockResolvedValueOnce(actionsHtml)
      .mockResolvedValueOnce(dcepHtml);

    const result = await parser.parse();

    expect(result.entities.length).toBe(2);
    const names = result.entities.map((e) => e.name);
    expect(names).toContain('CoinJar Pty Ltd');
    expect(names).toContain('NewEntity Ltd');

    // The actions page version should be kept (Cancelled status)
    const coinjar = result.entities.find((e) => e.name === 'CoinJar Pty Ltd');
    expect(coinjar?.status).toBe('Cancelled');
  });

  it('extracts entities from h3/h4 headings followed by registration text', async () => {
    const actionsHtml = html(`
      <table></table>
      <h3>Heading Entity ABC</h3>
      <p>This entity had its registration cancelled.</p>
    `);

    mockFetchWithRetry
      .mockResolvedValueOnce(actionsHtml)
      .mockResolvedValueOnce(html(''));

    const result = await parser.parse();

    expect(result.entities.length).toBe(1);
    expect(result.entities[0].name).toBe('Heading Entity ABC');
    expect(result.entities[0].status).toBe('Registration Action');
  });

  it('adds warning when no entities found', async () => {
    mockFetchWithRetry.mockResolvedValue(html('<p>No data</p>'));

    const result = await parser.parse();

    expect(result.entities.length).toBe(0);
    expect(result.warnings.some((w) => w.includes('AUSTRAC full DCE register requires interactive search'))).toBe(true);
  });

  it('handles actions page fetch failure with warning and continues to DCE page', async () => {
    const dcepHtml = html(`<ul><li>Crypto Exchange services</li></ul>`);

    mockFetchWithRetry
      .mockRejectedValueOnce(new Error('Timeout'))
      .mockResolvedValueOnce(dcepHtml);

    const result = await parser.parse();

    // DCE page should still be parsed
    expect(result.entities.length).toBe(1);
    expect(result.warnings.some((w) => w.includes('Failed to fetch actions page'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// IT-OAM-VASP
// ---------------------------------------------------------------------------

describe('IT-OAM-VASP Parser', () => {
  let parser: ItOamVaspParser;

  beforeEach(() => {
    parser = new ItOamVaspParser();
    vi.clearAllMocks();
  });

  it('has correct config', () => {
    expect(parser.config.id).toBe('it-oam-vasp');
    expect(parser.config.countryCode).toBe('IT');
    expect(parser.config.sourceType).toBe('html');
    expect(parser.config.needsBrowser).toBe(true);
  });

  it('parseOamHtml extracts entities from table rows', () => {
    const page = html(`
      <table>
        <tbody>
          <tr>
            <td>Hercle S.r.l.</td>
            <td>N. OAM-12345</td>
            <td>Iscritto</td>
            <td><a href="/operatori/hercle">Dettaglio</a></td>
          </tr>
          <tr>
            <td>Alpha Exchange S.p.A.</td>
            <td>ID: VV-9988</td>
            <td>Sospeso</td>
          </tr>
        </tbody>
      </table>
    `);

    const entities = parseOamHtml(page, 'https://www.organismo-am.it/test');

    expect(entities).toHaveLength(2);
    expect(entities[0].name).toBe('Hercle S.r.l.');
    expect(entities[0].licenseNumber).toBe('OAM-12345');
    expect(entities[0].status).toBe('Registered');
    expect(entities[0].sourceUrl).toBe('https://www.organismo-am.it/operatori/hercle');
    expect(entities[1].status).toBe('Suspended');
  });

  it('parseOamHtml deduplicates entities and supports JSON-LD ItemList', () => {
    const page = html(`
      <ul>
        <li><a href="/operatori/beta">Beta Crypto Srl</a> - N. 7654</li>
      </ul>
      <script type="application/ld+json">
        {
          "@type": "ItemList",
          "itemListElement": [
            {
              "item": {
                "name": "Beta Crypto Srl",
                "url": "https://www.organismo-am.it/operatori/beta"
              }
            },
            {
              "item": {
                "name": "Gamma Digital Assets S.r.l.",
                "url": "https://www.organismo-am.it/operatori/gamma"
              }
            }
          ]
        }
      </script>
    `);

    const entities = parseOamHtml(page, 'https://www.organismo-am.it/test');
    const names = entities.map((e) => e.name);

    expect(entities).toHaveLength(2);
    expect(names).toContain('Beta Crypto Srl');
    expect(names).toContain('Gamma Digital Assets S.r.l.');
  });

  it('parse() merges results from multiple OAM URLs', async () => {
    const page1 = html(`
      <table><tbody>
        <tr><td>One VASP Srl</td><td>N. 1111</td><td>Iscritto</td></tr>
      </tbody></table>
    `);
    const page2 = html(`
      <ul>
        <li><a href="/operatori/two">Two Exchange Spa</a> - N. 2222</li>
      </ul>
    `);

    mockFetchWithRetry
      .mockResolvedValueOnce(page1)
      .mockResolvedValueOnce(page2);

    const result = await parser.parse();
    const names = result.entities.map((e) => e.name);

    expect(result.registryId).toBe('it-oam-vasp');
    expect(result.countryCode).toBe('IT');
    expect(result.entities).toHaveLength(2);
    expect(names).toContain('One VASP Srl');
    expect(names).toContain('Two Exchange Spa');
  });

  it('parse() returns warning when both fetches fail', async () => {
    mockFetchWithRetry
      .mockRejectedValueOnce(new Error('Timeout'))
      .mockRejectedValueOnce(new Error('503'));

    const result = await parser.parse();

    expect(result.entities).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThanOrEqual(2);
    expect(result.warnings.some((w) => w.includes('No OAM entities found'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// CH-VQF
// ---------------------------------------------------------------------------

describe('CH-VQF Parser', () => {
  let parser: ChVqfParser;

  beforeEach(() => {
    parser = new ChVqfParser();
    vi.clearAllMocks();
  });

  it('has correct config', () => {
    expect(parser.config.id).toBe('ch-vqf');
    expect(parser.config.countryCode).toBe('CH');
    expect(parser.config.sourceType).toBe('html');
  });

  it('parseVqfHtml extracts members from table', () => {
    const page = html(`
      <table><tbody>
        <tr><td>Swiss Crypto Brokers AG</td><td>Member ID VQF-1001</td><td>Active</td></tr>
        <tr><td>Alpine Digital SA</td><td>Nr 2002</td><td>Suspended</td></tr>
      </tbody></table>
    `);

    const entities = parseVqfHtml(page, 'https://www.vqf.ch/test');
    expect(entities).toHaveLength(2);
    expect(entities[0].name).toBe('Swiss Crypto Brokers AG');
    expect(entities[0].licenseNumber).toBe('VQF-1001');
    expect(entities[1].status).toBe('Suspended');
  });

  it('parse() merges and deduplicates entities from multiple URLs', async () => {
    const page1 = html(`<ul><li><a href="/members/one">One Crypto GmbH</a> - ID 111</li></ul>`);
    const page2 = html(`<ul><li><a href="/members/one">One Crypto GmbH</a> - ID 111</li><li>Two Exchange AG - ID 222</li></ul>`);

    mockFetchWithRetry.mockResolvedValueOnce(page1).mockResolvedValueOnce(page2);

    const result = await parser.parse();
    expect(result.entities).toHaveLength(2);
    expect(result.entities.map((e) => e.name)).toContain('Two Exchange AG');
  });
});

// ---------------------------------------------------------------------------
// CH-SOFIT
// ---------------------------------------------------------------------------

describe('CH-SOFIT Parser', () => {
  let parser: ChSofitParser;

  beforeEach(() => {
    parser = new ChSofitParser();
    vi.clearAllMocks();
  });

  it('has correct config', () => {
    expect(parser.config.id).toBe('ch-sofit');
    expect(parser.config.countryCode).toBe('CH');
    expect(parser.config.sourceType).toBe('html');
  });

  it('parseSofitHtml extracts members from list and status text', () => {
    const page = html(`
      <ul>
        <li><a href="/m/alpha">Alpha Custody AG</a> - Member No 4500 - Active</li>
        <li><a href="/m/beta">Beta Wallet SA</a> - ID 4600 - Revoked</li>
      </ul>
    `);

    const entities = parseSofitHtml(page, 'https://www.so-fit.ch/test');
    expect(entities).toHaveLength(2);
    expect(entities[0].licenseNumber).toBe('4500');
    expect(entities[1].status).toBe('Revoked');
  });

  it('parse() returns warning when both endpoints fail', async () => {
    mockFetchWithRetry
      .mockRejectedValueOnce(new Error('Network'))
      .mockRejectedValueOnce(new Error('Timeout'));

    const result = await parser.parse();
    expect(result.entities).toHaveLength(0);
    expect(result.warnings.some((w) => w.includes('No SO-FIT entities found'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GB-FCA
// ---------------------------------------------------------------------------

describe('GB-FCA Parser', () => {
  let parser: GbFcaParser;
  const originalEnv = process.env.FCA_API_KEY;

  beforeEach(() => {
    parser = new GbFcaParser();
    vi.clearAllMocks();
    delete process.env.FCA_API_KEY;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.FCA_API_KEY = originalEnv;
    } else {
      delete process.env.FCA_API_KEY;
    }
  });

  it('has correct config', () => {
    expect(parser.config.id).toBe('gb-fca');
    expect(parser.config.countryCode).toBe('GB');
    expect(parser.config.sourceType).toBe('api');
    expect(parser.config.needsBrowser).toBe(true);
  });

  it('API mode: parses FCA API JSON response', async () => {
    process.env.FCA_API_KEY = 'test-key-12345';

    const apiResponse = {
      Status: 'Success',
      ResultInfo: {
        total_count: '2',
        page: '1',
        per_page: '20',
      },
      Data: [
        {
          'Organisation Name': 'Coinbase CB Payments Ltd',
          'FRN': '900635',
          'Status': 'Registered',
          'Type': 'Crypto Asset',
        },
        {
          'Organisation Name': 'Gemini Europe Ltd',
          'FRN': '921817',
          'Status': 'Registered',
          'Type': 'Crypto Asset',
        },
      ],
    };

    mockFetchJsonWithRetry.mockResolvedValue(apiResponse);

    const result = await parser.parse();

    expect(result.registryId).toBe('gb-fca');
    expect(result.countryCode).toBe('GB');
    expect(result.entities.length).toBe(2);

    expect(result.entities[0].name).toBe('Coinbase CB Payments Ltd');
    expect(result.entities[0].licenseNumber).toBe('900635');
    expect(result.entities[0].status).toBe('Registered');
    expect(result.entities[0].regulator).toBe('FCA');
    expect(result.entities[0].licenseType).toBe('Crypto Asset Registration');

    expect(result.entities[1].name).toBe('Gemini Europe Ltd');
    expect(result.entities[1].licenseNumber).toBe('921817');
  });

  it('API mode: paginates through multiple pages', async () => {
    process.env.FCA_API_KEY = 'test-key';

    const page1 = {
      Status: 'Success',
      ResultInfo: { total_count: '3', page: '1', per_page: '2' },
      Data: [
        { 'Organisation Name': 'Firm A', 'FRN': '100001', 'Status': 'Registered', 'Type': 'Crypto Asset' },
        { 'Organisation Name': 'Firm B', 'FRN': '100002', 'Status': 'Registered', 'Type': 'Crypto Asset' },
      ],
    };

    const page2 = {
      Status: 'Success',
      ResultInfo: { total_count: '3', page: '2', per_page: '2' },
      Data: [
        { 'Organisation Name': 'Firm C', 'FRN': '100003', 'Status': 'Registered', 'Type': 'Crypto Asset' },
      ],
    };

    mockFetchJsonWithRetry
      .mockResolvedValueOnce(page1)
      .mockResolvedValueOnce(page2);

    const result = await parser.parse();

    expect(result.entities.length).toBe(3);
    expect(mockFetchJsonWithRetry).toHaveBeenCalledTimes(2);
  });

  it('API mode: handles non-Success API status with warning', async () => {
    process.env.FCA_API_KEY = 'test-key';

    const errorResponse = {
      Status: 'Error',
      ResultInfo: { total_count: '0', page: '1', per_page: '20' },
      Data: [],
    };

    mockFetchJsonWithRetry.mockResolvedValue(errorResponse);

    const result = await parser.parse();

    expect(result.entities.length).toBe(0);
    expect(result.warnings.some((w) => w.includes('FCA API returned status: Error'))).toBe(true);
  });

  it('API mode: falls back to HTML when API returns zero entities', async () => {
    process.env.FCA_API_KEY = 'test-key';
    process.env.FCA_API_EMAIL = 'ops@example.com';

    const apiEmpty = {
      Status: 'Success',
      ResultInfo: { total_count: '0', page: '1', per_page: '20' },
      Data: [],
    };

    const htmlWithFirms = html(`
      <div>
        <span class="firm-name"><a href="/s/firm/900635">Coinbase CB Payments Ltd</a></span>
      </div>
    `);

    mockFetchJsonWithRetry.mockResolvedValueOnce(apiEmpty);
    mockFetchWithRetry.mockResolvedValueOnce(htmlWithFirms);

    const result = await parser.parse();

    expect(result.entities.length).toBe(1);
    expect(result.entities[0].name).toBe('Coinbase CB Payments Ltd');
    expect(result.warnings.some((w) => w.includes('FCA API returned 0 entities'))).toBe(true);
  });

  it('API mode: accepts FSR-API-02-01-11 status as valid', async () => {
    process.env.FCA_API_KEY = 'test-key';

    const response = {
      Status: 'FSR-API-02-01-11',
      ResultInfo: { total_count: '1', page: '1', per_page: '20' },
      Data: [
        { 'Organisation Name': 'Special Firm', 'FRN': '999999', 'Status': 'Active', 'Type': 'Crypto Asset' },
      ],
    };

    mockFetchJsonWithRetry.mockResolvedValue(response);

    const result = await parser.parse();

    expect(result.entities.length).toBe(1);
    expect(result.entities[0].name).toBe('Special Firm');
  });

  it('API mode: skips entities with empty name', async () => {
    process.env.FCA_API_KEY = 'test-key';

    // total_count = 1 so the parser won't try to paginate beyond page 1
    const response = {
      Status: 'Success',
      ResultInfo: { total_count: '1', page: '1', per_page: '20' },
      Data: [
        { 'Organisation Name': '', 'FRN': '111111', 'Status': 'Registered', 'Type': 'Crypto Asset' },
        { 'Organisation Name': 'Real Firm', 'FRN': '222222', 'Status': 'Registered', 'Type': 'Crypto Asset' },
      ],
    };

    mockFetchJsonWithRetry.mockResolvedValueOnce(response);

    const result = await parser.parse();

    // Empty-name entity is skipped via `if (!name) continue;`
    expect(result.entities.length).toBe(1);
    expect(result.entities[0].name).toBe('Real Firm');
  });

  it('API mode: defaults status to "Registered" when empty', async () => {
    process.env.FCA_API_KEY = 'test-key';

    const response = {
      Status: 'Success',
      ResultInfo: { total_count: '1', page: '1', per_page: '20' },
      Data: [
        { 'Organisation Name': 'No Status Firm', 'FRN': '333333', 'Status': '', 'Type': 'Crypto Asset' },
      ],
    };

    mockFetchJsonWithRetry.mockResolvedValue(response);

    const result = await parser.parse();

    expect(result.entities[0].status).toBe('Registered');
  });

  it('HTML fallback: warns about SPA when no selectors match', async () => {
    // No FCA_API_KEY => HTML fallback mode
    const spaHtml = html(`
      <div id="lightning-app">
        <div class="slds-spinner">Loading...</div>
      </div>
    `);

    mockFetchWithRetry.mockResolvedValue(spaHtml);

    const result = await parser.parse();

    expect(result.entities.length).toBe(0);
    expect(result.warnings.some((w) => w.includes('No FCA_API_KEY set'))).toBe(true);
    expect(result.warnings.some((w) => w.includes('Salesforce SPA'))).toBe(true);
  });

  it('HTML fallback: parses firm-name links when present', async () => {
    // The selector is '.firm-name a' — an <a> INSIDE an element with class firm-name
    const fcaHtml = html(`
      <div>
        <span class="firm-name"><a href="/s/firm/900635">Coinbase CB Payments Ltd</a></span>
        <span class="firm-name"><a href="/s/firm/921817">Gemini Europe Ltd</a></span>
      </div>
    `);

    mockFetchWithRetry.mockResolvedValue(fcaHtml);

    const result = await parser.parse();

    expect(result.entities.length).toBe(2);
    expect(result.entities[0].name).toBe('Coinbase CB Payments Ltd');
    // FRN extracted from href /s/firm/900635 => "900635"
    expect(result.entities[0].licenseNumber).toBe('900635');
    expect(result.entities[1].name).toBe('Gemini Europe Ltd');
  });

  it('HTML fallback: handles fetch error gracefully', async () => {
    mockFetchWithRetry.mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await parser.parse();

    expect(result.entities.length).toBe(0);
    expect(result.warnings.some((w) => w.includes('HTML scraping failed'))).toBe(true);
  });

  it('API mode: handles API error mid-pagination', async () => {
    process.env.FCA_API_KEY = 'test-key';

    const page1 = {
      Status: 'Success',
      ResultInfo: { total_count: '40', page: '1', per_page: '20' },
      Data: Array.from({ length: 20 }, (_, i) => ({
        'Organisation Name': `Firm ${i + 1}`,
        'FRN': `${100000 + i}`,
        'Status': 'Registered',
        'Type': 'Crypto Asset',
      })),
    };

    mockFetchJsonWithRetry
      .mockResolvedValueOnce(page1)
      .mockRejectedValueOnce(new Error('Timeout'));

    const result = await parser.parse();

    // Should have 20 entities from page 1 despite page 2 failure
    expect(result.entities.length).toBe(20);
    expect(result.warnings.some((w) => w.includes('FCA API error on page 2'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GB-FCA-EMI
// ---------------------------------------------------------------------------

describe('GB-FCA-EMI Parser', () => {
  let parser: GbFcaEmiParser;
  const originalApiKey = process.env.FCA_API_KEY;
  const originalApiEmail = process.env.FCA_API_EMAIL;

  beforeEach(() => {
    parser = new GbFcaEmiParser();
    vi.clearAllMocks();
    delete process.env.FCA_API_KEY;
    delete process.env.FCA_API_EMAIL;
  });

  afterEach(() => {
    if (originalApiKey !== undefined) process.env.FCA_API_KEY = originalApiKey;
    else delete process.env.FCA_API_KEY;
    if (originalApiEmail !== undefined) process.env.FCA_API_EMAIL = originalApiEmail;
    else delete process.env.FCA_API_EMAIL;
  });

  it('has correct config', () => {
    expect(parser.config.id).toBe('gb-fca-emi');
    expect(parser.config.countryCode).toBe('GB');
    expect(parser.config.sourceType).toBe('api');
    expect(parser.config.needsBrowser).toBe(true);
  });

  it('API mode: parses EMI entities', async () => {
    process.env.FCA_API_KEY = 'test-key';
    process.env.FCA_API_EMAIL = 'ops@example.com';

    mockFetchJsonWithRetry.mockResolvedValue({
      Status: 'Success',
      ResultInfo: { total_count: '2', page: '1', per_page: '20' },
      Data: [
        { 'Organisation Name': 'Revolut Ltd', 'FRN': '900562', 'Status': 'Registered', 'Type': 'Electronic Money Institution' },
        { 'Organisation Name': 'Stripe Payments UK Ltd', 'FRN': '900461', 'Status': 'Registered', 'Type': 'Electronic Money Institution' },
      ],
    });

    const result = await parser.parse();
    expect(result.entities).toHaveLength(2);
    expect(result.entities[0].licenseType).toBe('Electronic Money Institution');
    expect(result.entities[0].licenseNumber).toBe('900562');
  });

  it('falls back to HTML when API returns zero', async () => {
    process.env.FCA_API_KEY = 'test-key';

    mockFetchJsonWithRetry.mockResolvedValue({
      Status: 'Success',
      ResultInfo: { total_count: '0', page: '1', per_page: '20' },
      Data: [],
    });
    mockFetchWithRetry.mockResolvedValue(html(`
      <div><span class="firm-name"><a href="/s/firm/901024">Nium Fintech Ltd</a></span></div>
    `));

    const result = await parser.parse();
    expect(result.entities).toHaveLength(1);
    expect(result.entities[0].name).toBe('Nium Fintech Ltd');
    expect(result.entities[0].licenseNumber).toBe('901024');
  });

  it('uses known fallback list when API and HTML are empty', async () => {
    process.env.FCA_API_KEY = 'test-key';
    mockFetchJsonWithRetry.mockResolvedValue({
      Status: 'Error',
      ResultInfo: { total_count: '0', page: '1', per_page: '20' },
      Data: [],
    });
    mockFetchWithRetry.mockResolvedValue(html('<div></div>'));

    const result = await parser.parse();
    expect(result.entities.length).toBeGreaterThan(3);
    expect(result.entities.some((e) => e.name.includes('Revolut'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// CA-OSC
// ---------------------------------------------------------------------------

describe('CA-OSC Parser', () => {
  let parser: CaOscParser;

  beforeEach(() => {
    parser = new CaOscParser();
    vi.clearAllMocks();
  });

  it('has correct config', () => {
    expect(parser.config.id).toBe('ca-osc');
    expect(parser.config.countryCode).toBe('CA');
    expect(parser.config.sourceType).toBe('html');
  });

  it('parses entities from list/table HTML when available', async () => {
    mockFetchWithRetry.mockResolvedValue(html(`
      <table>
        <tbody>
          <tr><td>Coinbase Canada, Inc.</td><td>Registered</td></tr>
          <tr><td>Wealthsimple Investments Inc.</td><td>Registered</td></tr>
        </tbody>
      </table>
    `));

    const result = await parser.parse();
    expect(result.entities).toHaveLength(2);
    expect(result.entities[0].regulator).toBe('OSC');
    expect(result.entities[0].licenseType).toBe('Crypto Trading Platform Registration');
  });

  it('uses known fallback when HTML has no parsable entities', async () => {
    mockFetchWithRetry.mockResolvedValue(html('<div>No list</div>'));
    const result = await parser.parse();
    expect(result.entities.length).toBeGreaterThan(5);
    expect(result.warnings.some((w) => w.includes('fallback'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// NZ-FMA
// ---------------------------------------------------------------------------

describe('NZ-FMA Parser', () => {
  let parser: NzFmaParser;

  beforeEach(() => {
    parser = new NzFmaParser();
    vi.clearAllMocks();
  });

  it('has correct config', () => {
    expect(parser.config.id).toBe('nz-fma');
    expect(parser.config.countryCode).toBe('NZ');
    expect(parser.config.sourceType).toBe('html');
  });

  it('parses providers from table/list html', async () => {
    mockFetchWithRetry.mockResolvedValue(html(`
      <table><tbody>
        <tr><td>Easy Crypto Limited</td><td>Registered</td></tr>
        <tr><td>Independent Reserve NZ Limited</td><td>Registered</td></tr>
      </tbody></table>
    `));
    const result = await parser.parse();
    expect(result.entities).toHaveLength(2);
    expect(result.entities[0].regulator).toBe('FMA');
  });

  it('falls back to known baseline when html extraction returns zero', async () => {
    mockFetchWithRetry.mockResolvedValue(html('<div>No entities here</div>'));
    const result = await parser.parse();
    expect(result.entities.length).toBeGreaterThan(3);
    expect(result.warnings.some((w) => w.includes('fallback'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// HK-SFC-LC
// ---------------------------------------------------------------------------

describe('HK-SFC-LC Parser', () => {
  let parser: HkSfcLcParser;

  beforeEach(() => {
    parser = new HkSfcLcParser();
    vi.clearAllMocks();
  });

  it('has correct config', () => {
    expect(parser.config.id).toBe('hk-sfc-lc');
    expect(parser.config.countryCode).toBe('HK');
    expect(parser.config.sourceType).toBe('html');
  });

  it('parses entities from table HTML', async () => {
    mockFetchWithRetry.mockResolvedValue(html(`
      <table><tbody>
        <tr><td>OSL Digital Securities Limited</td><td>BPL993</td></tr>
        <tr><td>Victory Securities Company Limited</td><td>AAV008</td></tr>
      </tbody></table>
    `));

    const result = await parser.parse();
    expect(result.entities).toHaveLength(2);
    expect(result.entities[0].licenseType).toBe('Licensed Corporation');
    expect(result.entities[0].licenseNumber).toBe('BPL993');
  });

  it('falls back to known list when HTML returns zero', async () => {
    mockFetchWithRetry.mockResolvedValue(html('<div>empty</div>'));
    const result = await parser.parse();
    expect(result.entities.length).toBeGreaterThan(3);
    expect(result.warnings.some((w) => w.includes('fallback'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// US-FinCEN (uses global.fetch directly, not fetchWithRetry)
// ---------------------------------------------------------------------------

describe('US-FinCEN Parser', () => {
  let parser: UsFincenParser;

  beforeEach(() => {
    parser = new UsFincenParser();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('has correct config', () => {
    expect(parser.config.id).toBe('us-fincen');
    expect(parser.config.countryCode).toBe('US');
    expect(parser.config.needsBrowser).toBe(true);
  });

  it('follows iframe -> form -> results chain and parses entities', async () => {
    // Step 1: Main page with iframe
    const mainPageHtml = html(`
      <div class="content">
        <h1>MSB Registrant Search</h1>
        <iframe src="/msb-search-form"></iframe>
      </div>
    `);

    // Step 2: Iframe page with a search form
    const formPageHtml = html(`
      <form action="/msb-search-results" method="POST">
        <input type="hidden" name="csrf_token" value="abc123" />
        <select name="activity_type">
          <option value="Money Transmitter">Money Transmitter</option>
        </select>
        <input type="submit" value="Search" />
      </form>
    `);

    // Step 3: Search results page with entities table
    const resultsHtml = html(`
      <table>
        <tr><th>Legal Name</th><th>DBA Name</th></tr>
        <tr><td>Coinbase Inc</td><td>Coinbase</td></tr>
        <tr><td>Circle Internet Financial LLC</td><td>Circle</td></tr>
        <tr><td>Ripple Labs Inc</td><td>Ripple</td></tr>
      </table>
    `);

    let callIndex = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: string | URL | Request) => {
      callIndex++;
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

      if (url.includes('msb-registrant-search') || callIndex === 1) {
        return new Response(mainPageHtml, { status: 200, headers: { 'Content-Type': 'text/html' } });
      }
      if (url.includes('msb-search-form') || callIndex === 2) {
        return new Response(formPageHtml, { status: 200, headers: { 'Content-Type': 'text/html' } });
      }
      // Search results
      return new Response(resultsHtml, { status: 200, headers: { 'Content-Type': 'text/html' } });
    });

    const result = await parser.parse();

    expect(result.registryId).toBe('us-fincen');
    expect(result.countryCode).toBe('US');
    expect(result.entities.length).toBe(3);

    expect(result.entities[0].name).toBe('Coinbase Inc');
    expect(result.entities[0].regulator).toBe('FinCEN');
    expect(result.entities[0].licenseType).toBe('MSB Registration');
    expect(result.entities[0].activities).toEqual(['Money Transmitter']);
    expect(result.entities[0].entityTypes).toEqual(['Coinbase']);

    expect(result.entities[1].name).toBe('Circle Internet Financial LLC');
    expect(result.entities[1].entityTypes).toEqual(['Circle']);

    expect(result.entities[2].name).toBe('Ripple Labs Inc');
  });

  it('skips header rows with "Legal Name"', async () => {
    const mainPageHtml = html(`<iframe src="/msb-form"></iframe>`);
    const formPageHtml = html(`
      <form action="/msb-results" method="GET">
        <input name="q" value="" />
      </form>
    `);
    const resultsHtml = html(`
      <table>
        <tr><td>Legal Name</td><td>DBA</td></tr>
        <tr><td>Valid MSB Entity</td><td>VME</td></tr>
      </table>
    `);

    let callIndex = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      callIndex++;
      let body: string;
      if (callIndex === 1) body = mainPageHtml;
      else if (callIndex === 2) body = formPageHtml;
      else body = resultsHtml;
      return new Response(body, { status: 200, headers: { 'Content-Type': 'text/html' } });
    });

    const result = await parser.parse();

    expect(result.entities.length).toBe(1);
    expect(result.entities[0].name).toBe('Valid MSB Entity');
  });

  it('warns when no iframe found on main page', async () => {
    const noIframeHtml = html(`<div>No iframe here</div>`);

    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(noIframeHtml, { status: 200, headers: { 'Content-Type': 'text/html' } });
    });

    const result = await parser.parse();

    expect(result.entities.length).toBe(0);
    expect(result.warnings.some((w) => w.includes('FinCEN MSB search requires browser automation'))).toBe(true);
  });

  it('handles main page fetch failure gracefully', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      throw new Error('503 Service Unavailable');
    });

    const result = await parser.parse();

    expect(result.entities.length).toBe(0);
    expect(result.warnings.some((w) => w.includes('FinCEN search failed'))).toBe(true);
  });

  it('handles form page fetch failure gracefully', async () => {
    const mainPageHtml = html(`<iframe src="/msb-form"></iframe>`);

    let callIndex = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      callIndex++;
      if (callIndex === 1) {
        return new Response(mainPageHtml, { status: 200, headers: { 'Content-Type': 'text/html' } });
      }
      // Form page fails
      return new Response('Not Found', { status: 404, headers: { 'Content-Type': 'text/html' } });
    });

    const result = await parser.parse();

    expect(result.entities.length).toBe(0);
    expect(result.warnings.some((w) => w.includes('Form page HTTP 404'))).toBe(true);
  });

  it('handles search results fetch failure gracefully', async () => {
    const mainPageHtml = html(`<iframe src="/msb-form"></iframe>`);
    const formPageHtml = html(`
      <form action="/msb-results" method="POST">
        <input name="q" value="" />
      </form>
    `);

    let callIndex = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      callIndex++;
      if (callIndex === 1) {
        return new Response(mainPageHtml, { status: 200, headers: { 'Content-Type': 'text/html' } });
      }
      if (callIndex === 2) {
        return new Response(formPageHtml, { status: 200, headers: { 'Content-Type': 'text/html' } });
      }
      // Results page returns error
      return new Response('Internal Server Error', { status: 500, headers: { 'Content-Type': 'text/html' } });
    });

    const result = await parser.parse();

    expect(result.entities.length).toBe(0);
    expect(result.warnings.some((w) => w.includes('Search response HTTP 500'))).toBe(true);
  });

  it('generates license number from entity name', async () => {
    const mainPageHtml = html(`<iframe src="/form"></iframe>`);
    const formPageHtml = html(`<form action="/res" method="GET"><input name="x" /></form>`);
    const resultsHtml = html(`
      <table>
        <tr><td>Block Inc</td><td>Cash App</td></tr>
      </table>
    `);

    let callIndex = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      callIndex++;
      let body: string;
      if (callIndex === 1) body = mainPageHtml;
      else if (callIndex === 2) body = formPageHtml;
      else body = resultsHtml;
      return new Response(body, { status: 200, headers: { 'Content-Type': 'text/html' } });
    });

    const result = await parser.parse();

    expect(result.entities[0].licenseNumber).toBe('FINCEN-BlockInc');
  });

  it('resolves relative iframe src to absolute URL', async () => {
    const mainPageHtml = html(`<iframe src="/relative/path/form"></iframe>`);
    const formPageHtml = html(`<form action="/res" method="GET"><input name="x" /></form>`);
    const resultsHtml = html(`<table><tr><td>Entity X</td><td></td></tr></table>`);

    let callIndex = 0;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      callIndex++;
      let body: string;
      if (callIndex === 1) body = mainPageHtml;
      else if (callIndex === 2) body = formPageHtml;
      else body = resultsHtml;
      return new Response(body, { status: 200, headers: { 'Content-Type': 'text/html' } });
    });

    await parser.parse();

    // Second call should use the resolved absolute URL
    const secondCallUrl = fetchSpy.mock.calls[1][0] as string;
    expect(secondCallUrl).toBe('https://www.fincen.gov/relative/path/form');
  });

  it('stores DBA name in entityTypes when present', async () => {
    const mainPageHtml = html(`<iframe src="/form"></iframe>`);
    const formPageHtml = html(`<form action="/res" method="GET"><input name="x" /></form>`);
    const resultsHtml = html(`
      <table>
        <tr><td>Parent Corp</td><td>Trading Name</td></tr>
        <tr><td>Solo Entity</td><td></td></tr>
      </table>
    `);

    let callIndex = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      callIndex++;
      let body: string;
      if (callIndex === 1) body = mainPageHtml;
      else if (callIndex === 2) body = formPageHtml;
      else body = resultsHtml;
      return new Response(body, { status: 200, headers: { 'Content-Type': 'text/html' } });
    });

    const result = await parser.parse();

    expect(result.entities[0].entityTypes).toEqual(['Trading Name']);
    // Empty DBA => entityTypes should be undefined (falsy check in source)
    expect(result.entities[1].entityTypes).toBeUndefined();
  });

  it('handles HTTP 200 with non-ok for main page', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response('Server Error', { status: 503, headers: { 'Content-Type': 'text/html' } });
    });

    const result = await parser.parse();

    expect(result.entities.length).toBe(0);
    expect(result.warnings.some((w) => w.includes('HTTP 503'))).toBe(true);
  });
});
