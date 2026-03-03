/**
 * Tests for Excel-based registry parsers: JP-FSA, CA-FINTRAC, CH-FINMA.
 *
 * Creates in-memory XLSX workbooks with the `xlsx` library and mocks
 * `global.fetch` so parsers never hit the network.
 */

import * as XLSX from 'xlsx';
import { JpFsaParser } from '../registries/jp-fsa.js';
import { CaFintracParser } from '../registries/ca-fintrac.js';
import { ChFinmaParser } from '../registries/ch-finma.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build an ArrayBuffer from an array-of-arrays worksheet via xlsx. */
function buildXlsx(data: (string | number | null)[][], sheetName = 'Sheet1'): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  // XLSX.write with type:'array' returns an ArrayBuffer directly
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

/** Build an ArrayBuffer from an array of objects (first row = headers). */
function buildXlsxFromObjects(
  rows: Record<string, string | number>[],
  sheetName = 'Sheet1',
): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

/** Create a mock Response that resolves with the given ArrayBuffer. */
function okResponse(buf: ArrayBuffer): Response {
  return {
    ok: true,
    status: 200,
    arrayBuffer: () => Promise.resolve(buf),
  } as unknown as Response;
}

function errorResponse(status: number): Response {
  return {
    ok: false,
    status,
    arrayBuffer: () => Promise.reject(new Error(`HTTP ${status}`)),
  } as unknown as Response;
}

