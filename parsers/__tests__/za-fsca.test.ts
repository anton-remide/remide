/**
 * Tests for ZA-FSCA PDF parser.
 *
 * Strategy: mock `pdf-parse` dynamic import and `global.fetch` so that the
 * parser's text-parsing logic is exercised without needing real PDF binaries.
 */

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal mock `fetch` that returns a fake ArrayBuffer for PDF URLs
 *  and can optionally return HTML for the FSCA page (fallback scraping). */
function makeFetchMock(opts: {
  /** Which PDF URL indices should succeed (0-based). Defaults to [0]. */
  succeedIndices?: number[];
  /** HTML body to return for the FSCA page URL (if set). */
  fscaPageHtml?: string;
} = {}) {
  const { succeedIndices = [0], fscaPageHtml } = opts;
  let pdfCallIndex = 0;

  return vi.fn(async (url: string | URL | Request, _init?: RequestInit) => {
    const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;

    // FSCA main page request (fallback scraping)
    if (urlStr.includes('Crypto-Assets.aspx') && fscaPageHtml !== undefined) {
      return {
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(0),
        text: async () => fscaPageHtml,
      } as unknown as Response;
    }

    // PDF download requests
    if (urlStr.endsWith('.pdf')) {
      const idx = pdfCallIndex++;
      if (succeedIndices.includes(idx)) {
        return {
          ok: true,
          arrayBuffer: async () => new ArrayBuffer(64),
        } as unknown as Response;
      }
      // Simulate 404
      return { ok: false, status: 404, statusText: 'Not Found' } as unknown as Response;
    }

    throw new Error(`Unexpected fetch URL: ${urlStr}`);
  });
}

/** Helper: set the `pdf-parse` mock to return the given text string. */
function setPdfText(text: string, numpages = 1) {
  pdfParseFn.mockResolvedValue({ text, numpages });
}

// ── Mocks ────────────────────────────────────────────────────────────────────

const pdfParseFn = vi.fn();

vi.mock('pdf-parse', () => ({
  default: pdfParseFn,
}));

