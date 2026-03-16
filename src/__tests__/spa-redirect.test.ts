/**
 * SPA redirect guard — prevents the ~and~ infinite loop bug.
 *
 * GitHub Pages serves 404.html for unknown paths. That file encodes
 * the path into a query string and redirects to index.html, which
 * decodes it via history.replaceState. If `pathSegmentsToKeep` in
 * 404.html doesn't match the Vite `base` config, the redirect lands
 * on a path that ALSO 404s → infinite loop that appends ~and~ forever.
 *
 * These tests read the actual source files and validate consistency.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '../..');
const read = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf-8');

const html404 = read('public/404.html');
const indexHtml = read('index.html');
const viteConfig = read('vite.config.ts');

// ── Extract values from source files ──────────────────────────────

function getPathSegmentsToKeep(): number {
  const m = html404.match(/pathSegmentsToKeep\s*=\s*(\d+)/);
  if (!m) throw new Error('Could not find pathSegmentsToKeep in 404.html');
  return Number(m[1]);
}

function getViteBase(): string {
  const m = viteConfig.match(/base:\s*['"]([^'"]+)['"]/);
  if (!m) throw new Error('Could not find base in vite.config.ts');
  return m[1];
}

function hasDecodeScript(): boolean {
  return indexHtml.includes("l.search[1] === '/'") && indexHtml.includes('~and~');
}

// ── Simulate the 404.html redirect logic ──────────────────────────

function simulate404Redirect(
  pathname: string,
  search: string,
  hash: string,
  segmentsToKeep: number,
): string {
  const parts = pathname.split('/');
  const base = parts.slice(0, 1 + segmentsToKeep).join('/');
  const rest = pathname
    .slice(1)
    .split('/')
    .slice(segmentsToKeep)
    .join('/')
    .replace(/&/g, '~and~');
  const searchPart = search
    ? '&' + search.slice(1).replace(/&/g, '~and~')
    : '';
  return base + '/?/' + rest + searchPart + hash;
}

// ── Simulate the index.html decode logic ──────────────────────────

function simulateIndexDecode(pathname: string, search: string, hash: string): string | null {
  if (search.length < 2 || search[1] !== '/') return null;
  const decoded = search
    .slice(1)
    .split('&')
    .map((s) => s.replace(/~and~/g, '&'))
    .join('?');
  return pathname.slice(0, -1) + decoded + hash;
}

// ── Tests ─────────────────────────────────────────────────────────

describe('SPA redirect integrity', () => {
  const segments = getPathSegmentsToKeep();
  const base = getViteBase();

  it('pathSegmentsToKeep matches Vite base config', () => {
    const expectedSegments = base === '/' ? 0 : base.replace(/^\/|\/$/g, '').split('/').length;
    expect(segments).toBe(expectedSegments);
  });

  it('index.html contains the decode script', () => {
    expect(hasDecodeScript()).toBe(true);
  });

  it('404.html contains pathSegmentsToKeep', () => {
    expect(html404).toContain('pathSegmentsToKeep');
  });

  describe('round-trip: encode → decode preserves the original URL', () => {
    const cases = [
      { path: '/ui', search: '', hash: '' },
      { path: '/ui', search: '', hash: '#colors' },
      { path: '/jurisdictions', search: '', hash: '' },
      { path: '/jurisdictions/CH', search: '', hash: '' },
      { path: '/entities', search: '?tab=stablecoins', hash: '' },
      { path: '/entities', search: '?tab=stablecoins&q=circle', hash: '' },
      { path: '/entities/123', search: '', hash: '#overview' },
      { path: '/ui', search: '?debug=true', hash: '#badges' },
      { path: '/pricing', search: '?success=true', hash: '' },
    ];

    for (const { path, search, hash } of cases) {
      const label = path + search + hash;
      it(`${label}`, () => {
        const redirectUrl = simulate404Redirect(path, search, hash, segments);
        const url = new URL(redirectUrl, 'https://tracker.remide.xyz');
        const restored = simulateIndexDecode(url.pathname, url.search, url.hash);
        expect(restored).toBe(path + search + hash);
      });
    }
  });

  describe('no infinite redirect loop', () => {
    const paths = ['/ui', '/jurisdictions/CH', '/entities', '/entities?tab=stablecoins'];

    for (const input of paths) {
      it(`${input} converges in 1 redirect`, () => {
        const url = new URL(input, 'https://tracker.remide.xyz');
        const redirected = simulate404Redirect(url.pathname, url.search, url.hash, segments);
        const redirectUrl = new URL(redirected, 'https://tracker.remime.xyz');

        // After the redirect, the path must resolve to root (/) or the
        // base path where index.html actually lives. If it doesn't,
        // GitHub Pages will serve 404.html again → loop.
        const basePath = base === '/' ? '/' : base;
        expect(redirectUrl.pathname).toBe(basePath);
      });
    }
  });

  it('redirect target always lands on a path where index.html exists (root)', () => {
    const redirected = simulate404Redirect('/any/deep/path', '?foo=bar&baz=1', '#sec', segments);
    const url = new URL(redirected, 'https://tracker.remide.xyz');
    const basePath = base === '/' ? '/' : base;
    expect(url.pathname).toBe(basePath);
  });

  it('decode script does not corrupt URLs with special characters', () => {
    const tricky = simulate404Redirect('/entities', '?q=foo&bar=a&b&c=d', '', segments);
    const url = new URL(tricky, 'https://tracker.remide.xyz');
    const restored = simulateIndexDecode(url.pathname, url.search, url.hash);
    expect(restored).toBe('/entities?q=foo&bar=a&b&c=d');
  });

  it('regression: ~and~ loop — redirect always lands on root, never re-triggers 404', () => {
    // The original bug: pathSegmentsToKeep=1 made 404.html redirect
    // /ui → /ui/?/  — but /ui/ has no index.html → 404 again → loop.
    // With the fix (segments=0), the redirect goes to /?/ui (root),
    // which always has index.html → no second 404.
    const testPaths = ['/ui', '/jurisdictions/CH', '/entities', '/some/deep/path/here'];
    const basePath = base === '/' ? '/' : base;

    for (const p of testPaths) {
      const redirected = simulate404Redirect(p, '', '', segments);
      const url = new URL(redirected, 'https://tracker.remide.xyz');

      // The redirect path MUST be root — anything else means GitHub Pages
      // will serve 404.html again and start the ~and~ loop.
      expect(url.pathname, `${p} should redirect to root, got ${url.pathname}`).toBe(basePath);

      // Decode restores the original path
      const restored = simulateIndexDecode(url.pathname, url.search, url.hash);
      expect(restored).toBe(p);
    }
  });

  it('regression: pathSegmentsToKeep=1 WOULD cause a loop (proves the guard works)', () => {
    // Simulate the old broken config to prove our test catches it
    const brokenSegments = 1;
    const redirected = simulate404Redirect('/ui', '', '', brokenSegments);
    const url = new URL(redirected, 'https://tracker.remide.xyz');

    // With segments=1, redirect goes to /ui/?/ — NOT root — so 404.html
    // would be served again. This is the loop condition.
    expect(url.pathname).not.toBe('/');
    expect(url.pathname).toBe('/ui/');
  });
});
