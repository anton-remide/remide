export interface FoundationMeta {
  version: string;
  updatedAt: string;
  defaultTheme: string;
  description: string;
}

export type FoundationFontCategory = 'sans' | 'serif' | 'mono';
export type FoundationFontSource = 'google' | 'local';

export interface FoundationFontFace {
  fileUrl: string;
  format: string;
  style: string;
  weight: string;
}

export interface FoundationFontAsset {
  id: string;
  label: string;
  family: string;
  category: FoundationFontCategory;
  source: FoundationFontSource;
  importUrl?: string;
  faces?: FoundationFontFace[];
}

export interface FoundationGroup {
  id: string;
  label: string;
  description?: string;
}

export interface FoundationToken {
  id: string;
  name: string;
  label: string;
  group: string;
  description: string;
  usage?: string;
  preview?: 'color' | 'text' | 'shadow' | 'radius' | 'spacing' | 'font' | 'generic';
  editable?: boolean;
  values: Record<string, string>;
}

export interface FoundationTokenCollection {
  id: string;
  label: string;
  description?: string;
  kind: 'token';
  modes: string[];
  groups: FoundationGroup[];
  tokens: FoundationToken[];
}

export interface FoundationRuleItem {
  id: string;
  label: string;
  group: string;
  description: string;
  previewText?: string;
  properties: Record<string, string>;
}

export interface FoundationRuleCollection {
  id: string;
  label: string;
  description?: string;
  kind: 'rule';
  groups: FoundationGroup[];
  items: FoundationRuleItem[];
}

export interface FoundationRegistry {
  meta: FoundationMeta;
  fontLibrary?: FoundationFontAsset[];
  collections: FoundationTokenCollection[];
  rules: FoundationRuleCollection[];
}

export interface FoundationValidationIssue {
  path: string;
  message: string;
}

export interface DirtyFoundationEntries {
  sectionIds: string[];
  itemKeys: string[];
}

export type FoundationSection = FoundationTokenCollection | FoundationRuleCollection;

const FOUNDATION_FONT_FALLBACKS: Record<FoundationFontCategory, string> = {
  sans: 'sans-serif',
  serif: 'serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
};

export const DEFAULT_FOUNDATION_FONT_LIBRARY: FoundationFontAsset[] = [
  {
    id: 'geist',
    label: 'Geist',
    family: 'Geist',
    category: 'sans',
    source: 'google',
    importUrl: 'https://fonts.googleapis.com/css2?family=Geist:wght@100..900&family=Geist+Mono:wght@100..900&display=swap',
  },
  {
    id: 'geist-mono',
    label: 'Geist Mono',
    family: 'Geist Mono',
    category: 'mono',
    source: 'google',
    importUrl: 'https://fonts.googleapis.com/css2?family=Geist:wght@100..900&family=Geist+Mono:wght@100..900&display=swap',
  },
  {
    id: 'satoshi-variable',
    label: 'Satoshi Variable',
    family: 'Satoshi Variable',
    category: 'sans',
    source: 'local',
    faces: [
      {
        fileUrl: '/fonts/satoshi/Satoshi-Variable.woff2',
        format: 'woff2',
        style: 'normal',
        weight: '300 900',
      },
      {
        fileUrl: '/fonts/satoshi/Satoshi-VariableItalic.woff2',
        format: 'woff2',
        style: 'italic',
        weight: '300 900',
      },
    ],
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTokenCollectionSection(section: FoundationSection): section is FoundationTokenCollection {
  return section.kind === 'token';
}

function pushIssue(issues: FoundationValidationIssue[], path: string, message: string) {
  issues.push({ path, message });
}

function validateString(value: unknown, path: string, issues: FoundationValidationIssue[]) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    pushIssue(issues, path, 'Expected non-empty string');
  }
}

function validateStringMap(value: unknown, path: string, issues: FoundationValidationIssue[]) {
  if (!isRecord(value)) {
    pushIssue(issues, path, 'Expected object of string values');
    return;
  }

  for (const [key, entry] of Object.entries(value)) {
    validateString(entry, `${path}.${key}`, issues);
  }
}