// Silence logger output during tests
vi.mock('../../parsers/core/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ── Import under test (after mocks) ─────────────────────────────────────────

import { ZaFscaParser } from '../registries/za-fsca.js';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ZaFscaParser', () => {
  let parser: ZaFscaParser;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    parser = new ZaFscaParser();
    pdfParseFn.mockReset();
    globalThis.fetch = makeFetchMock();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // ── Config ───────────────────────────────────────────────────────────────

  describe('config', () => {
    it('has correct registry id and country code', () => {
      expect(parser.config.id).toBe('za-fsca');
      expect(parser.config.countryCode).toBe('ZA');
      expect(parser.config.country).toBe('South Africa');
    });

    it('source type is pdf', () => {
      expect(parser.config.sourceType).toBe('pdf');
    });

    it('does not need proxy or browser', () => {
      expect(parser.config.needsProxy).toBe(false);
      expect(parser.config.needsBrowser).toBe(false);
    });
  });

  // ── Pattern 1: Numbered rows with inline FSP numbers ─────────────────────

  describe('Pattern 1 — numbered rows with FSP numbers', () => {
    const tableText = [
      'Published list of Authorized CASPs',
      'No.  Name of CASP  FSP Number  Category',
      '1. Luno South Africa (Pty) Ltd FSP 53567 Category I',
      '2. VALR (Pty) Ltd FSP 53180 Category II',
      '3. AltCoinTrader SA (Pty) Ltd CASP 10023 Category I',
    ].join('\n');

    beforeEach(() => setPdfText(tableText, 2));

    it('extracts 3 entities', async () => {
      const result = await parser.parse();
      expect(result.entities).toHaveLength(3);
      expect(result.totalFound).toBe(3);
    });

    it('captures entity names correctly', async () => {
      const result = await parser.parse();
      const names = result.entities.map((e) => e.name);
      expect(names).toContain('Luno South Africa (Pty) Ltd');
      expect(names).toContain('VALR (Pty) Ltd');
      expect(names).toContain('AltCoinTrader SA (Pty) Ltd');
    });

    it('captures FSP / CASP license numbers', async () => {
      const result = await parser.parse();
      expect(result.entities[0].licenseNumber).toBe('FSP 53567');
      expect(result.entities[1].licenseNumber).toBe('FSP 53180');
      expect(result.entities[2].licenseNumber).toBe('CASP 10023');
    });

    it('captures license category when present', async () => {
      const result = await parser.parse();
      expect(result.entities[0].licenseType).toBe('Category I');
      expect(result.entities[1].licenseType).toBe('Category II');
    });

    it('sets common fields for all entities', async () => {
      const result = await parser.parse();
      for (const entity of result.entities) {
        expect(entity.countryCode).toBe('ZA');
        expect(entity.country).toBe('South Africa');
        expect(entity.status).toBe('Authorized');
        expect(entity.regulator).toBe('FSCA');
        expect(entity.activities).toEqual(['Crypto Asset Services']);
      }
    });
  });

  // ── Pattern 2: Name on one line, FSP on the next ─────────────────────────

  describe('Pattern 2 — name and FSP on separate lines', () => {
    const tableText = [
      'List of Licensed CASPs',
      'Name  License Number',
      '1. Luno South Africa',
      'FSP 53567',
      '2. VALR',
      'FSP 53180',
    ].join('\n');

    beforeEach(() => setPdfText(tableText));

    it('extracts entities using look-ahead FSP parsing', async () => {
      const result = await parser.parse();
      expect(result.entities).toHaveLength(2);
    });

    it('associates the correct FSP number with each entity', async () => {
      const result = await parser.parse();
      const luno = result.entities.find((e) => e.name.includes('Luno'));
      const valr = result.entities.find((e) => e.name.includes('VALR'));
      expect(luno?.licenseNumber).toBe('FSP 53567');
      expect(valr?.licenseNumber).toBe('FSP 53180');
    });
  });

  // ── Pattern 3: Tab-separated columns ─────────────────────────────────────

  describe('Pattern 3 — tab/space-separated columns', () => {
    const tableText = [
      'FSCA CASP Register',
      'Name\tFSP Number\tStatus',
      'Luno South Africa (Pty) Ltd\tFSP 53567\tActive',
      'VALR Holdings (Pty) Ltd\t53180\tActive',
    ].join('\n');

    beforeEach(() => setPdfText(tableText));

    it('extracts entities from tab-separated rows', async () => {
      const result = await parser.parse();
      expect(result.entities.length).toBeGreaterThanOrEqual(2);

      const names = result.entities.map((e) => e.name);
      expect(names).toContain('Luno South Africa (Pty) Ltd');
      expect(names).toContain('VALR Holdings (Pty) Ltd');
    });
  });

  // ── Empty / unrecognized PDF ─────────────────────────────────────────────

  describe('empty or unrecognized PDF', () => {
    it('returns 0 entities when no table header is found', async () => {
      setPdfText('This PDF has no table data at all.\nJust some random text.');
      const result = await parser.parse();
      expect(result.entities).toHaveLength(0);
      expect(result.totalFound).toBe(0);
    });

    it('adds a warning when 0 entities are parsed', async () => {
      setPdfText('No relevant content here.');
      const result = await parser.parse();
      expect(result.warnings.some((w) => w.includes('0 entities'))).toBe(true);
    });
  });

  // ── Skipping non-data lines ──────────────────────────────────────────────

  describe('skips non-data lines inside the table', () => {
    const tableText = [
      'Name  FSP Number',
      'page 2',
      'Published list continued',
      '1. Luno South Africa (Pty) Ltd FSP 53567 Category I',
    ].join('\n');

    beforeEach(() => setPdfText(tableText));

    it('skips lines containing "page" or "published"', async () => {
      const result = await parser.parse();
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].name).toBe('Luno South Africa (Pty) Ltd');
    });
  });

  // ── PDF download fallback behavior ───────────────────────────────────────

  describe('PDF download fallback', () => {
    it('succeeds when the first URL fails but the second works', async () => {
      globalThis.fetch = makeFetchMock({ succeedIndices: [1] });
      setPdfText('Name  FSP Number\n1. Luno FSP 53567 CASP');

      const result = await parser.parse();
      expect(result.entities.length).toBeGreaterThanOrEqual(1);
    });

    it('throws when no PDF URL succeeds and fallback page is unavailable', async () => {
      globalThis.fetch = makeFetchMock({ succeedIndices: [] });

      await expect(parser.parse()).rejects.toThrow('Could not download FSCA CASP PDF');
    });

    it('uses the FSCA page scraping fallback when all known PDF URLs fail', async () => {
      const fscaHtml = `
        <html><body>
          <a href="/Regulatory%20Frameworks/Documents/CASP_List_2025.pdf">Download</a>
        </body></html>`;

      // All PDF URL attempts fail; then page scrape finds a link; that PDF succeeds
      let fetchCallCount = 0;
      globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;

        fetchCallCount++;

        // First two calls: known PDF URLs — fail
        if (fetchCallCount <= 2 && urlStr.endsWith('.pdf')) {
          return { ok: false, status: 404 } as Response;
        }

        // Third call: FSCA page HTML — return page with PDF link
        if (urlStr.includes('Crypto-Assets.aspx')) {
          return {
            ok: true,
            text: async () => fscaHtml,
          } as unknown as Response;
        }

        // Fourth call: PDF found via scraping — succeed
        if (urlStr.endsWith('.pdf')) {
          return {
            ok: true,
            arrayBuffer: async () => new ArrayBuffer(64),
          } as unknown as Response;
        }

        throw new Error(`Unexpected fetch: ${urlStr}`);
      });

      setPdfText('Name  FSP Number\n1. TestCASP FSP 99999 Category I');

      const result = await parser.parse();
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].name).toBe('TestCASP');
    });
  });

  // ── ParseResult metadata ─────────────────────────────────────────────────

  describe('ParseResult metadata', () => {
    beforeEach(() => {
      setPdfText('Name  FSP Number\n1. SomeEntity FSP 11111 Category I');
    });

    it('returns correct registryId and countryCode', async () => {
      const result = await parser.parse();
      expect(result.registryId).toBe('za-fsca');
      expect(result.countryCode).toBe('ZA');
    });

    it('returns a valid ISO timestamp', async () => {
      const result = await parser.parse();
      expect(() => new Date(result.timestamp)).not.toThrow();
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
    });

    it('returns durationMs as a non-negative number', async () => {
      const result = await parser.parse();
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ── Bare 5+ digit license numbers (no FSP/CASP prefix) ──────────────────

  describe('bare numeric license numbers', () => {
    const tableText = [
      'Name  License Number  Category',
      '1. CryptoExchange ZA 12345 Category I',
      '2. BlockchainPay SA 67890 Category II',
    ].join('\n');

    beforeEach(() => setPdfText(tableText));

    it('matches bare 5+ digit numbers as license numbers', async () => {
      const result = await parser.parse();
      expect(result.entities).toHaveLength(2);
      expect(result.entities[0].licenseNumber).toBe('12345');
      expect(result.entities[1].licenseNumber).toBe('67890');
    });
  });
});
