/**
 * Tests for ESMA-based CASP parsers:
 * - Shared helper: fetchEsmaCaspEntities (esma-casp.ts)
 * - DE wrapper: DeBafinParser (de-bafin.ts)
 * - FR wrapper: FrAmfParser (fr-amf.ts)
 * - NL wrapper: NlDnbParser (nl-dnb.ts)
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ── Fixture CSV ──────────────────────────────────────────────────────

const fixturePath = resolve(__dirname, 'fixtures/esma-casp.csv');
const fixtureCsv = readFileSync(fixturePath, 'utf-8');

// ── Fetch mock ───────────────────────────────────────────────────────

/**
 * We mock global.fetch so that any request to an ESMA CSV URL returns
 * our fixture. The real csv-parse/sync still runs so we're testing the
 * full CSV-parsing + filtering pipeline.
 */
function mockFetchWithFixture() {
  const mockFetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
    async () =>
      new Response(fixtureCsv, {
        status: 200,
        headers: { 'Content-Type': 'text/csv' },
      }),
  );
  vi.stubGlobal('fetch', mockFetch);
  return mockFetch;
}

function mockFetchWithFailure(status = 404) {
  const mockFetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
    async () =>
      new Response('Not Found', {
        status,
        statusText: 'Not Found',
      }),
  );
  vi.stubGlobal('fetch', mockFetch);
  return mockFetch;
}

// ── Suppress logger noise during tests ───────────────────────────────

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
});

afterAll(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// =====================================================================
// 1. SHARED HELPER — fetchEsmaCaspEntities
// =====================================================================

describe('fetchEsmaCaspEntities (esma-casp shared helper)', () => {
  it('filters rows by DE country code and returns correct entities', async () => {
    mockFetchWithFixture();

    const { fetchEsmaCaspEntities } = await import('../core/esma-casp.js');
    const { entities, warnings, sourceUrl } = await fetchEsmaCaspEntities('DE', 'test-de');

    expect(entities).toHaveLength(2);
    expect(sourceUrl).toContain('esma.europa.eu');

    // First DE entity
    const dk = entities.find((e) => e.name === 'Deutsche Krypto GmbH');
    expect(dk).toBeDefined();
    expect(dk!.licenseNumber).toBe('529900ABCDEF123456DE');
    expect(dk!.countryCode).toBe('DE');
    expect(dk!.country).toBe('Germany');
    expect(dk!.regulator).toBe('BaFin');
    expect(dk!.licenseType).toBe('MiCAR CASP');
    expect(dk!.status).toBe('Authorized');
    expect(dk!.activities).toEqual(['CS01', 'CS02']);
    expect(dk!.website).toBe('https://dk-exchange.de');

    // Second DE entity (no website)
    const bb = entities.find((e) => e.name === 'Berlin Blockchain AG');
    expect(bb).toBeDefined();
    expect(bb!.website).toBeUndefined();

    // No warnings for a country with results
    expect(warnings).toEqual([]);
  });

  it('filters rows by FR country code; detects expired status', async () => {
    mockFetchWithFixture();

    const { fetchEsmaCaspEntities } = await import('../core/esma-casp.js');
    const { entities, warnings } = await fetchEsmaCaspEntities('FR', 'test-fr');

    expect(entities).toHaveLength(2);

    const active = entities.find((e) => e.name === 'Paris Crypto SAS');
    expect(active).toBeDefined();
    expect(active!.status).toBe('Authorized');
    expect(active!.regulator).toBe('AMF');
    expect(active!.activities).toEqual(['CS01', 'CS04']);

    // Lyon entity has an end date -> expired
    const expired = entities.find((e) => e.licenseNumber === '529900STUVWX901234FR');
    expect(expired).toBeDefined();
    expect(expired!.status).toBe('Expired');
    // When ae_lei_name is empty, should fall back to ae_commercial_name
    // Here the CSV has a legal name, so it uses that
    expect(expired!.name).toBe('Lyon Digital Assets SA');

    expect(warnings).toEqual([]);
  });

  it('filters rows by NL country code; skips rows with no name', async () => {
    mockFetchWithFixture();

    const { fetchEsmaCaspEntities } = await import('../core/esma-casp.js');
    const { entities, warnings } = await fetchEsmaCaspEntities('NL', 'test-nl');

    // Only 1 valid NL row (the second NL row has no name -> skipped)
    expect(entities).toHaveLength(1);

    const ams = entities[0];
    expect(ams.name).toBe('Amsterdam Digital BV');
    expect(ams.countryCode).toBe('NL');
    expect(ams.country).toBe('Netherlands');
    expect(ams.regulator).toBe('AFM');
    expect(ams.activities).toEqual(['CS01', 'CS02', 'CS03']);
    expect(ams.website).toBe('https://amsdigital.nl');

    // Warning about skipped row
    expect(warnings).toContain('Skipping row: no name found');
  });

  it('returns warning when no entities match the country code', async () => {
    mockFetchWithFixture();

    const { fetchEsmaCaspEntities } = await import('../core/esma-casp.js');
    const { entities, warnings } = await fetchEsmaCaspEntities('XX', 'test-xx');

    expect(entities).toHaveLength(0);
    expect(warnings).toContain('No entities found for country XX in ESMA register');
  });

  it('throws when all ESMA CSV URLs fail', async () => {
    mockFetchWithFailure(404);

    const { fetchEsmaCaspEntities } = await import('../core/esma-casp.js');

    await expect(fetchEsmaCaspEntities('DE', 'test-fail')).rejects.toThrow(
      'Failed to fetch ESMA CASP CSV from any known URL',
    );
  });

  it('uses commercial name when legal name is empty', async () => {
    // Build a CSV where ae_lei_name is empty but ae_commercial_name exists
    const csv = [
      'ae_homeMemberState,ae_lei,ae_lei_name,ae_commercial_name,ac_serviceCode,ac_authorisationEndDate,ae_website',
      'DE,LEI001,,BrandOnly Corp,CS01,,',
    ].join('\n');

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(csv, { status: 200 })),
    );

    const { fetchEsmaCaspEntities } = await import('../core/esma-casp.js');
    const { entities } = await fetchEsmaCaspEntities('DE', 'test-fallback');

    expect(entities).toHaveLength(1);
    expect(entities[0].name).toBe('BrandOnly Corp');
  });

  it('generates a fallback license number when LEI is missing', async () => {
    const csv = [
      'ae_homeMemberState,ae_lei,ae_lei_name,ae_commercial_name,ac_serviceCode,ac_authorisationEndDate,ae_website',
      'FR,,Société Sans LEI,,CS02,,',
    ].join('\n');

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(csv, { status: 200 })),
    );

    const { fetchEsmaCaspEntities } = await import('../core/esma-casp.js');
    const { entities } = await fetchEsmaCaspEntities('FR', 'test-no-lei');

    expect(entities).toHaveLength(1);
    expect(entities[0].licenseNumber).toMatch(/^MICA-FR-/);
  });
});