function validateFontLibrary(value: unknown, path: string, issues: FoundationValidationIssue[]) {
  if (value === undefined) {
    return;
  }

  if (!Array.isArray(value)) {
    pushIssue(issues, path, 'Expected array');
    return;
  }

  value.forEach((entry, index) => {
    const entryPath = `${path}[${index}]`;

    if (!isRecord(entry)) {
      pushIssue(issues, entryPath, 'Expected object');
      return;
    }

    validateString(entry.id, `${entryPath}.id`, issues);
    validateString(entry.label, `${entryPath}.label`, issues);
    validateString(entry.family, `${entryPath}.family`, issues);
    validateString(entry.category, `${entryPath}.category`, issues);
    validateString(entry.source, `${entryPath}.source`, issues);

    if (entry.importUrl !== undefined) {
      validateString(entry.importUrl, `${entryPath}.importUrl`, issues);
    }

    if (entry.faces !== undefined) {
      if (!Array.isArray(entry.faces)) {
        pushIssue(issues, `${entryPath}.faces`, 'Expected array');
      } else {
        entry.faces.forEach((face, faceIndex) => {
          const facePath = `${entryPath}.faces[${faceIndex}]`;

          if (!isRecord(face)) {
            pushIssue(issues, facePath, 'Expected object');
            return;
          }

          validateString(face.fileUrl, `${facePath}.fileUrl`, issues);
          validateString(face.format, `${facePath}.format`, issues);
          validateString(face.style, `${facePath}.style`, issues);
          validateString(face.weight, `${facePath}.weight`, issues);
        });
      }
    }
  });
}