// Silence logger output during tests
vi.mock('../core/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// JP-FSA
// ---------------------------------------------------------------------------

describe('JpFsaParser', () => {
  let parser: JpFsaParser;

  beforeEach(() => {
    parser = new JpFsaParser();
    vi.restoreAllMocks();
  });

  it('has correct config', () => {
    expect(parser.config.id).toBe('jp-fsa');
    expect(parser.config.countryCode).toBe('JP');
    expect(parser.config.country).toBe('Japan');
  });

  it('parses entities from an Excel file with metadata rows', async () => {
    // Simulate real FSA format: 6 metadata rows, then header, then data
    const data: (string | number | null)[][] = [
      ['Ministry of Finance', null, null, null, null, null, null, null, null],
      ['Financial Services Agency', null, null, null, null, null, null, null, null],
      ['List of Crypto-Asset Exchange Service Providers', null, null, null, null, null, null, null, null],
      ['As of 2024-01-15', null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null],
      // Header row (index 6) — contains "Registration" and "Name"
      [
        'Finance Bureau',
        'Registration Number',
        'Date of Registration',
        'Name',
        'Corporate Number',
        'Postal Code',
        'Address',
        'Phone Number',
        'Crypto-assets handled',
      ],
      // Data rows
      [
        'Kanto',
        'Director of the Kanto Local Finance Bureau No.00001',
        '2017-04-01',
        'bitFlyer, Inc.',
        '1234567890123',
        '107-6233',
        'Tokyo',
        '03-1234-5678',
        'BTC, ETH',
      ],
      [
        'Kanto',
        'Director of the Kanto Local Finance Bureau No.00003',
        '2017-04-01',
        'Coincheck, Inc.',
        '9876543210987',
        '150-0001',
        'Tokyo',
        '03-9876-5432',
        'BTC, ETH, XRP',
      ],
      [
        'Kinki',
        'Director of the Kinki Local Finance Bureau No.00001',
        '2017-04-01',
        'Zaif Exchange',
        '5555555555555',
        '530-0001',
        'Osaka',
        '06-1111-2222',
        'BTC',
      ],
    ];

    const buf = buildXlsx(data);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(buf));

    const result = await parser.parse();

    expect(result.registryId).toBe('jp-fsa');
    expect(result.countryCode).toBe('JP');
    expect(result.entities).toHaveLength(3);
    expect(result.totalFound).toBe(3);
    expect(result.errors).toHaveLength(0);

    // Check first entity
    const e0 = result.entities[0];
    expect(e0.name).toBe('bitFlyer, Inc.');
    expect(e0.licenseNumber).toBe('No.00001');
    expect(e0.countryCode).toBe('JP');
    expect(e0.status).toBe('Registered');
    expect(e0.regulator).toBe('FSA');
    expect(e0.licenseType).toBe('Crypto-Asset Exchange Service Provider');
    expect(e0.activities).toEqual(['BTC', 'ETH']);
    expect(e0.entityTypes).toEqual(['Corp: 1234567890123']);
    expect(e0.sourceUrl).toContain('fsa.go.jp');

    // Check third entity
    const e2 = result.entities[2];
    expect(e2.name).toBe('Zaif Exchange');
    expect(e2.licenseNumber).toBe('No.00001'); // different bureau, same local number
    expect(e2.activities).toEqual(['BTC']);
  });

  it('auto-detects header row at a non-standard position', async () => {
    // Header at row index 3 instead of the typical 6
    const data: (string | number | null)[][] = [
      ['Some metadata', null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null, null],
      // Header at index 3
      [
        'Bureau',
        'Registration Number',
        'Date',
        'Name of Exchange',
        'Corp No',
        'Postal',
        'Address',
        'Phone',
        'Assets',
      ],
      // Data
      [
        'Kanto',
        'No.00099',
        '2023-01-01',
        'Test Exchange',
        '1111111111111',
        '100-0001',
        'Tokyo',
        '03-0000-0000',
        'BTC, DOGE',
      ],
    ];

    const buf = buildXlsx(data);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(buf));

    const result = await parser.parse();

    expect(result.entities).toHaveLength(1);
    expect(result.entities[0].name).toBe('Test Exchange');
    expect(result.entities[0].licenseNumber).toBe('No.00099');
    expect(result.warnings).toHaveLength(0); // header was detected, no fallback warning
  });

  it('skips rows without name or registration number', async () => {
    const data: (string | number | null)[][] = [
      [
        'Bureau',
        'Registration Number',
        'Date',
        'Name',
        'Corp',
        'Postal',
        'Address',
        'Phone',
        'Assets',
      ],
      // Row with name but no registration number
      ['Kanto', '', '2023-01-01', 'Orphan Entity', '', '', '', '', 'BTC'],
      // Row with registration but no name
      ['Kanto', 'No.00010', '2023-01-01', '', '', '', '', '', 'ETH'],
      // Valid row
      ['Kanto', 'No.00020', '2023-01-01', 'Valid Exchange', '123', '', '', '', 'BTC'],
    ];

    const buf = buildXlsx(data);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(buf));

    const result = await parser.parse();

    expect(result.entities).toHaveLength(1);
    expect(result.entities[0].name).toBe('Valid Exchange');
    // "Orphan Entity" should generate a warning (name without regNumber)
    expect(result.warnings.some((w) => w.includes('Orphan Entity'))).toBe(true);
  });

  it('falls back to row 6 when no header is detected', async () => {
    // First 15 rows contain nothing matching "registration" + "name"
    const data: (string | number | null)[][] = [
      ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'],
      ['x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x'],
      ['x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x'],
      ['x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x'],
      ['x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x'],
      ['x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x'],
      // Row 6 treated as header (skipped as data)
      ['Bureau', 'RegNo', 'Date', 'CompanyName', 'Corp', 'Post', 'Addr', 'Tel', 'Crypto'],
      // Row 7 = data
      ['Kanto', 'No.00050', '2024-01-01', 'Fallback Corp', '999', '100', 'Tokyo', '03', 'BTC'],
    ];

    const buf = buildXlsx(data);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(buf));

    const result = await parser.parse();

    expect(result.warnings.some((w) => w.includes('defaulting to row 6'))).toBe(true);
    expect(result.entities).toHaveLength(1);
    expect(result.entities[0].name).toBe('Fallback Corp');
  });

  it('handles entities without corporate number', async () => {
    const data: (string | number | null)[][] = [
      [
        'Bureau',
        'Registration Number',
        'Date',
        'Name',
        'Corporate Number',
        'Postal',
        'Addr',
        'Phone',
        'Assets',
      ],
      ['Kanto', 'No.00001', '2024-01-01', 'NoCorp Exchange', '', '', '', '', ''],
    ];

    const buf = buildXlsx(data);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(buf));

    const result = await parser.parse();

    expect(result.entities).toHaveLength(1);
    expect(result.entities[0].entityTypes).toBeUndefined();
    // No crypto assets listed -> default activity
    expect(result.entities[0].activities).toEqual(['Crypto-Asset Exchange']);
  });

  it('throws on HTTP error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(errorResponse(404));

    await expect(parser.parse()).rejects.toThrow('HTTP 404');
  });
});

