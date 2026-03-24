export interface FoundationMeta {
  version: string;
  updatedAt: string;
  defaultTheme: string;
  defaultDensity: string;
  description: string;
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
  collections: FoundationTokenCollection[];
  rules: FoundationRuleCollection[];
}

export interface FoundationValidationIssue {
  path: string;
  message: string;
}

export type FoundationSection = FoundationTokenCollection | FoundationRuleCollection;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
    validateString(value.meta.defaultDensity, 'meta.defaultDensity', issues);
    validateString(value.meta.description, 'meta.description', issues);
  }

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
  const density = getTokenCollection(registry, 'density');
  const typographyRules = getRuleCollection(registry, 'typography-rules');

  const rootLines = [
    ...cssVarLines(fonts.tokens, 'base'),
    ...cssVarLines(colors.tokens, registry.meta.defaultTheme),
    ...cssVarLines(typographyScale.tokens, 'base'),
    ...cssVarLines(spacing.tokens, 'base'),
    ...cssVarLines(radii.tokens, 'base'),
    ...cssVarLines(shadows.tokens, registry.meta.defaultTheme),
    ...cssVarLines(density.tokens, registry.meta.defaultDensity),
    ...buildTypographyRuleLines(typographyRules),
  ];

  const themeBlocks = colors.modes
    .map((mode) => {
      const lines = [
        ...cssVarLines(colors.tokens, mode),
        ...cssVarLines(shadows.tokens, mode),
      ];
      return `[data-theme="${mode}"] {\n${lines.join('\n')}\n}`;
    })
    .join('\n\n');

  const densityBlocks = density.modes
    .filter((mode) => mode !== registry.meta.defaultDensity)
    .map((mode) => `[data-density="${mode}"] {\n${cssVarLines(density.tokens, mode).join('\n')}\n}`)
    .join('\n\n');

  return `@import url('https://fonts.googleapis.com/css2?family=Geist:wght@100..900&family=Geist+Mono:wght@100..900&display=swap');

@font-face {
  font-family: 'Satoshi Variable';
  src: url('/fonts/satoshi/Satoshi-Variable.woff2') format('woff2');
  font-style: normal;
  font-weight: 300 900;
  font-display: swap;
}

@font-face {
  font-family: 'Satoshi Variable';
  src: url('/fonts/satoshi/Satoshi-VariableItalic.woff2') format('woff2');
  font-style: italic;
  font-weight: 300 900;
  font-display: swap;
}

/* Generated from public/design-system/foundation.registry.json */
:root {
${rootLines.join('\n')}
}

${themeBlocks}

${densityBlocks}
`;
}
