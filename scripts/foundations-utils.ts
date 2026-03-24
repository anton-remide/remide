import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { FoundationRegistry } from '../src/design-system/foundations';
import { generateFoundationCss, validateFoundationRegistry } from '../src/design-system/foundations';

export interface FoundationArtifactsOptions {
  cwd?: string;
}

export function getFoundationPaths(options: FoundationArtifactsOptions = {}) {
  const cwd = options.cwd ?? process.cwd();

  return {
    registryPath: resolve(cwd, 'public/design-system/foundation.registry.json'),
    tokensPath: resolve(cwd, 'src/styles/tokens.css'),
  };
}

export function readFoundationRegistry(options: FoundationArtifactsOptions = {}) {
  const { registryPath } = getFoundationPaths(options);
  const raw = readFileSync(registryPath, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  const issues = validateFoundationRegistry(parsed);

  if (issues.length > 0) {
    const summary = issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n');
    throw new Error(`Invalid foundation registry:\n${summary}`);
  }

  return parsed as FoundationRegistry;
}

export function writeFoundationRegistry(registry: FoundationRegistry, options: FoundationArtifactsOptions = {}) {
  const { registryPath } = getFoundationPaths(options);
  const issues = validateFoundationRegistry(registry);

  if (issues.length > 0) {
    const summary = issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n');
    throw new Error(`Invalid foundation registry:\n${summary}`);
  }

  mkdirSync(dirname(registryPath), { recursive: true });
  writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
}

export function writeFoundationTokensCss(registry: FoundationRegistry, options: FoundationArtifactsOptions = {}) {
  const { tokensPath } = getFoundationPaths(options);
  mkdirSync(dirname(tokensPath), { recursive: true });
  writeFileSync(tokensPath, generateFoundationCss(registry), 'utf8');
}

export function syncFoundationArtifacts(options: FoundationArtifactsOptions = {}) {
  const registry = readFoundationRegistry(options);
  writeFoundationTokensCss(registry, options);
  return registry;
}

export function saveFoundationArtifacts(registry: FoundationRegistry, options: FoundationArtifactsOptions = {}) {
  const nextRegistry: FoundationRegistry = {
    ...registry,
    meta: {
      ...registry.meta,
      updatedAt: new Date().toISOString(),
    },
  };

  writeFoundationRegistry(nextRegistry, options);
  writeFoundationTokensCss(nextRegistry, options);
  return nextRegistry;
}