// ---------------------------------------------------------------------------
// CA-FINTRAC
// ---------------------------------------------------------------------------

describe('CaFintracParser', () => {
  let parser: CaFintracParser;

  beforeEach(() => {
    parser = new CaFintracParser();
    vi.restoreAllMocks();
  });

  it('has correct config', () => {
    expect(parser.config.id).toBe('ca-fintrac');
    expect(parser.config.countryCode).toBe('CA');
    expect(parser.config.country).toBe('Canada');
  });

  it('filters crypto-related MSBs and ignores non-crypto', async () => {
    const rows = [
      // 3 crypto-related
      {
        'Legal Name': 'Crypto Corp',
        'Registration Number': 'M08000001',
        'Operating Name': 'CryptoCo',
        'MSB Activities': 'Foreign exchange dealing; Dealing in virtual currencies',
        'Status': 'Registered',
      },
      {
        'Legal Name': 'Bitcoin ATM Inc',
        'Registration Number': 'M08000002',
        'Operating Name': '',
        'MSB Activities': 'Virtual Currency exchange',
        'Status': 'Active',
      },
      {
        'Legal Name': 'Digital Money Ltd',
        'Registration Number': 'M08000003',
        'Operating Name': 'DigiMoney',
        'MSB Activities': 'Money transfer; Crypto services',
        'Status': 'Registered',
      },
      // 2 non-crypto (should be excluded)
      {
        'Legal Name': 'Pure FX House',
        'Registration Number': 'M08000004',
        'Operating Name': '',
        'MSB Activities': 'Foreign exchange dealing',
        'Status': 'Registered',
      },
      {
        'Legal Name': 'Money Transfer Co',
        'Registration Number': 'M08000005',
        'Operating Name': '',
        'MSB Activities': 'Money transferring',
        'Status': 'Registered',
      },
    ];

    const buf = buildXlsxFromObjects(rows);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(buf));

    const result = await parser.parse();

    expect(result.registryId).toBe('ca-fintrac');
    expect(result.countryCode).toBe('CA');
    expect(result.entities).toHaveLength(3);
    expect(result.totalFound).toBe(3);

    const names = result.entities.map((e) => e.name);
    expect(names).toContain('Crypto Corp');
    expect(names).toContain('Bitcoin ATM Inc');
    expect(names).toContain('Digital Money Ltd');
    expect(names).not.toContain('Pure FX House');
    expect(names).not.toContain('Money Transfer Co');
  });

  it('maps entity fields correctly', async () => {
    const rows = [
      {
        'Legal Name': 'Acme Crypto Inc.',
        'Registration Number': 'M12345678',
        'Operating Name': 'AcmeCrypto',
        'MSB Activities': 'Dealing in virtual currencies; Money transfer',
        'Status': 'Active',
      },
    ];

    const buf = buildXlsxFromObjects(rows);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(buf));

    const result = await parser.parse();
    const entity = result.entities[0];

    expect(entity.name).toBe('Acme Crypto Inc.');
    expect(entity.licenseNumber).toBe('M12345678');
    expect(entity.countryCode).toBe('CA');
    expect(entity.country).toBe('Canada');
    expect(entity.status).toBe('Active');
    expect(entity.regulator).toBe('FINTRAC');
    expect(entity.licenseType).toBe('MSB Registration');
    expect(entity.activities).toEqual(['Dealing in virtual currencies', 'Money transfer']);
    expect(entity.entityTypes).toEqual(['AcmeCrypto']);
    expect(entity.sourceUrl).toContain('fintrac');
  });

  it('generates a fallback license number when registration number is missing', async () => {
    const rows = [
      {
        'Legal Name': 'No Reg Number Ltd',
        'Registration Number': '',
        'Operating Name': '',
        'MSB Activities': 'Dealing in virtual currencies',
        'Status': 'Registered',
      },
    ];

    const buf = buildXlsxFromObjects(rows);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(buf));

    const result = await parser.parse();

    expect(result.entities).toHaveLength(1);
    expect(result.entities[0].licenseNumber).toMatch(/^FINTRAC-/);
  });

  it('skips rows with no name', async () => {
    const rows = [
      {
        'Legal Name': '',
        'Registration Number': 'M99999999',
        'Operating Name': '',
        'MSB Activities': 'Dealing in virtual currencies',
        'Status': 'Registered',
      },
    ];

    const buf = buildXlsxFromObjects(rows);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(buf));

    const result = await parser.parse();

    expect(result.entities).toHaveLength(0);
    expect(result.warnings.some((w) => w.includes('no name'))).toBe(true);
  });

  it('handles alternative column names via case-insensitive matching', async () => {
    // Use underscore-separated column names instead of space-separated
    const rows = [
      {
        legal_name: 'Alt Column Corp',
        registration_number: 'M00000001',
        operating_name: 'AltCol',
        msb_activities: 'Virtual currency exchange',
        Status: 'Registered',
      },
    ];

    const buf = buildXlsxFromObjects(rows);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(buf));

    const result = await parser.parse();

    expect(result.entities).toHaveLength(1);
    expect(result.entities[0].name).toBe('Alt Column Corp');
    expect(result.entities[0].licenseNumber).toBe('M00000001');
  });

  it('returns empty when no rows match crypto keywords', async () => {
    const rows = [
      {
        'Legal Name': 'Regular Bank',
        'Registration Number': 'M11111111',
        'Operating Name': '',
        'MSB Activities': 'Money transferring; Foreign exchange',
        'Status': 'Registered',
      },
    ];

    const buf = buildXlsxFromObjects(rows);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(buf));

    const result = await parser.parse();

    expect(result.entities).toHaveLength(0);
    expect(result.totalFound).toBe(0);
  });

  it('throws on HTTP error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(errorResponse(500));

    await expect(parser.parse()).rejects.toThrow('HTTP 500');
  });
});

