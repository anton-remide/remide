import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { FoundationRegistry } from './foundations';
import {
  generateFoundationCss,
  getDirtyFoundationEntries,
  getFoundationFontStack,
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
    expect(css).toContain('[data-theme="institute"]');
    expect(css).toContain('[data-theme="main-site"]');
    expect(css).not.toContain('[data-theme="beige"]');
    expect(css).not.toContain('[data-theme="main"]');
    expect(css).not.toContain('[data-theme="darkgray"]');
    expect(css).not.toContain('[data-theme="nearblack"]');
    expect(css).toContain('--rule-heading-1-font:');
  });

  it('builds imports and font-face blocks from the shared font library', () => {
    const registry = loadRegistry() as FoundationRegistry;
    const editorialFont = {
      id: 'editorial-new',
      label: 'Editorial New',
      family: 'Editorial New',
      category: 'serif' as const,
      source: 'local' as const,
      faces: [
        {
          fileUrl: '/fonts/uploaded/editorial-new.woff2',
          format: 'woff2',
          style: 'normal',
          weight: '400',
        },
      ],
    };
    const nextRegistry: FoundationRegistry = {
      ...registry,
      fontLibrary: [...(registry.fontLibrary ?? []), editorialFont],
    };
    const headingToken = nextRegistry.collections
      .find((collection) => collection.id === 'fonts')
      ?.tokens.find((token) => token.id === 'font-heading');

    if (!headingToken) {
      throw new Error('font-heading token not found');
    }

    headingToken.values.base = getFoundationFontStack(editorialFont);

    const css = generateFoundationCss(nextRegistry);

    expect(css).toContain("@font-face {\n  font-family: 'Editorial New';");
    expect(css).toContain("src: url('/fonts/uploaded/editorial-new.woff2') format('woff2');");
    expect(css).toContain("--font-heading: 'Editorial New', serif;");
  });

  it('tracks dirty sections and items for unsaved edits', () => {
    const saved = loadRegistry() as FoundationRegistry;
    const draft = structuredClone(saved);
    const typographyRules = draft.rules.find((rule) => rule.id === 'typography-rules');

    draft.collections[0].tokens[0].label = 'Background Surface';

    if (!typographyRules) {
      throw new Error('typography-rules not found');
    }

    typographyRules.items[0].properties.size = '4rem';

    const dirtyEntries = getDirtyFoundationEntries(saved, draft);

    const savedTypographyRules = draft.rules.find((rule) => rule.id === 'typography-rules');

    if (!savedTypographyRules) {
      throw new Error('typography-rules not found after mutation');
    }

    expect(dirtyEntries.sectionIds).toEqual(expect.arrayContaining([
      draft.collections[0].id,
      savedTypographyRules.id,
    ]));
    expect(dirtyEntries.itemKeys).toEqual(expect.arrayContaining([
      getFoundationItemKey(draft.collections[0].id, draft.collections[0].tokens[0].id),
      getFoundationItemKey(savedTypographyRules.id, savedTypographyRules.items[0].id),
    ]));
  });
});
