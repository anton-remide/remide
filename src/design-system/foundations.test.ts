import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { FoundationRegistry } from './foundations';
import {
  generateFoundationCss,
  getDirtyFoundationEntries,
  getFoundationItemKey,
  validateFoundationRegistry,
} from './foundations';

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

  it('generates runtime CSS for themes and typography rules', () => {
    const registry = loadRegistry() as FoundationRegistry;
    const css = generateFoundationCss(registry);

    expect(css).toContain('--font-body:');
    expect(css).toContain('--color-bg: #F6F2EE;');
    expect(css).toContain('[data-theme="darkgray"]');
    expect(css).toContain('--rule-heading-1-font:');
  });

  it('tracks dirty sections and items for unsaved edits', () => {
    const saved = loadRegistry() as FoundationRegistry;
    const draft = structuredClone(saved);

    draft.collections[0].tokens[0].label = 'Background Surface';
    draft.rules[0].items[0].properties.size = '4rem';

    const dirtyEntries = getDirtyFoundationEntries(saved, draft);

    expect(dirtyEntries.sectionIds).toEqual(expect.arrayContaining([
      draft.collections[0].id,
      draft.rules[0].id,
    ]));
    expect(dirtyEntries.itemKeys).toEqual(expect.arrayContaining([
      getFoundationItemKey(draft.collections[0].id, draft.collections[0].tokens[0].id),
      getFoundationItemKey(draft.rules[0].id, draft.rules[0].items[0].id),
    ]));
  });
});