// ---------------------------------------------------------------------------
// CH-FINMA
// ---------------------------------------------------------------------------

describe('ChFinmaParser', () => {
  let parser: ChFinmaParser;

  const FINTECH_URL_PATTERN = 'fintech.xlsx';
  const BANKS_URL_PATTERN = 'beh.xlsx';

  /** Mock fetch to return different buffers based on URL pattern. */
  function mockBothFetches(fintechBuf: ArrayBuffer, banksBuf: ArrayBuffer) {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes(FINTECH_URL_PATTERN)) return okResponse(fintechBuf);
      if (url.includes(BANKS_URL_PATTERN)) return okResponse(banksBuf);
      return errorResponse(404);
    });
  }

  beforeEach(() => {
    parser = new ChFinmaParser();
    vi.restoreAllMocks();
  });

  it('has correct config', () => {
    expect(parser.config.id).toBe('ch-finma');
    expect(parser.config.countryCode).toBe('CH');
    expect(parser.config.country).toBe('Switzerland');
  });

  it('includes all FinTech entities and filters banks for crypto keywords', async () => {
    // FinTech entities (all included, no filtering)
    const fintechRows = [
      { Name: 'Crypto Finance AG', Category: 'FinTech' },
      { Name: 'SwissQuant Tech', Category: 'FinTech' },
      { Name: 'Hypothekarbank Lenzburg', Category: 'FinTech' },
    ];

    // Banks (only crypto-related pass the filter)
    const bankRows = [
      { Name: 'SEBA Bank AG', Category: 'Bank' },              // crypto: matches "seba"
      { Name: 'Sygnum Bank AG', Category: 'Bank' },             // crypto: matches "sygnum"
      { Name: 'UBS AG', Category: 'Bank' },                     // NOT crypto
      { Name: 'Zurich Cantonal Bank', Category: 'Bank' },       // NOT crypto
      { Name: 'Bitcoin Suisse AG', Category: 'Securities Firm' }, // crypto: matches "bitcoin"
    ];

    const fintechBuf = buildXlsxFromObjects(fintechRows);
    const banksBuf = buildXlsxFromObjects(bankRows);
    mockBothFetches(fintechBuf, banksBuf);

    const result = await parser.parse();

    expect(result.registryId).toBe('ch-finma');
    expect(result.countryCode).toBe('CH');
    // 3 fintech + 3 crypto banks
    expect(result.entities).toHaveLength(6);
    expect(result.totalFound).toBe(6);

    const names = result.entities.map((e) => e.name);
    // All FinTech
    expect(names).toContain('Crypto Finance AG');
    expect(names).toContain('SwissQuant Tech');
    expect(names).toContain('Hypothekarbank Lenzburg');
    // Crypto banks
    expect(names).toContain('SEBA Bank AG');
    expect(names).toContain('Sygnum Bank AG');
    expect(names).toContain('Bitcoin Suisse AG');
    // Non-crypto banks excluded
    expect(names).not.toContain('UBS AG');
    expect(names).not.toContain('Zurich Cantonal Bank');
  });

  it('sets licenseType correctly for FinTech vs Bank entities', async () => {
    const fintechRows = [{ Name: 'FinTech One', Category: 'FinTech' }];
    const bankRows = [{ Name: 'Crypto Bank AG', Category: 'Bank' }];

    const fintechBuf = buildXlsxFromObjects(fintechRows);
    const banksBuf = buildXlsxFromObjects(bankRows);
    mockBothFetches(fintechBuf, banksBuf);

    const result = await parser.parse();

    const fintechEntity = result.entities.find((e) => e.name === 'FinTech One');
    const bankEntity = result.entities.find((e) => e.name === 'Crypto Bank AG');

    expect(fintechEntity?.licenseType).toBe('FinTech Licence');
    expect(bankEntity?.licenseType).toBe('Bank/Securities Firm');
  });

  it('maps entity fields correctly', async () => {
    const fintechRows = [{ Name: 'Test FinTech AG', Category: 'FinTech Licence' }];
    const bankRows: Record<string, string>[] = [];

    const fintechBuf = buildXlsxFromObjects(fintechRows);
    const banksBuf = buildXlsxFromObjects(bankRows);
    mockBothFetches(fintechBuf, banksBuf);

    const result = await parser.parse();
    const entity = result.entities[0];

    expect(entity.name).toBe('Test FinTech AG');
    expect(entity.licenseNumber).toMatch(/^FINMA-/);
    expect(entity.countryCode).toBe('CH');
    expect(entity.country).toBe('Switzerland');
    expect(entity.status).toBe('Authorized');
    expect(entity.regulator).toBe('FINMA');
    expect(entity.activities).toEqual(['FinTech Licence']);
    expect(entity.sourceUrl).toContain('fintech.xlsx');
  });

  it('uses alternative column names (Institution, Kategorie)', async () => {
    // German column names
    const fintechRows = [
      { Institution: 'Deutsche Fintech GmbH', Kategorie: 'FinTech-Bewilligung' },
    ];
    const bankRows: Record<string, string>[] = [];

    const fintechBuf = buildXlsxFromObjects(fintechRows);
    const banksBuf = buildXlsxFromObjects(bankRows);
    mockBothFetches(fintechBuf, banksBuf);

    const result = await parser.parse();

    expect(result.entities).toHaveLength(1);
    expect(result.entities[0].name).toBe('Deutsche Fintech GmbH');
    expect(result.entities[0].activities).toEqual(['FinTech-Bewilligung']);
  });

  it('skips rows without a name', async () => {
    const fintechRows = [
      { Name: '', Category: 'FinTech' },
      { Name: 'Valid Entity', Category: 'FinTech' },
    ];
    const bankRows: Record<string, string>[] = [];

    const fintechBuf = buildXlsxFromObjects(fintechRows);
    const banksBuf = buildXlsxFromObjects(bankRows);
    mockBothFetches(fintechBuf, banksBuf);

    const result = await parser.parse();

    expect(result.entities).toHaveLength(1);
    expect(result.entities[0].name).toBe('Valid Entity');
  });

  it('continues when FinTech fetch fails and still returns banks', async () => {
    const bankRows = [{ Name: 'Sygnum Bank AG', Category: 'Bank' }];
    const banksBuf = buildXlsxFromObjects(bankRows);

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes(FINTECH_URL_PATTERN)) return errorResponse(503);
      if (url.includes(BANKS_URL_PATTERN)) return okResponse(banksBuf);
      return errorResponse(404);
    });

    const result = await parser.parse();

    // Should still have the bank entity
    expect(result.entities).toHaveLength(1);
    expect(result.entities[0].name).toBe('Sygnum Bank AG');
    // Should record a warning about the failed FinTech fetch
    expect(result.warnings.some((w) => w.includes('FinTech'))).toBe(true);
  });

  it('continues when banks fetch fails and still returns FinTech', async () => {
    const fintechRows = [{ Name: 'Solo FinTech AG', Category: 'FinTech' }];
    const fintechBuf = buildXlsxFromObjects(fintechRows);

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes(FINTECH_URL_PATTERN)) return okResponse(fintechBuf);
      if (url.includes(BANKS_URL_PATTERN)) return errorResponse(502);
      return errorResponse(404);
    });

    const result = await parser.parse();

    expect(result.entities).toHaveLength(1);
    expect(result.entities[0].name).toBe('Solo FinTech AG');
    expect(result.warnings.some((w) => w.includes('banks'))).toBe(true);
  });

  it('returns empty entities when both fetches fail', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(errorResponse(500));

    const result = await parser.parse();

    expect(result.entities).toHaveLength(0);
    expect(result.warnings).toHaveLength(2);
  });

  it('matches all crypto keywords for bank filtering', async () => {
    // Each bank name contains a different keyword from CRYPTO_KEYWORDS
    const bankRows = [
      { Name: 'Crypto AG', Category: 'Bank' },          // "crypto"
      { Name: 'Bitcoin House', Category: 'Bank' },       // "bitcoin"
      { Name: 'Digital Asset Bank', Category: 'Bank' },  // "digital asset"
      { Name: 'Blockchain Corp', Category: 'Bank' },     // "blockchain"
      { Name: 'Token Bank AG', Category: 'Bank' },       // "token"
      { Name: 'SEBA Investment', Category: 'Bank' },     // "seba"
      { Name: 'Sygnum Capital', Category: 'Bank' },      // "sygnum"
      { Name: 'Amina Group AG', Category: 'Bank' },      // "amina"
      { Name: 'Leonteq Securities', Category: 'Bank' },  // "leonteq"
      { Name: '21Shares AG', Category: 'Bank' },         // "21shares"
      { Name: 'Taurus Group', Category: 'Bank' },        // "taurus"
      { Name: 'Plain Vanilla Bank', Category: 'Bank' },  // no keyword -> excluded
    ];

    const fintechBuf = buildXlsxFromObjects([]);
    const banksBuf = buildXlsxFromObjects(bankRows);
    mockBothFetches(fintechBuf, banksBuf);

    const result = await parser.parse();

    // 11 crypto-related, 1 excluded
    expect(result.entities).toHaveLength(11);
    expect(result.entities.map((e) => e.name)).not.toContain('Plain Vanilla Bank');
  });
});