function quoteCssFontFamily(value: string) {
  const safe = value.replace(/'/g, "\\'");
  return `'${safe}'`;
}

function buildFontFaceBlocks(fontLibrary: FoundationFontAsset[]) {
  return fontLibrary.flatMap((font) => {
    if (!font.faces || font.faces.length === 0) {
      return [];
    }

    return font.faces.map((face) => `@font-face {
  font-family: ${quoteCssFontFamily(font.family)};
  src: url('${face.fileUrl}') format('${face.format}');
  font-style: ${face.style};
  font-weight: ${face.weight};
  font-display: swap;
}`);
  });
}

function buildGoogleFontImports(fontLibrary: FoundationFontAsset[]) {
  const seen = new Set<string>();
  const lines: string[] = [];

  for (const font of fontLibrary) {
    if (!font.importUrl || seen.has(font.importUrl)) {
      continue;
    }

    seen.add(font.importUrl);
    lines.push(`@import url('${font.importUrl}');`);
  }

  return lines;
}

export function getFoundationFontStack(font: Pick<FoundationFontAsset, 'family' | 'category'>) {
  return `${quoteCssFontFamily(font.family)}, ${FOUNDATION_FONT_FALLBACKS[font.category]}`;
}

export function getFoundationFontLibrary(registry: FoundationRegistry) {
  if (!registry.fontLibrary || registry.fontLibrary.length === 0) {
    return DEFAULT_FOUNDATION_FONT_LIBRARY;
  }

  return registry.fontLibrary;
}

export function validateFoundationRegistry(value: unknown): FoundationValidationIssue[] {
  const issues: FoundationValidationIssue[] = [];

  if (!isRecord(value)) {
    pushIssue(issues, 'registry', 'Expected object');
    return issues;
  }

  if (!isRecord(value.meta)) {
    pushIssue(issues, 'meta', 'Expected object');
  } else {
    validateString(value.meta.version, 'meta.version', issues);
    validateString(value.meta.updatedAt, 'meta.updatedAt', issues);
    validateString(value.meta.defaultTheme, 'meta.defaultTheme', issues);
    validateString(value.meta.description, 'meta.description', issues);
  }

  validateFontLibrary(value.fontLibrary, 'fontLibrary', issues);

  if (!Array.isArray(value.collections)) {
    pushIssue(issues, 'collections', 'Expected array');
  } else {
    value.collections.forEach((collection, index) => {
      const path = `collections[${index}]`;
      if (!isRecord(collection)) {
        pushIssue(issues, path, 'Expected object');
        return;
      }

      validateString(collection.id, `${path}.id`, issues);
      validateString(collection.label, `${path}.label`, issues);
      validateString(collection.kind, `${path}.kind`, issues);

      if (collection.kind !== 'token') {
        pushIssue(issues, `${path}.kind`, 'Expected "token"');
      }

      if (!Array.isArray(collection.modes) || collection.modes.length === 0) {
        pushIssue(issues, `${path}.modes`, 'Expected non-empty array');
      } else {
        collection.modes.forEach((mode, modeIndex) => validateString(mode, `${path}.modes[${modeIndex}]`, issues));
      }

      if (!Array.isArray(collection.groups)) {
        pushIssue(issues, `${path}.groups`, 'Expected array');
      }

      if (!Array.isArray(collection.tokens)) {
        pushIssue(issues, `${path}.tokens`, 'Expected array');
      } else {
        collection.tokens.forEach((token, tokenIndex) => {
          const tokenPath = `${path}.tokens[${tokenIndex}]`;
          if (!isRecord(token)) {
            pushIssue(issues, tokenPath, 'Expected object');
            return;
          }
          validateString(token.id, `${tokenPath}.id`, issues);
          validateString(token.name, `${tokenPath}.name`, issues);
          validateString(token.label, `${tokenPath}.label`, issues);
          validateString(token.group, `${tokenPath}.group`, issues);
          validateString(token.description, `${tokenPath}.description`, issues);
          validateStringMap(token.values, `${tokenPath}.values`, issues);

          if (Array.isArray(collection.modes) && isRecord(token.values)) {
            for (const mode of collection.modes) {
              if (!(mode in token.values)) {
                pushIssue(issues, `${tokenPath}.values.${mode}`, 'Missing mode value');
              }
            }
          }
        });
      }
    });
  }

  if (!Array.isArray(value.rules)) {
    pushIssue(issues, 'rules', 'Expected array');
  } else {
    value.rules.forEach((collection, index) => {
      const path = `rules[${index}]`;
      if (!isRecord(collection)) {
        pushIssue(issues, path, 'Expected object');
        return;
      }

      validateString(collection.id, `${path}.id`, issues);
      validateString(collection.label, `${path}.label`, issues);
      validateString(collection.kind, `${path}.kind`, issues);

      if (collection.kind !== 'rule') {
        pushIssue(issues, `${path}.kind`, 'Expected "rule"');
      }

      if (!Array.isArray(collection.groups)) {
        pushIssue(issues, `${path}.groups`, 'Expected array');
      }

      if (!Array.isArray(collection.items)) {
        pushIssue(issues, `${path}.items`, 'Expected array');
      } else {
        collection.items.forEach((item, itemIndex) => {
          const itemPath = `${path}.items[${itemIndex}]`;
          if (!isRecord(item)) {
            pushIssue(issues, itemPath, 'Expected object');
            return;
          }
          validateString(item.id, `${itemPath}.id`, issues);
          validateString(item.label, `${itemPath}.label`, issues);
          validateString(item.group, `${itemPath}.group`, issues);
          validateString(item.description, `${itemPath}.description`, issues);
          validateStringMap(item.properties, `${itemPath}.properties`, issues);
        });
      }
    });
  }

  return issues;
}

export function getFoundationSections(registry: FoundationRegistry): FoundationSection[] {
  return [...registry.collections, ...registry.rules];
}

export function getFoundationItemKey(sectionId: string, itemId: string) {
  return `${sectionId}::${itemId}`;
}

function getSectionItemMap(section: FoundationSection) {
  const entries = isTokenCollectionSection(section) ? section.tokens : section.items;
  return new Map(entries.map((entry) => [entry.id, JSON.stringify(entry)]));
}

export function getDirtyFoundationEntries(saved: FoundationRegistry, draft: FoundationRegistry): DirtyFoundationEntries {
  const savedSections = new Map(getFoundationSections(saved).map((section) => [section.id, section]));
  const draftSections = new Map(getFoundationSections(draft).map((section) => [section.id, section]));
  const sectionIds = new Set<string>();
  const itemKeys = new Set<string>();

  for (const sectionId of new Set([...savedSections.keys(), ...draftSections.keys()])) {
    const savedSection = savedSections.get(sectionId);
    const draftSection = draftSections.get(sectionId);

    if (!savedSection || !draftSection) {
      sectionIds.add(sectionId);
      const section = draftSection ?? savedSection;
      if (section) {
        const entries = isTokenCollectionSection(section) ? section.tokens : section.items;
        for (const entry of entries) {
          itemKeys.add(getFoundationItemKey(sectionId, entry.id));
        }
      }
      continue;
    }

    const savedItems = getSectionItemMap(savedSection);
    const draftItems = getSectionItemMap(draftSection);

    for (const itemId of new Set([...savedItems.keys(), ...draftItems.keys()])) {
      if (savedItems.get(itemId) !== draftItems.get(itemId)) {
        sectionIds.add(sectionId);
        itemKeys.add(getFoundationItemKey(sectionId, itemId));
      }
    }
  }

  return {
    sectionIds: [...sectionIds],
    itemKeys: [...itemKeys],
  };
}

export function getTokenCollection(registry: FoundationRegistry, id: string): FoundationTokenCollection {
  const collection = registry.collections.find((entry) => entry.id === id);
  if (!collection) {
    throw new Error(`Foundation token collection "${id}" not found`);
  }
  return collection;
}

export function getRuleCollection(registry: FoundationRegistry, id: string): FoundationRuleCollection {
  const collection = registry.rules.find((entry) => entry.id === id);
  if (!collection) {
    throw new Error(`Foundation rule collection "${id}" not found`);
  }
  return collection;
}

function cssVarLines(tokens: FoundationToken[], mode: string) {
  return tokens.map((token) => `  ${token.name}: ${token.values[mode]};`);
}

function ruleVarPrefix(id: string) {
  return `--rule-${id}`;
}

function buildTypographyRuleLines(collection: FoundationRuleCollection) {
  const lines: string[] = [];

  for (const item of collection.items) {
    const prefix = ruleVarPrefix(item.id);
    for (const [property, value] of Object.entries(item.properties)) {
      lines.push(`  ${prefix}-${property}: ${value};`);
    }
  }

  return lines;
}

export function generateFoundationCss(registry: FoundationRegistry) {
  const colors = getTokenCollection(registry, 'colors');
  const fonts = getTokenCollection(registry, 'fonts');
  const typographyScale = getTokenCollection(registry, 'typography-scale');
  const spacing = getTokenCollection(registry, 'spacing');
  const radii = getTokenCollection(registry, 'radii');
  const shadows = getTokenCollection(registry, 'shadows');
  const typographyRules = getRuleCollection(registry, 'typography-rules');
  const fontLibrary = getFoundationFontLibrary(registry);
  const googleImports = buildGoogleFontImports(fontLibrary);
  const fontFaceBlocks = buildFontFaceBlocks(fontLibrary);

  const rootLines = [
    ...cssVarLines(fonts.tokens, 'base'),
    ...cssVarLines(colors.tokens, registry.meta.defaultTheme),
    ...cssVarLines(typographyScale.tokens, 'base'),
    ...cssVarLines(spacing.tokens, 'base'),
    ...cssVarLines(radii.tokens, 'base'),
    ...cssVarLines(shadows.tokens, registry.meta.defaultTheme),
    ...buildTypographyRuleLines(typographyRules),
  ];

  const themeBlocks = colors.modes
    .filter((mode) => mode !== registry.meta.defaultTheme)
    .map((mode) => {
      const lines = [
        ...cssVarLines(colors.tokens, mode),
        ...cssVarLines(shadows.tokens, mode),
      ];
      return `[data-theme="${mode}"] {\n${lines.join('\n')}\n}`;
    })
    .join('\n\n');

  const fontPrelude = [...googleImports, ...fontFaceBlocks];
  const prelude = fontPrelude.length > 0 ? `${fontPrelude.join('\n\n')}\n\n` : '';

  return `${prelude}/* Generated from public/design-system/foundation.registry.json */
:root {
${rootLines.join('\n')}
}

${themeBlocks}
`;
}