// =====================================================================
// 2. DE-BAFIN PARSER
// =====================================================================

describe('DeBafinParser', () => {
  it('has correct config', async () => {
    const { DeBafinParser } = await import('../registries/de-bafin.js');
    const parser = new DeBafinParser();

    expect(parser.config.id).toBe('de-bafin');
    expect(parser.config.countryCode).toBe('DE');
    expect(parser.config.country).toBe('Germany');
    expect(parser.config.sourceType).toBe('csv');
    expect(parser.config.needsBrowser).toBe(false);
  });

  it('parse() returns valid ParseResult with DE entities', async () => {
    mockFetchWithFixture();

    const { DeBafinParser } = await import('../registries/de-bafin.js');
    const parser = new DeBafinParser();
    const result = await parser.parse();

    expect(result.registryId).toBe('de-bafin');
    expect(result.countryCode).toBe('DE');
    expect(result.entities).toHaveLength(2);
    expect(result.totalFound).toBe(2);
    expect(result.errors).toEqual([]);
    expect(result.timestamp).toBeTruthy();
    expect(result.durationMs).toBeGreaterThanOrEqual(0);

    // Regulator overridden to 'BaFin' (not the ESMA default)
    for (const entity of result.entities) {
      expect(entity.regulator).toBe('BaFin');
    }
  });

  it('parse() has no FR or NL entities', async () => {
    mockFetchWithFixture();

    const { DeBafinParser } = await import('../registries/de-bafin.js');
    const parser = new DeBafinParser();
    const result = await parser.parse();

    const nonDe = result.entities.filter((e) => e.countryCode !== 'DE');
    expect(nonDe).toHaveLength(0);
  });
});

// =====================================================================
// 3. FR-AMF PARSER
// =====================================================================

