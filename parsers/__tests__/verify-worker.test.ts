/**
 * Tests for the verification worker (parsers/workers/verify.ts).
 *
 * Now that verify.ts exports its functions, we import them directly
 * and test each check + the main runner.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock sendTelegramAlert & logger ───────────────────────
// vi.hoisted ensures these are available when vi.mock factories run (which are hoisted)
const { mockSendTelegramAlert, mockLogger } = vi.hoisted(() => ({
  mockSendTelegramAlert: vi.fn().mockResolvedValue(undefined),
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../core/logger.js', () => ({
  sendTelegramAlert: mockSendTelegramAlert,
  logger: mockLogger,
}));

// ─── Supabase chain builder ────────────────────────────────
interface MockQueryResult {
  data?: unknown;
  error?: { message: string } | null;
  count?: number | null;
}

function createMockChain(result: MockQueryResult) {
  const chain: Record<string, unknown> = {};
  const self = new Proxy(chain, {
    get(_target, prop) {
      if (prop === 'then') {
        return (resolve: (v: MockQueryResult) => void) => resolve(result);
      }
      return vi.fn().mockReturnValue(self);
    },
  });
  return self;
}

// Map of table name -> array of results (consumed in order)
let tableResults: Map<string, MockQueryResult[]>;

function createMockSupabaseClient() {
  return {
    from: vi.fn((table: string) => {
      const results = tableResults.get(table) ?? [{ data: [], error: null }];
      // Shift from front to serve sequential queries to same table
      const result = results.length > 1 ? results.shift()! : results[0];
      return createMockChain(result);
    }),
  };
}

let mockSb: ReturnType<typeof createMockSupabaseClient>;

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSb),
}));

// ─── Import the worker functions (main() won't auto-run) ───
import {
  checkStaleness,
  checkUrlHealth,
  checkDataQuality,
  logVerificationRun,
  main,
  KNOWN_REGISTRIES,
} from '../workers/verify.js';
import type { SupabaseClient } from '@supabase/supabase-js';

// ─── Helpers ───────────────────────────────────────────────

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

function scrapeRun(registryId: string, daysOld: number, status = 'success') {
  return {
    registry_id: registryId,
    status,
    entities_found: 100,
    created_at: daysAgo(daysOld),
  };
}

function entityRow(parserId: string, url: string) {
  return {
    parser_id: parserId,
    source_url: url,
    name: `Entity from ${parserId}`,
    license_number: 'LIC-001',
    country_code: 'US',
  };
}

// ─── Setup / Teardown ──────────────────────────────────────

const originalArgv = process.argv;
const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
  tableResults = new Map();
  mockSb = createMockSupabaseClient();
});

afterEach(() => {
  process.argv = originalArgv;
  globalThis.fetch = originalFetch;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_KEY;
});

// ═════════════════════════════════════════════════════════════
// CHECK 1: STALENESS
// ═════════════════════════════════════════════════════════════

describe('Check: Staleness', () => {
  it('should PASS when all registries scraped within 7 days', async () => {
    const runs = KNOWN_REGISTRIES.map((id) => scrapeRun(id, 2));
    tableResults.set('scrape_runs', [{ data: runs, error: null }]);

    const result = await checkStaleness(mockSb as unknown as SupabaseClient);

    expect(result.check).toBe('staleness');
    expect(result.status).toBe('pass');
    expect(result.details.staleRegistries).toEqual([]);
    expect(result.details.neverRun).toEqual([]);
  });

  it('should WARN when some registries never ran (but none stale)', async () => {
    const runs = KNOWN_REGISTRIES.slice(0, 6).map((id) => scrapeRun(id, 1));
    tableResults.set('scrape_runs', [{ data: runs, error: null }]);

    const result = await checkStaleness(mockSb as unknown as SupabaseClient);

    expect(result.status).toBe('warn');
    expect((result.details.neverRun as string[]).length).toBe(6);
    expect((result.details.staleRegistries as string[]).length).toBe(0);
  });

  it('should FAIL when some registries are stale (>7 days)', async () => {
    const runs = [
      scrapeRun('za-fsca', 1),
      scrapeRun('jp-fsa', 10), // stale
      scrapeRun('fr-amf', 15), // stale
      ...KNOWN_REGISTRIES.slice(3).map((id) => scrapeRun(id, 2)),
    ];
    tableResults.set('scrape_runs', [{ data: runs, error: null }]);

    const result = await checkStaleness(mockSb as unknown as SupabaseClient);

    expect(result.status).toBe('fail');
    expect(result.details.staleRegistries).toContain('jp-fsa');
    expect(result.details.staleRegistries).toContain('fr-amf');
  });

  it('should FAIL when scrape_runs query returns a DB error', async () => {
    tableResults.set('scrape_runs', [{
      data: null,
      error: { message: 'relation "scrape_runs" does not exist' },
    }]);

    const result = await checkStaleness(mockSb as unknown as SupabaseClient);

    expect(result.status).toBe('fail');
    expect(result.message).toContain('DB error');
  });

  it('should skip error-status runs when finding latest per registry', async () => {
    const runs = [
      scrapeRun('za-fsca', 1, 'error'), // error only
      ...KNOWN_REGISTRIES.slice(1).map((id) => scrapeRun(id, 2)),
    ];
    tableResults.set('scrape_runs', [{ data: runs, error: null }]);

    const result = await checkStaleness(mockSb as unknown as SupabaseClient);

    // za-fsca only has error run → neverRun. staleRegistries is empty → warn
    expect(result.status).toBe('warn');
    expect(result.details.neverRun).toContain('za-fsca');
  });

  it('should WARN with empty scrape_runs (all neverRun)', async () => {
    tableResults.set('scrape_runs', [{ data: [], error: null }]);

    const result = await checkStaleness(mockSb as unknown as SupabaseClient);

    expect(result.status).toBe('warn');
    expect((result.details.neverRun as string[]).length).toBe(KNOWN_REGISTRIES.length);
  });

  it('should handle null data from scrape_runs gracefully', async () => {
    tableResults.set('scrape_runs', [{ data: null, error: null }]);

    const result = await checkStaleness(mockSb as unknown as SupabaseClient);

    expect(result.status).toBe('warn');
  });
});

// ═════════════════════════════════════════════════════════════
// CHECK 2: URL HEALTH
// ═════════════════════════════════════════════════════════════

describe('Check: URL Health', () => {
  it('should PASS when all sampled URLs are reachable (200)', async () => {
    const entities = [
      entityRow('za-fsca', 'https://example.com/page1'),
      entityRow('jp-fsa', 'https://example.com/page2'),
    ];
    tableResults.set('entities', [{ data: entities, error: null }]);

    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });

    const result = await checkUrlHealth(mockSb as unknown as SupabaseClient);

    expect(result.check).toBe('url-health');
    expect(result.status).toBe('pass');
    expect(result.details.checked).toBe(2);
  });

  it('should treat 403 and 405 as acceptable (not unreachable)', async () => {
    const entities = [entityRow('za-fsca', 'https://example.com/blocked')];
    tableResults.set('entities', [{ data: entities, error: null }]);

    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 });

    const result = await checkUrlHealth(mockSb as unknown as SupabaseClient);

    expect(result.status).toBe('pass');
    expect((result.details.unreachable as unknown[]).length).toBe(0);
  });

  it('should WARN when 1-2 URLs are unreachable', async () => {
    const entities = [
      entityRow('za-fsca', 'https://example.com/ok'),
      entityRow('jp-fsa', 'https://example.com/dead1'),
      entityRow('fr-amf', 'https://example.com/dead2'),
    ];
    tableResults.set('entities', [{ data: entities, error: null }]);

    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve({ ok: true, status: 200 });
      return Promise.resolve({ ok: false, status: 500 });
    });

    const result = await checkUrlHealth(mockSb as unknown as SupabaseClient);

    expect(result.status).toBe('warn');
    expect((result.details.unreachable as unknown[]).length).toBe(2);
  });

  it('should FAIL when >2 URLs are unreachable', async () => {
    const entities = [
      entityRow('za-fsca', 'https://example.com/dead1'),
      entityRow('jp-fsa', 'https://example.com/dead2'),
      entityRow('fr-amf', 'https://example.com/dead3'),
    ];
    tableResults.set('entities', [{ data: entities, error: null }]);

    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });

    const result = await checkUrlHealth(mockSb as unknown as SupabaseClient);

    expect(result.status).toBe('fail');
    expect((result.details.unreachable as unknown[]).length).toBe(3);
  });

  it('should count network errors as unreachable', async () => {
    const entities = [
      entityRow('za-fsca', 'https://timeout.example.com'),
      entityRow('jp-fsa', 'https://dns-fail.example.com'),
      entityRow('fr-amf', 'https://reset.example.com'),
    ];
    tableResults.set('entities', [{ data: entities, error: null }]);

    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await checkUrlHealth(mockSb as unknown as SupabaseClient);

    expect(result.status).toBe('fail');
  });

  it('should FAIL when entities query returns a DB error', async () => {
    tableResults.set('entities', [{
      data: null,
      error: { message: 'permission denied' },
    }]);

    const result = await checkUrlHealth(mockSb as unknown as SupabaseClient);

    expect(result.status).toBe('fail');
    expect(result.message).toContain('DB error');
  });

  it('should PASS with zero entities (nothing to check)', async () => {
    tableResults.set('entities', [{ data: [], error: null }]);

    globalThis.fetch = vi.fn();

    const result = await checkUrlHealth(mockSb as unknown as SupabaseClient);

    expect(result.status).toBe('pass');
    expect(result.details.checked).toBe(0);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('should de-duplicate URLs across entities', async () => {
    const entities = [
      entityRow('za-fsca', 'https://example.com/same'),
      entityRow('za-fsca', 'https://example.com/same'),
      entityRow('za-fsca', 'https://example.com/same'),
    ];
    tableResults.set('entities', [{ data: entities, error: null }]);

    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });

    const result = await checkUrlHealth(mockSb as unknown as SupabaseClient);

    expect(result.details.checked).toBe(1);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});

// ═════════════════════════════════════════════════════════════
// CHECK 3: DATA QUALITY
// ═════════════════════════════════════════════════════════════

describe('Check: Data Quality', () => {
  it('should PASS when no quality issues are found', async () => {
    // entities queried 3 times: missing names, missing licenses, parser_id list
    // scrape_runs queried 1 time: recent errors
    tableResults.set('entities', [
      { data: null, error: null, count: 0 },  // missing names
      { data: null, error: null, count: 0 },  // missing licenses
      { data: [{ parser_id: 'za-fsca' }, { parser_id: 'za-fsca' }], error: null }, // counts
    ]);
    tableResults.set('scrape_runs', [{ data: [], error: null }]);

    const result = await checkDataQuality(mockSb as unknown as SupabaseClient);

    expect(result.check).toBe('data-quality');
    expect(result.status).toBe('pass');
    expect((result.details.issues as string[]).length).toBe(0);
  });

  it('should WARN when 1-2 quality issues are found', async () => {
    tableResults.set('entities', [
      { data: null, error: null, count: 5 },   // 5 missing names → issue
      { data: null, error: null, count: 0 },   // no missing licenses
      { data: [{ parser_id: 'za-fsca' }], error: null },
    ]);
    tableResults.set('scrape_runs', [{ data: [], error: null }]);

    const result = await checkDataQuality(mockSb as unknown as SupabaseClient);

    expect(result.status).toBe('warn');
    expect((result.details.issues as string[]).length).toBeGreaterThanOrEqual(1);
    expect((result.details.issues as string[]).length).toBeLessThanOrEqual(2);
  });

  it('should FAIL when >2 quality issues are found', async () => {
    tableResults.set('entities', [
      { data: null, error: null, count: 10 },  // missing names
      { data: null, error: null, count: 8 },   // missing licenses
      { data: [{ parser_id: 'za-fsca' }], error: null },
    ]);
    tableResults.set('scrape_runs', [{
      data: [
        { registry_id: 'za-fsca', error_message: 'timeout', created_at: daysAgo(1) },
      ],
      error: null,
    }]);

    const result = await checkDataQuality(mockSb as unknown as SupabaseClient);

    expect(result.status).toBe('fail');
    expect((result.details.issues as string[]).length).toBeGreaterThan(2);
  });

  it('should report DB errors as issues without crashing', async () => {
    tableResults.set('entities', [
      { data: null, error: { message: 'connection refused' }, count: null },
      { data: null, error: { message: 'connection refused' }, count: null },
      { data: null, error: { message: 'connection refused' } },
    ]);
    tableResults.set('scrape_runs', [
      { data: null, error: { message: 'connection refused' } },
    ]);

    const result = await checkDataQuality(mockSb as unknown as SupabaseClient);

    expect(result.status).toBe('fail');
    const issues = result.details.issues as string[];
    expect(issues.some((i) => i.includes('DB error'))).toBe(true);
  });

  it('should detect recent scrape errors from last 3 days', async () => {
    tableResults.set('entities', [
      { data: null, error: null, count: 0 },
      { data: null, error: null, count: 0 },
      { data: [{ parser_id: 'za-fsca' }], error: null },
    ]);
    tableResults.set('scrape_runs', [{
      data: [
        { registry_id: 'gb-fca', error_message: 'HTTP 503', created_at: daysAgo(1) },
      ],
      error: null,
    }]);

    const result = await checkDataQuality(mockSb as unknown as SupabaseClient);

    const issues = result.details.issues as string[];
    expect(issues.some((i) => i.includes('scrape errors'))).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════
// LOG VERIFICATION RUN
// ═════════════════════════════════════════════════════════════

describe('logVerificationRun', () => {
  it('should insert into verification_runs table', async () => {
    tableResults.set('verification_runs', [{ data: null, error: null }]);

    const report = {
      timestamp: new Date().toISOString(),
      overall: 'pass' as const,
      checks: [{ check: 'staleness', status: 'pass' as const, message: 'OK', details: {} }],
      staleRegistries: [],
      unreachableCount: 0,
      qualityIssues: 0,
    };

    await logVerificationRun(mockSb as unknown as SupabaseClient, report, 'full');

    expect(mockSb.from).toHaveBeenCalledWith('verification_runs');
  });
});

// ═════════════════════════════════════════════════════════════
// MAIN RUNNER
// ═════════════════════════════════════════════════════════════

describe('Main runner', () => {
  const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
    // Don't actually exit
  }) as never);

  afterEach(() => {
    mockExit.mockClear();
  });

  it('should run all checks in full mode', async () => {
    process.argv = ['node', 'verify.ts'];

    const runs = KNOWN_REGISTRIES.map((id) => scrapeRun(id, 2));
    tableResults.set('scrape_runs', [
      { data: runs, error: null }, // staleness
      { data: [], error: null },   // data-quality recent errors
    ]);
    tableResults.set('entities', [
      { data: [], error: null },           // url-health entities
      { data: null, error: null, count: 0 }, // data-quality missing names
      { data: null, error: null, count: 0 }, // data-quality missing licenses
      { data: [], error: null },              // data-quality parser counts
    ]);
    tableResults.set('verification_runs', [{ data: null, error: null }]);

    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });

    await main();

    expect(mockExit).not.toHaveBeenCalled();
    expect(mockSendTelegramAlert).not.toHaveBeenCalled();
  });

  it('should run only staleness check when --check staleness', async () => {
    process.argv = ['node', 'verify.ts', '--check', 'staleness'];

    const runs = KNOWN_REGISTRIES.map((id) => scrapeRun(id, 2));
    tableResults.set('scrape_runs', [{ data: runs, error: null }]);
    tableResults.set('verification_runs', [{ data: null, error: null }]);

    await main();

    expect(mockExit).not.toHaveBeenCalled();
  });

  it('should exit(1) when any check fails', async () => {
    process.argv = ['node', 'verify.ts', '--check', 'staleness'];

    tableResults.set('scrape_runs', [{
      data: null,
      error: { message: 'DB down' },
    }]);
    tableResults.set('verification_runs', [{ data: null, error: null }]);

    await main();

    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should send Telegram alert on failure', async () => {
    process.argv = ['node', 'verify.ts', '--check', 'staleness'];

    tableResults.set('scrape_runs', [{
      data: null,
      error: { message: 'connection timeout' },
    }]);
    tableResults.set('verification_runs', [{ data: null, error: null }]);

    await main();

    expect(mockSendTelegramAlert).toHaveBeenCalledWith(
      'verify',
      expect.stringContaining('staleness'),
      true,
    );
  });

  it('should NOT exit(1) on warn', async () => {
    process.argv = ['node', 'verify.ts', '--check', 'staleness'];

    // Only 6 registries have runs → 6 neverRun → warn (not fail)
    const runs = KNOWN_REGISTRIES.slice(0, 6).map((id) => scrapeRun(id, 1));
    tableResults.set('scrape_runs', [{ data: runs, error: null }]);
    tableResults.set('verification_runs', [{ data: null, error: null }]);

    await main();

    expect(mockExit).not.toHaveBeenCalled();
    expect(mockSendTelegramAlert).not.toHaveBeenCalled();
  });
});
