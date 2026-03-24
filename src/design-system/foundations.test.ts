import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { FoundationRegistry } from './foundations';
import { generateFoundationCss, validateFoundationRegistry } from './foundations';

const REGISTRY_PATH = resolve(process.cwd(), 'public/design-system/foundation.registry.json');

function loadRegistry() {
  const raw = readFileSync(REGISTRY_PATH, 'utf8');
  return JSON.parse(raw) as unknown;
}

describe('foundation registry', () => {
  it('stays valid against the runtime schema', () => {
    const registry = loadRegistry();
    expect(validateFoundationRegistry(registry)).toEqual([]);
  });

  it('generates runtime CSS for themes, density, and typography rules', () => {
    const registry = loadRegistry() as FoundationRegistry;
    const css = generateFoundationCss(registry);

    expect(css).toContain('--font-body:');
    expect(css).toContain('--color-bg: #F6F2EE;');
    expect(css).toContain('[data-theme="darkgray"]');
    expect(css).toContain('[data-density="compact"]');
    expect(css).toContain('--rule-heading-1-font:');
  });
});