describe('FrAmfParser', () => {
  it('has correct config', async () => {
    const { FrAmfParser } = await import('../registries/fr-amf.js');
    const parser = new FrAmfParser();

    expect(parser.config.id).toBe('fr-amf');
    expect(parser.config.countryCode).toBe('FR');
    expect(parser.config.country).toBe('France');
    expect(parser.config.sourceType).toBe('csv');
  });

  it('parse() returns valid ParseResult with FR entities', async () => {
    mockFetchWithFixture();

    const { FrAmfParser } = await import('../registries/fr-amf.js');
    const parser = new FrAmfParser();
    const result = await parser.parse();

    expect(result.registryId).toBe('fr-amf');
    expect(result.countryCode).toBe('FR');
    expect(result.entities).toHaveLength(2);
    expect(result.totalFound).toBe(2);
    expect(result.errors).toEqual([]);
    expect(result.timestamp).toBeTruthy();

    // Regulator overridden to 'AMF'
    for (const entity of result.entities) {
      expect(entity.regulator).toBe('AMF');
    }
  });

  it('parse() includes both authorized and expired entities', async () => {
    mockFetchWithFixture();

    const { FrAmfParser } = await import('../registries/fr-amf.js');
    const parser = new FrAmfParser();
    const result = await parser.parse();

    const statuses = result.entities.map((e) => e.status);
    expect(statuses).toContain('Authorized');
    expect(statuses).toContain('Expired');
  });
});

// =====================================================================
// 4. NL-DNB PARSER
// =====================================================================

describe('NlDnbParser', () => {
  it('has correct config', async () => {
    const { NlDnbParser } = await import('../registries/nl-dnb.js');
    const parser = new NlDnbParser();

    expect(parser.config.id).toBe('nl-dnb');
    expect(parser.config.countryCode).toBe('NL');
    expect(parser.config.country).toBe('Netherlands');
    expect(parser.config.sourceType).toBe('csv');
  });

  it('parse() returns valid ParseResult with NL entities', async () => {
    mockFetchWithFixture();

    const { NlDnbParser } = await import('../registries/nl-dnb.js');
    const parser = new NlDnbParser();
    const result = await parser.parse();

    expect(result.registryId).toBe('nl-dnb');
    expect(result.countryCode).toBe('NL');
    // Only 1 valid NL entity (row with no name is skipped)
    expect(result.entities).toHaveLength(1);
    expect(result.totalFound).toBe(1);
    expect(result.errors).toEqual([]);
    expect(result.timestamp).toBeTruthy();

    // Regulator overridden to 'AFM'
    for (const entity of result.entities) {
      expect(entity.regulator).toBe('AFM');
    }
  });

  it('parse() warnings include skipped row notice', async () => {
    mockFetchWithFixture();

    const { NlDnbParser } = await import('../registries/nl-dnb.js');
    const parser = new NlDnbParser();
    const result = await parser.parse();

    expect(result.warnings).toContain('Skipping row: no name found');
  });
});

// =====================================================================
// 5. PARSERESULT SHAPE VALIDATION
// =====================================================================

describe('ParseResult shape contract', () => {
  it('every parser result has all required fields', async () => {
    mockFetchWithFixture();

    const { DeBafinParser } = await import('../registries/de-bafin.js');
    const { FrAmfParser } = await import('../registries/fr-amf.js');
    const { NlDnbParser } = await import('../registries/nl-dnb.js');

    const parsers = [new DeBafinParser(), new FrAmfParser(), new NlDnbParser()];

    for (const parser of parsers) {
      const result = await parser.parse();

      // Required fields exist and have correct types
      expect(typeof result.registryId).toBe('string');
      expect(typeof result.countryCode).toBe('string');
      expect(Array.isArray(result.entities)).toBe(true);
      expect(typeof result.totalFound).toBe('number');
      expect(typeof result.durationMs).toBe('number');
      expect(Array.isArray(result.warnings)).toBe(true);
      expect(Array.isArray(result.errors)).toBe(true);
      expect(typeof result.timestamp).toBe('string');

      // Timestamp is valid ISO
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);

      // totalFound matches entities length
      expect(result.totalFound).toBe(result.entities.length);

      // Each entity has all required ParsedEntity fields
      for (const entity of result.entities) {
        expect(typeof entity.name).toBe('string');
        expect(entity.name.length).toBeGreaterThan(0);
        expect(typeof entity.licenseNumber).toBe('string');
        expect(entity.licenseNumber.length).toBeGreaterThan(0);
        expect(typeof entity.countryCode).toBe('string');
        expect(entity.countryCode).toHaveLength(2);
        expect(typeof entity.country).toBe('string');
        expect(typeof entity.sourceUrl).toBe('string');
        expect(entity.sourceUrl).toContain('http');
      }
    }
  });
});
