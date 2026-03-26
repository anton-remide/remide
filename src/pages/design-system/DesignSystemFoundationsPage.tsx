import { useEffect, useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import Heading from '../../components/ui/Heading';
import Text from '../../components/ui/Text';
import { useTheme, type Theme } from '../../context/ThemeProvider';
import type {
  FoundationFontAsset,
  FoundationFontCategory,
  FoundationRegistry,
  FoundationRuleItem,
  FoundationSection,
  FoundationToken,
  FoundationTokenCollection,
} from '../../design-system/foundations';
import {
  generateFoundationCss,
  getDirtyFoundationEntries,
  getFoundationFontLibrary,
  getFoundationFontStack,
  getFoundationItemKey,
  getFoundationSections,
} from '../../design-system/foundations';

const FOUNDATION_ENDPOINT = '/__internal/foundations';
const FOUNDATION_FONT_UPLOAD_ENDPOINT = '/__internal/foundations/fonts';
const FOUNDATION_PUBLIC_URL = `${import.meta.env.BASE_URL}design-system/foundation.registry.json`;
const FOUNDATION_RUNTIME_STYLE_ID = 'st-foundations-runtime-style';
const COLOR_SECTION_ID = 'colors';
const ICONS_SECTION_ID = 'icons';
const FONTS_SECTION_ID = 'fonts';
const TYPOGRAPHY_RULES_SECTION_ID = 'typography-rules';
const TYPOGRAPHY_SCALE_SECTION_ID = 'typography-scale';
const CORE_LEDGER_SECTION_IDS = new Set([COLOR_SECTION_ID, 'spacing', 'radii', 'shadows']);
const TYPOGRAPHY_SECTION_IDS = new Set([FONTS_SECTION_ID, TYPOGRAPHY_SCALE_SECTION_ID, TYPOGRAPHY_RULES_SECTION_ID]);
const SECTION_NAV_ORDER = [
  'colors',
  ICONS_SECTION_ID,
  'spacing',
  'radii',
  'shadows',
  FONTS_SECTION_ID,
  TYPOGRAPHY_SCALE_SECTION_ID,
  TYPOGRAPHY_RULES_SECTION_ID,
];
const FONT_ROLE_ORDER = new Map([
  ['font-heading', 0],
  ['font-body', 1],
  ['font-mono', 2],
]);
type ColorsView = 'active' | 'basic';
type FontLibraryFeedbackTone = 'success' | 'error';
const FOUNDATION_THEME_ORDER: Theme[] = ['tracker', 'institute', 'main-site'];
const FOUNDATION_THEME_LABELS: Record<Theme, string> = {
  tracker: 'Tracker',
  institute: 'Institute',
  'main-site': 'Main site',
};
const FONT_SOURCE_ORDER = ['google', 'local'] as const;
const GOOGLE_FONT_HOST = 'fonts.googleapis.com';
const GOOGLE_FONT_SPECIMEN_HOST = 'fonts.google.com';
const BASIC_COLOR_STEPS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'] as const;
const BASIC_COLOR_PALETTES = [
  {
    id: 'malachite',
    label: 'Malachite',
    colors: {
      '50': { hex: '#F1FDF3', oklch: 'oklch(98.24% 0.0193 150.603)' },
      '100': { hex: '#DDFCE3', oklch: 'oklch(96.25% 0.0463 151.584)' },
      '200': { hex: '#BCF8C9', oklch: 'oklch(92.63% 0.0882 151.104)' },
      '300': { hex: '#84F29E', oklch: 'oklch(87.35% 0.1545 149.939)' },
      '400': { hex: '#3AE066', oklch: 'oklch(79.68% 0.2118 147.683)' },
      '500': { hex: '#08BA3D', oklch: 'oklch(68.7% 0.2085 145.955)' },
      '600': { hex: '#00A532', oklch: 'oklch(62.93% 0.1943 145.632)' },
      '700': { hex: '#0D812D', oklch: 'oklch(52.75% 0.1543 146.469)' },
      '800': { hex: '#15662A', oklch: 'oklch(44.85% 0.1195 147.541)' },
      '900': { hex: '#175427', oklch: 'oklch(39.42% 0.0956 148.643)' },
      '950': { hex: '#072E13', oklch: 'oklch(26.68% 0.0657 149.105)' },
    },
  },
  {
    id: 'havelockblue',
    label: 'Havelockblue',
    colors: {
      '50': { hex: '#F0F8FF', oklch: 'oklch(97.57% 0.0128 240.129)' },
      '100': { hex: '#DFF1FF', oklch: 'oklch(94.78% 0.027 242.068)' },
      '200': { hex: '#BAE4FF', oklch: 'oklch(89.76% 0.0577 236.358)' },
      '300': { hex: '#7BD1FF', oklch: 'oklch(82.29% 0.1059 233.495)' },
      '400': { hex: '#18B6FF', oklch: 'oklch(73.71% 0.1564 236.845)' },
      '500': { hex: '#00A6FD', oklch: 'oklch(69.7% 0.1692 243.198)' },
      '600': { hex: '#007EDA', oklch: 'oklch(58.56% 0.1671 250.304)' },
      '700': { hex: '#0065B4', oklch: 'oklch(50.22% 0.1474 251.335)' },
      '800': { hex: '#005593', oklch: 'oklch(44.23% 0.122 249.008)' },
      '900': { hex: '#054876', oklch: 'oklch(38.9% 0.0995 247.115)' },
      '950': { hex: '#092D4D', oklch: 'oklch(29.11% 0.0702 249.418)' },
    },
  },
  {
    id: 'blazeorange',
    label: 'Blazeorange',
    colors: {
      '50': { hex: '#FFF6EE', oklch: 'oklch(97.73% 0.014 60.728)' },
      '100': { hex: '#FFEAD8', oklch: 'oklch(94.82% 0.0334 62.265)' },
      '200': { hex: '#FFD2B1', oklch: 'oklch(89.48% 0.067 58.251)' },
      '300': { hex: '#FFB27C', oklch: 'oklch(82.47% 0.1142 55.255)' },
      '400': { hex: '#FF813B', oklch: 'oklch(73.57% 0.1737 46.685)' },
      '500': { hex: '#FF5F0F', oklch: 'oklch(68.75% 0.2086 40.593)' },
      '600': { hex: '#EF4200', oklch: 'oklch(62.99% 0.2165 35.852)' },
      '700': { hex: '#C53108', oklch: 'oklch(54.17% 0.1899 34.066)' },
      '800': { hex: '#9D2A14', oklch: 'oklch(46.39% 0.1541 33.081)' },
      '900': { hex: '#7D2917', oklch: 'oklch(40.52% 0.1213 33.469)' },
      '950': { hex: '#43120A', oklch: 'oklch(26.41% 0.0782 32.08)' },
    },
  },
  {
    id: 'mediumpurple',
    label: 'Mediumpurple',
    colors: {
      '50': { hex: '#F8F5FD', oklch: 'oklch(97.49% 0.0118 303.69)' },
      '100': { hex: '#F0E9FC', oklch: 'oklch(94.52% 0.0259 303.074)' },
      '200': { hex: '#E4D7FA', oklch: 'oklch(89.99% 0.0498 302.386)' },
      '300': { hex: '#D0B7F9', oklch: 'oklch(82.28% 0.0947 302.224)' },
      '400': { hex: '#AF82F5', oklch: 'oklch(69.82% 0.1675 300.165)' },
      '500': { hex: '#9D5EF0', oklch: 'oklch(62.15% 0.2114 300.165)' },
      '600': { hex: '#8940E3', oklch: 'oklch(55.36% 0.2317 299.073)' },
      '700': { hex: '#7632C8', oklch: 'oklch(49.47% 0.2156 298.668)' },
      '800': { hex: '#632CA3', oklch: 'oklch(43.64% 0.1795 300.046)' },
      '900': { hex: '#512782', oklch: 'oklch(38.07% 0.1453 301.237)' },
      '950': { hex: '#35155C', oklch: 'oklch(28.89% 0.119 298.866)' },
    },
  },
  {
    id: 'ironsidegray',
    label: 'Ironsidegray',
    colors: {
      '50': { hex: '#FAFAFA', oklch: 'oklch(98.49% 0.0007 145.775)' },
      '100': { hex: '#F4F5F4', oklch: 'oklch(96.97% 0.0012 145.803)' },
      '200': { hex: '#E6E6E4', oklch: 'oklch(92.42% 0.0026 98.679)' },
      '300': { hex: '#D4D4D1', oklch: 'oklch(86.96% 0.0042 104.674)' },
      '400': { hex: '#A2A29D', oklch: 'oklch(71.06% 0.0071 105.113)' },
      '500': { hex: '#74746E', oklch: 'oklch(55.71% 0.0083 106.679)' },
      '600': { hex: '#63635E', oklch: 'oklch(49.81% 0.0078 106.679)' },
      '700': { hex: '#41423E', oklch: 'oklch(37.66% 0.0068 114.407)' },
      '800': { hex: '#282724', oklch: 'oklch(27.3% 0.0055 86.957)' },
      '900': { hex: '#1A1A18', oklch: 'oklch(21.82% 0.0051 105.936)' },
      '950': { hex: '#0B0B09', oklch: 'oklch(14.67% 0.0042 100.072)' },
    },
  },
] as const;
const BASIC_BADGE_COLORS = [
  '#B4A534',
  '#F19F38',
  '#9B60F6',
  '#3B8299',
  '#EC443A',
  '#D243AD',
  '#91D243',
  '#2A64F6',
] as const;
const ICON_LIBRARY_URL = 'https://github.com/lucide-icons/lucide';

function getFoundationModeLabel(mode: string) {
  if (mode === 'base') {
    return 'Base';
  }

  return FOUNDATION_THEME_LABELS[mode as Theme] ?? mode;
}

function getSpacingPreviewWidth(value: string) {
  const parsed = Number.parseFloat(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return Math.max(3, Math.min(12, Math.round((parsed / 96) * 12)));
}
type DisplayFoundationItem =
  | { kind: 'token'; sectionId: string; item: FoundationToken; mode: string }
  | { kind: 'rule'; sectionId: string; item: FoundationRuleItem };

interface DisplayFoundationGroup {
  id: string;
  label: string;
  layout: 'token' | 'rule';
  items: DisplayFoundationItem[];
}

interface FontLibraryFeedback {
  tone: FontLibraryFeedbackTone;
  message: string;
}

interface ColorCellDraft {
  hex: string;
  opacity: string;
}

interface ParsedGoogleFontPayload {
  families: string[];
  importUrl: string;
}

function cloneRegistry(registry: FoundationRegistry) {
  return JSON.parse(JSON.stringify(registry)) as FoundationRegistry;
}

function slugifyValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildFontAssetId(fontFamily: string, existingIds: Set<string>) {
  const base = slugifyValue(fontFamily) || 'font';

  if (!existingIds.has(base)) {
    return base;
  }

  let suffix = 2;
  while (existingIds.has(`${base}-${suffix}`)) {
    suffix += 1;
  }

  return `${base}-${suffix}`;
}

function getFontCategoryLabel(category: FoundationFontCategory) {
  switch (category) {
    case 'serif':
      return 'Serif';
    case 'mono':
      return 'Mono';
    default:
      return 'Sans';
  }
}

function getFontOptionSourceLabel(source: FoundationFontAsset['source']) {
  switch (source) {
    case 'google':
      return 'Google';
    case 'local':
      return 'Local';
    default:
      return 'Bundled';
  }
}

function getFontRoleOptions(fontLibrary: FoundationFontAsset[], tokenId: string) {
  const preferredCategory = tokenId === 'font-mono' ? 'mono' : null;

  return [...fontLibrary].sort((left, right) => {
    if (preferredCategory) {
      const leftPreferred = left.category === preferredCategory ? 1 : 0;
      const rightPreferred = right.category === preferredCategory ? 1 : 0;

      if (leftPreferred !== rightPreferred) {
        return rightPreferred - leftPreferred;
      }
    }

    const leftSourceRank = FONT_SOURCE_ORDER.indexOf(left.source);
    const rightSourceRank = FONT_SOURCE_ORDER.indexOf(right.source);

    if (leftSourceRank !== rightSourceRank) {
      return leftSourceRank - rightSourceRank;
    }

    return left.label.localeCompare(right.label);
  });
}

function buildGoogleImportUrlFromFamily(family: string) {
  return `https://${GOOGLE_FONT_HOST}/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}&display=swap`;
}

function extractFamilyName(rawValue: string) {
  const value = rawValue.replace(/\+/g, ' ').trim();
  const separatorIndex = value.indexOf(':');
  return separatorIndex === -1 ? value : value.slice(0, separatorIndex).trim();
}

function parseGoogleFontPayload(input: string): ParsedGoogleFontPayload | null {
  const trimmed = input.trim();

  if (!trimmed) {
    return null;
  }

  let url: URL;

  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (url.hostname === GOOGLE_FONT_HOST) {
    const normalizedUrl = new URL(url.toString());

    if (!normalizedUrl.searchParams.get('display')) {
      normalizedUrl.searchParams.set('display', 'swap');
    }

    const families = normalizedUrl.searchParams
      .getAll('family')
      .map(extractFamilyName)
      .filter(Boolean);

    if (families.length === 0) {
      return null;
    }

    return {
      families: [...new Set(families)],
      importUrl: normalizedUrl.toString(),
    };
  }

  if (url.hostname === GOOGLE_FONT_SPECIMEN_HOST) {
    const specimenMatch = url.pathname.match(/\/specimen\/([^/]+)/);
    const family = specimenMatch ? extractFamilyName(decodeURIComponent(specimenMatch[1])) : '';

    if (!family) {
      return null;
    }

    return {
      families: [family],
      importUrl: buildGoogleImportUrlFromFamily(family),
    };
  }

  return null;
}

function inferFontCategory(family: string): FoundationFontCategory {
  const normalized = family.trim().toLowerCase();

  if (normalized.includes('mono')) {
    return 'mono';
  }

  if (normalized.includes('serif')) {
    return 'serif';
  }

  return 'sans';
}

function guessFontFormat(fileName: string) {
  const extension = fileName.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'woff2':
      return 'woff2';
    case 'woff':
      return 'woff';
    case 'ttf':
      return 'truetype';
    case 'otf':
      return 'opentype';
    default:
      return null;
  }
}

function deriveFontFamilyFromFileName(fileName: string) {
  const cleaned = fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b(woff2|woff|ttf|otf|regular|italic|oblique|variable|roman|book|medium|semibold|bold|light|thin|black|extrabold|ultrabold|\d{3})\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) {
    return 'Custom Font';
  }

  return cleaned
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const separatorIndex = result.indexOf(',');

      if (separatorIndex === -1) {
        reject(new Error('Failed to encode the selected font file.'));
        return;
      }

      resolve(result.slice(separatorIndex + 1));
    };

    reader.onerror = () => {
      reject(new Error('Failed to read the selected font file.'));
    };

    reader.readAsDataURL(file);
  });
}

async function uploadFoundationFontFile(file: File): Promise<{ publicUrl: string; format: string }> {
  if (!import.meta.env.DEV) {
    throw new Error('Local font upload is available only in the Vite dev server.');
  }

  const contentBase64 = await readFileAsBase64(file);
  const response = await fetch(FOUNDATION_FONT_UPLOAD_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      contentBase64,
    }),
  });

  const payload = await response.json() as { error?: string; publicUrl?: string; format?: string };

  if (!response.ok || !payload.publicUrl || !payload.format) {
    throw new Error(payload.error || 'Failed to upload the selected font file.');
  }

  return {
    publicUrl: payload.publicUrl,
    format: payload.format,
  };
}

function clampColorChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function toHexChannel(value: number) {
  return clampColorChannel(value).toString(16).padStart(2, '0').toUpperCase();
}

function normalizeHexColorValue(value: string) {
  const trimmed = value.trim();
  const shortHexMatch = trimmed.match(/^#([0-9a-f]{3}|[0-9a-f]{4})$/i);

  if (shortHexMatch) {
    const expanded = shortHexMatch[1]
      .split('')
      .map((char) => `${char}${char}`)
      .join('')
      .toUpperCase();

    return expanded.endsWith('FF') ? `#${expanded.slice(0, 6)}` : `#${expanded}`;
  }

  const longHexMatch = trimmed.match(/^#([0-9a-f]{6}|[0-9a-f]{8})$/i);

  if (!longHexMatch) {
    return null;
  }

  const normalized = longHexMatch[1].toUpperCase();
  return normalized.endsWith('FF') && normalized.length === 8 ? `#${normalized.slice(0, 6)}` : `#${normalized}`;
}

function parseRgbChannelValue(value: string) {
  const trimmed = value.trim();

  if (trimmed.endsWith('%')) {
    const percentage = Number.parseFloat(trimmed.slice(0, -1));
    if (!Number.isFinite(percentage)) {
      return null;
    }

    return clampColorChannel((percentage / 100) * 255);
  }

  const numeric = Number.parseFloat(trimmed);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return clampColorChannel(numeric);
}

function parseAlphaChannelValue(value: string) {
  const trimmed = value.trim();

  if (trimmed.endsWith('%')) {
    const percentage = Number.parseFloat(trimmed.slice(0, -1));
    if (!Number.isFinite(percentage)) {
      return null;
    }

    return clampColorChannel((percentage / 100) * 255);
  }

  const numeric = Number.parseFloat(trimmed);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return clampColorChannel(numeric <= 1 ? numeric * 255 : numeric);
}

function normalizeRgbColorValue(value: string) {
  const match = value.trim().match(/^rgba?\((.+)\)$/i);

  if (!match) {
    return null;
  }

  const parts = match[1].split(',').map((part) => part.trim()).filter(Boolean);

  if (parts.length !== 3 && parts.length !== 4) {
    return null;
  }

  const [red, green, blue, alpha] = parts;
  const channels = [red, green, blue].map(parseRgbChannelValue);

  if (channels.some((channel) => channel === null)) {
    return null;
  }

  const alphaChannel = alpha ? parseAlphaChannelValue(alpha) : 255;

  if (alphaChannel === null) {
    return null;
  }

  const [r, g, b] = channels as number[];
  const hex = `#${toHexChannel(r)}${toHexChannel(g)}${toHexChannel(b)}`;

  return alphaChannel === 255 ? hex : `${hex}${toHexChannel(alphaChannel)}`;
}

function normalizeAnyColorValue(value: string) {
  return normalizeHexColorValue(value) ?? normalizeRgbColorValue(value);
}

function normalizeBaseHexColorValue(value: string) {
  const trimmed = value.trim();
  const shortHexMatch = trimmed.match(/^#([0-9a-f]{3})$/i);

  if (shortHexMatch) {
    return `#${shortHexMatch[1]
      .split('')
      .map((char) => `${char}${char}`)
      .join('')
      .toUpperCase()}`;
  }

  const longHexMatch = trimmed.match(/^#([0-9a-f]{6})$/i);

  if (!longHexMatch) {
    return null;
  }

  return `#${longHexMatch[1].toUpperCase()}`;
}

function alphaChannelToOpacityPercentage(alphaChannel: number) {
  return Math.round((clampColorChannel(alphaChannel) / 255) * 100);
}

function parseOpacityPercentageValue(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (!/^\d{1,3}$/.test(trimmed)) {
    return null;
  }

  const numeric = Number.parseInt(trimmed, 10);

  if (numeric < 0 || numeric > 100) {
    return null;
  }

  return numeric;
}

function getColorCellDraft(value: string): ColorCellDraft {
  const normalized = normalizeAnyColorValue(value);

  if (!normalized) {
    return {
      hex: value.trim(),
      opacity: '100',
    };
  }

  if (normalized.length === 9) {
    const alphaChannel = Number.parseInt(normalized.slice(7, 9), 16);

    return {
      hex: normalized.slice(0, 7),
      opacity: String(alphaChannelToOpacityPercentage(alphaChannel)),
    };
  }

  return {
    hex: normalized,
    opacity: '100',
  };
}

function composeColorCellValue(draft: ColorCellDraft) {
  const normalizedHex = normalizeBaseHexColorValue(draft.hex);
  const opacity = parseOpacityPercentageValue(draft.opacity);

  if (!normalizedHex || opacity === null) {
    return null;
  }

  if (opacity === 100) {
    return normalizedHex;
  }

  return `${normalizedHex}${toHexChannel((opacity / 100) * 255)}`;
}

function getColorCellPreviewValue(draft: ColorCellDraft) {
  const composed = composeColorCellValue(draft);

  if (composed) {
    return composed;
  }

  return normalizeBaseHexColorValue(draft.hex) ?? draft.hex;
}

function normalizeColorRegistry(registry: FoundationRegistry) {
  const colorsCollection = registry.collections.find((entry) => entry.id === COLOR_SECTION_ID);

  if (!colorsCollection) {
    return registry;
  }

  let changed = false;
  const nextRegistry = cloneRegistry(registry);
  const nextColorsCollection = nextRegistry.collections.find((entry) => entry.id === COLOR_SECTION_ID);

  if (!nextColorsCollection) {
    return registry;
  }

  for (const token of nextColorsCollection.tokens) {
    for (const [mode, value] of Object.entries(token.values)) {
      const normalized = normalizeAnyColorValue(value);

      if (normalized && normalized !== value) {
        token.values[mode] = normalized;
        changed = true;
      }
    }
  }

  return changed ? nextRegistry : registry;
}

function getColorCellKey(sectionId: string, tokenId: string, mode: string) {
  return `${sectionId}::${tokenId}::${mode}`;
}

function isTokenSection(section: FoundationSection): section is FoundationTokenCollection {
  return section.kind === 'token';
}

function resolveTokenMode(section: FoundationTokenCollection, theme: Theme) {
  if (section.modes.includes(theme)) {
    return theme;
  }

  if (section.modes.includes('base')) {
    return 'base';
  }

  return section.modes[0];
}

function applyFoundationRegistry(registry: FoundationRegistry) {
  if (typeof document === 'undefined') {
    return;
  }

  let styleTag = document.getElementById(FOUNDATION_RUNTIME_STYLE_ID) as HTMLStyleElement | null;

  if (!styleTag) {
    styleTag = document.createElement('style');
    styleTag.id = FOUNDATION_RUNTIME_STYLE_ID;
    document.head.appendChild(styleTag);
  }

  styleTag.textContent = generateFoundationCss(registry);
}

async function fetchFoundationRegistry() {
  const url = import.meta.env.DEV ? FOUNDATION_ENDPOINT : FOUNDATION_PUBLIC_URL;
  const response = await fetch(url, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`Failed to load foundations (${response.status})`);
  }

  const registry = await response.json() as FoundationRegistry;
  return normalizeColorRegistry(registry);
}

async function saveFoundationRegistry(registry: FoundationRegistry) {
  if (!import.meta.env.DEV) {
    throw new Error('Local Save is available only in the Vite dev server.');
  }

  const normalizedRegistry = normalizeColorRegistry(registry);
  const response = await fetch(FOUNDATION_ENDPOINT, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ registry: normalizedRegistry }),
  });

  const payload = await response.json() as { error?: string } & FoundationRegistry;

  if (!response.ok) {
    throw new Error(payload.error || `Failed to save foundations (${response.status})`);
  }

  return normalizeColorRegistry(payload as FoundationRegistry);
}

function tokenPreviewStyle(token: FoundationToken, mode: string) {
  const value = token.values[mode] ?? '';

  switch (token.preview) {
    case 'color':
      return {
        background: value,
        border: token.name.includes('border') ? `1px solid ${value}` : '1px solid var(--color-border)',
        color: 'var(--color-text-main)',
      };
    case 'shadow':
      return {
        background: 'var(--color-surface)',
        boxShadow: value,
        border: '1px solid var(--color-border)',
      };
    case 'radius':
      return {
        background: 'var(--color-surface-raised)',
        border: '1px solid var(--color-border)',
        borderRadius: value,
      };
    case 'font':
      return {
        fontFamily: value,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
      };
    case 'text':
      return {
        fontSize: value,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
      };
    default:
      return {
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
      };
  }
}

function rulePreviewStyle(item: FoundationRuleItem) {
  return {
    fontFamily: item.properties.font,
    fontSize: item.properties.size,
    lineHeight: item.properties['line-height'],
    fontWeight: item.properties.weight,
    letterSpacing: item.properties['letter-spacing'],
    color: 'var(--color-text-main)',
  };
}

function cloneFoundationValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function getTokenValue(registry: FoundationRegistry, collectionId: string, tokenId: string, mode: string) {
  const collection = registry.collections.find((entry) => entry.id === collectionId);
  const token = collection?.tokens.find((entry) => entry.id === tokenId);

  return token?.values[mode] ?? '';
}

function colorSwatchStyle(value: string, isInvalid = false) {
  const normalized = normalizeAnyColorValue(value);

  if (isInvalid || !normalized) {
    return {
      background:
        'repeating-linear-gradient(135deg, color-mix(in srgb, var(--color-danger) 18%, transparent) 0 8px, transparent 8px 16px)',
      borderColor: 'color-mix(in srgb, var(--color-danger) 38%, var(--color-border-strong))',
    };
  }

  return {
    background: normalized,
    borderColor: 'var(--color-border-strong)',
  };
}

function copyFoundationItem(
  sourceRegistry: FoundationRegistry,
  targetRegistry: FoundationRegistry,
  sectionId: string,
  itemId: string,
) {
  const sourceTokenCollection = sourceRegistry.collections.find((entry) => entry.id === sectionId);
  if (sourceTokenCollection) {
    const sourceIndex = sourceTokenCollection.tokens.findIndex((entry) => entry.id === itemId);
    const targetCollection = targetRegistry.collections.find((entry) => entry.id === sectionId);
    const targetIndex = targetCollection?.tokens.findIndex((entry) => entry.id === itemId) ?? -1;

    if (!targetCollection || sourceIndex === -1 || targetIndex === -1) {
      return false;
    }

    targetCollection.tokens[targetIndex] = cloneFoundationValue(sourceTokenCollection.tokens[sourceIndex]);
    return true;
  }

  const sourceRuleCollection = sourceRegistry.rules.find((entry) => entry.id === sectionId);
  if (sourceRuleCollection) {
    const sourceIndex = sourceRuleCollection.items.findIndex((entry) => entry.id === itemId);
    const targetCollection = targetRegistry.rules.find((entry) => entry.id === sectionId);
    const targetIndex = targetCollection?.items.findIndex((entry) => entry.id === itemId) ?? -1;

    if (!targetCollection || sourceIndex === -1 || targetIndex === -1) {
      return false;
    }

    targetCollection.items[targetIndex] = cloneFoundationValue(sourceRuleCollection.items[sourceIndex]);
    return true;
  }

  return false;
}

function splitFoundationItemKey(itemKey: string) {
  const separatorIndex = itemKey.indexOf('::');
  if (separatorIndex === -1) {
    return null;
  }

  return {
    sectionId: itemKey.slice(0, separatorIndex),
    itemId: itemKey.slice(separatorIndex + 2),
  };
}

export default function DesignSystemFoundationsPage() {
  const { theme } = useTheme();
  const [savedRegistry, setSavedRegistry] = useState<FoundationRegistry | null>(null);
  const [draftRegistry, setDraftRegistry] = useState<FoundationRegistry | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingItemKey, setSavingItemKey] = useState<string | null>(null);
  const [itemErrorMessages, setItemErrorMessages] = useState<Record<string, string>>({});
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [editingColorCellKey, setEditingColorCellKey] = useState<string | null>(null);
  const [colorCellDrafts, setColorCellDrafts] = useState<Record<string, ColorCellDraft>>({});
  const [colorCellErrors, setColorCellErrors] = useState<Record<string, string>>({});
  const [activeColorsView, setActiveColorsView] = useState<ColorsView>('active');
  const [copiedBasicColorKey, setCopiedBasicColorKey] = useState<string | null>(null);
  const [fontLibraryFeedback, setFontLibraryFeedback] = useState<FontLibraryFeedback | null>(null);
  const [fontLibraryBusy, setFontLibraryBusy] = useState(false);
  const [googleFontUrlDraft, setGoogleFontUrlDraft] = useState('');
  const [localFontFile, setLocalFontFile] = useState<File | null>(null);
  const [localFontInputKey, setLocalFontInputKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);

      try {
        const registry = await fetchFoundationRegistry();
        if (cancelled) {
          return;
        }

        applyFoundationRegistry(registry);
        setSavedRegistry(registry);
        setDraftRegistry(cloneRegistry(registry));
        setEditingColorCellKey(null);
        setColorCellDrafts({});
        setColorCellErrors({});
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Failed to load foundations.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const activeRegistry = draftRegistry ?? savedRegistry;
  const activeFontLibrary = useMemo(
    () => (activeRegistry ? getFoundationFontLibrary(activeRegistry) : []),
    [activeRegistry],
  );
  const sections = useMemo(() => (activeRegistry ? getFoundationSections(activeRegistry) : []), [activeRegistry]);
  const visibleSections = useMemo(() => {
    const sectionOrder = new Map(SECTION_NAV_ORDER.map((sectionId, index) => [sectionId, index]));

    return [...sections].sort((left, right) => {
      const leftRank = sectionOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER;
      const rightRank = sectionOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER;

      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      return sections.indexOf(left) - sections.indexOf(right);
    });
  }, [sections]);
  const primaryNavSections = useMemo(
    () => visibleSections.filter((section) => !TYPOGRAPHY_SECTION_IDS.has(section.id)),
    [visibleSections],
  );
  const typographyNavSections = useMemo(
    () => visibleSections.filter((section) => TYPOGRAPHY_SECTION_IDS.has(section.id)),
    [visibleSections],
  );

  useEffect(() => {
    if (visibleSections.length === 0) {
      return;
    }

    if (!selectedSectionId || !visibleSections.some((section) => section.id === selectedSectionId)) {
      setSelectedSectionId(visibleSections[0].id);
    }
  }, [selectedSectionId, visibleSections]);

  useEffect(() => {
    if (!copiedBasicColorKey) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setCopiedBasicColorKey(null);
    }, 1800);

    return () => window.clearTimeout(timeoutId);
  }, [copiedBasicColorKey]);

  const activeSection = useMemo(
    () => visibleSections.find((section) => section.id === selectedSectionId) ?? visibleSections[0] ?? null,
    [selectedSectionId, visibleSections],
  );

  const activeMode = activeSection && isTokenSection(activeSection)
    ? resolveTokenMode(activeSection, theme)
    : undefined;
  const isColorsSectionActive = activeSection?.id === COLOR_SECTION_ID && isTokenSection(activeSection);
  const isIconsSectionActive = activeSection?.id === ICONS_SECTION_ID;

  const dirty = useMemo(() => {
    if (!savedRegistry || !draftRegistry) {
      return false;
    }

    return JSON.stringify(savedRegistry) !== JSON.stringify(draftRegistry);
  }, [draftRegistry, savedRegistry]);

  const dirtyEntries = useMemo(
    () => (savedRegistry && draftRegistry ? getDirtyFoundationEntries(savedRegistry, draftRegistry) : { sectionIds: [], itemKeys: [] }),
    [draftRegistry, savedRegistry],
  );

  const dirtySectionIds = useMemo(() => new Set(dirtyEntries.sectionIds), [dirtyEntries.sectionIds]);
  const dirtyItemKeys = useMemo(() => new Set(dirtyEntries.itemKeys), [dirtyEntries.itemKeys]);

  const groupedItems = useMemo<DisplayFoundationGroup[]>(() => {
    if (!activeSection) {
      return [];
    }

    if (isTokenSection(activeSection)) {
      const mode = activeMode ?? activeSection.modes[0];

      return activeSection.groups.map((group) => ({
        id: `${activeSection.id}-${group.id}`,
        label: group.label,
        layout: 'token' as const,
        items: [...activeSection.tokens]
          .filter((item) => item.group === group.id)
          .sort((left, right) => {
            if (activeSection.id !== FONTS_SECTION_ID) {
              return 0;
            }

            const leftRank = FONT_ROLE_ORDER.get(left.id) ?? Number.MAX_SAFE_INTEGER;
            const rightRank = FONT_ROLE_ORDER.get(right.id) ?? Number.MAX_SAFE_INTEGER;

            if (leftRank !== rightRank) {
              return leftRank - rightRank;
            }

            return left.label.localeCompare(right.label);
          })
          .map((item) => ({ kind: 'token' as const, sectionId: activeSection.id, item, mode })),
      })).filter((group) => group.items.length > 0);
    }

    return activeSection.groups.map((group) => ({
      id: `${activeSection.id}-${group.id}`,
      label: group.label,
      layout: 'rule' as const,
      items: activeSection.items
        .filter((item) => item.group === group.id)
        .map((item) => ({ kind: 'rule' as const, sectionId: activeSection.id, item })),
    })).filter((group) => group.items.length > 0);
  }, [activeMode, activeSection]);

  function isSectionDirty(sectionId: string) {
    return dirtySectionIds.has(sectionId);
  }

  useEffect(() => {
    if (!dirty) {
      return undefined;
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirty]);

  function updateDraft(mutator: (next: FoundationRegistry) => void) {
    if (!draftRegistry) {
      return;
    }

    const next = cloneRegistry(draftRegistry);
    mutator(next);
    setDraftRegistry(next);
  }

  function clearItemError(itemKey: string) {
    setItemErrorMessages((current) => {
      if (!(itemKey in current)) {
        return current;
      }

      const next = { ...current };
      delete next[itemKey];
      return next;
    });
  }

  function clearColorCellDraft(cellKey: string) {
    setColorCellDrafts((current) => {
      if (!(cellKey in current)) {
        return current;
      }

      const next = { ...current };
      delete next[cellKey];
      return next;
    });
  }

  function clearColorCellError(cellKey: string) {
    setColorCellErrors((current) => {
      if (!(cellKey in current)) {
        return current;
      }

      const next = { ...current };
      delete next[cellKey];
      return next;
    });
  }

  async function persistRegistrySnapshot(nextSavedRegistry: FoundationRegistry) {
    if (!savedRegistry || !draftRegistry) {
      return null;
    }

    const previousDraft = cloneRegistry(draftRegistry);
    const pendingItemKeys = getDirtyFoundationEntries(savedRegistry, draftRegistry).itemKeys;
    const saved = await saveFoundationRegistry(nextSavedRegistry);

    applyFoundationRegistry(saved);
    setSavedRegistry(saved);

    const nextDraft = cloneRegistry(saved);

    for (const pendingItemKey of pendingItemKeys) {
      const parsedKey = splitFoundationItemKey(pendingItemKey);

      if (!parsedKey) {
        continue;
      }

      copyFoundationItem(previousDraft, nextDraft, parsedKey.sectionId, parsedKey.itemId);
    }

    setDraftRegistry(nextDraft);
    return saved;
  }

  async function handleAddGoogleFont() {
    if (!savedRegistry || !draftRegistry) {
      return;
    }

    const parsedPayload = parseGoogleFontPayload(googleFontUrlDraft);

    if (!parsedPayload) {
      setFontLibraryFeedback({
        tone: 'error',
        message: 'Paste a Google Fonts CSS URL or a direct specimen URL.',
      });
      return;
    }

    const existingIds = new Set(activeFontLibrary.map((font) => font.id));
    const existingFamilies = new Set(activeFontLibrary.map((font) => `${font.family.toLowerCase()}::${font.source}`));
    const nextFonts = parsedPayload.families
      .filter((family) => !existingFamilies.has(`${family.toLowerCase()}::google`))
      .map((family) => {
        const id = buildFontAssetId(family, existingIds);
        existingIds.add(id);

        return {
          id,
          label: family,
          family,
          category: inferFontCategory(family),
          source: 'google' as const,
          importUrl: parsedPayload.importUrl,
        };
      });

    if (nextFonts.length === 0) {
      setFontLibraryFeedback({
        tone: 'error',
        message: 'These Google Fonts are already available in the library.',
      });
      return;
    }

    const nextRegistry = cloneRegistry(savedRegistry);
    nextRegistry.fontLibrary = [...activeFontLibrary, ...nextFonts];
    setFontLibraryBusy(true);
    setFontLibraryFeedback(null);

    try {
      await persistRegistrySnapshot(nextRegistry);
      setGoogleFontUrlDraft('');
      setFontLibraryFeedback({
        tone: 'success',
        message: nextFonts.length === 1
          ? `Added ${nextFonts[0].label} to the shared font library.`
          : `Added ${nextFonts.length} Google Fonts to the shared font library.`,
      });
    } catch (error) {
      setFontLibraryFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to add Google Fonts.',
      });
    } finally {
      setFontLibraryBusy(false);
    }
  }

  async function handleUploadLocalFont() {
    if (!savedRegistry || !draftRegistry) {
      return;
    }

    if (!localFontFile) {
      setFontLibraryFeedback({
        tone: 'error',
        message: 'Choose a local font file first.',
      });
      return;
    }

    const fontFormat = guessFontFormat(localFontFile.name);

    if (!fontFormat) {
      setFontLibraryFeedback({
        tone: 'error',
        message: 'Upload .woff2, .woff, .ttf, or .otf files.',
      });
      return;
    }

    const family = deriveFontFamilyFromFileName(localFontFile.name);
    const category = inferFontCategory(localFontFile.name);
    const style = /\b(italic|oblique)\b/i.test(localFontFile.name) ? 'italic' : 'normal';
    const weight = /\bvariable\b/i.test(localFontFile.name) ? '100 900' : '400';

    const duplicate = activeFontLibrary.some((font) => font.family.toLowerCase() === family.toLowerCase() && font.source === 'local');

    if (duplicate) {
      setFontLibraryFeedback({
        tone: 'error',
        message: `${family} is already in the local font library.`,
      });
      return;
    }

    setFontLibraryBusy(true);
    setFontLibraryFeedback(null);

    try {
      const uploadPayload = await uploadFoundationFontFile(localFontFile);
      const existingIds = new Set(activeFontLibrary.map((font) => font.id));
      const nextRegistry = cloneRegistry(savedRegistry);

      nextRegistry.fontLibrary = [
        ...activeFontLibrary,
        {
          id: buildFontAssetId(family, existingIds),
          label: family,
          family,
          category,
          source: 'local',
          faces: [
            {
              fileUrl: uploadPayload.publicUrl,
              format: uploadPayload.format || fontFormat,
              style,
              weight,
            },
          ],
        },
      ];

      await persistRegistrySnapshot(nextRegistry);
      setLocalFontFile(null);
      setLocalFontInputKey((current) => current + 1);
      setFontLibraryFeedback({
        tone: 'success',
        message: `${family} was uploaded and added to the shared font library.`,
      });
    } catch (error) {
      setFontLibraryFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to upload the local font.',
      });
    } finally {
      setFontLibraryBusy(false);
    }
  }

  function updateTokenValue(collectionId: string, tokenId: string, tokenMode: string, value: string) {
    const itemKey = getFoundationItemKey(collectionId, tokenId);
    clearItemError(itemKey);
    updateDraft((next) => {
      const collection = next.collections.find((entry) => entry.id === collectionId);
      const token = collection?.tokens.find((entry) => entry.id === tokenId);
      if (!token) {
        return;
      }

      token.values[tokenMode] = value;
    });
  }

  function updateRuleProperty(collectionId: string, itemId: string, property: string, value: string) {
    const itemKey = getFoundationItemKey(collectionId, itemId);
    clearItemError(itemKey);
    updateDraft((next) => {
      const collection = next.rules.find((entry) => entry.id === collectionId);
      const item = collection?.items.find((entry) => entry.id === itemId);
      if (!item) {
        return;
      }

      item.properties[property] = value;
    });
  }

  async function saveItemFromDraft(
    sourceDraftRegistry: FoundationRegistry,
    sectionId: string,
    itemId: string,
    itemKey: string,
  ) {
    if (!savedRegistry || savingItemKey) {
      return;
    }

    const nextSavedRegistry = cloneRegistry(savedRegistry);
    const copied = copyFoundationItem(sourceDraftRegistry, nextSavedRegistry, sectionId, itemId);
    if (!copied) {
      return;
    }

    const previousDraft = cloneRegistry(sourceDraftRegistry);
    const pendingItemKeys = getDirtyFoundationEntries(savedRegistry, sourceDraftRegistry).itemKeys
      .filter((entryKey) => entryKey !== itemKey);
    clearItemError(itemKey);
    setSavingItemKey(itemKey);

    try {
      const saved = await saveFoundationRegistry(nextSavedRegistry);
      applyFoundationRegistry(saved);
      setSavedRegistry(saved);

      const nextDraft = cloneRegistry(saved);
      for (const pendingItemKey of pendingItemKeys) {
        const parsedKey = splitFoundationItemKey(pendingItemKey);
        if (!parsedKey) {
          continue;
        }

        copyFoundationItem(previousDraft, nextDraft, parsedKey.sectionId, parsedKey.itemId);
      }

      setDraftRegistry(nextDraft);
    } catch (error) {
      setItemErrorMessages((current) => ({
        ...current,
        [itemKey]: error instanceof Error ? error.message : 'Failed to save this item.',
      }));
    } finally {
      setSavingItemKey(null);
    }
  }

  async function handleSaveItem(sectionId: string, itemId: string, itemKey: string) {
    if (!draftRegistry) {
      return;
    }

    await saveItemFromDraft(draftRegistry, sectionId, itemId, itemKey);
  }

  function handleDiscardItem(sectionId: string, itemId: string, itemKey: string) {
    if (!savedRegistry) {
      return;
    }

    clearItemError(itemKey);
    updateDraft((next) => {
      copyFoundationItem(savedRegistry, next, sectionId, itemId);
    });
  }

  function beginColorCellEdit(sectionId: string, tokenId: string, mode: string, value: string) {
    const cellKey = getColorCellKey(sectionId, tokenId, mode);
    clearColorCellError(cellKey);
    clearItemError(getFoundationItemKey(sectionId, tokenId));
    setEditingColorCellKey(cellKey);
    setColorCellDrafts((current) => (cellKey in current ? current : { ...current, [cellKey]: getColorCellDraft(value) }));
  }

  function updateColorCellDraft(sectionId: string, tokenId: string, mode: string, value: ColorCellDraft) {
    const cellKey = getColorCellKey(sectionId, tokenId, mode);
    setEditingColorCellKey(cellKey);
    clearColorCellError(cellKey);
    clearItemError(getFoundationItemKey(sectionId, tokenId));
    setColorCellDrafts((current) => ({ ...current, [cellKey]: value }));
  }

  function discardColorCell(sectionId: string, tokenId: string, mode: string) {
    const cellKey = getColorCellKey(sectionId, tokenId, mode);
    clearColorCellDraft(cellKey);
    clearColorCellError(cellKey);
    setEditingColorCellKey((current) => (current === cellKey ? null : current));
  }

  async function commitColorCell(sectionId: string, tokenId: string, mode: string) {
    if (!savedRegistry || !draftRegistry) {
      return;
    }

    const cellKey = getColorCellKey(sectionId, tokenId, mode);
    const itemKey = getFoundationItemKey(sectionId, tokenId);
    const nextColorDraft = colorCellDrafts[cellKey] ?? getColorCellDraft(getTokenValue(draftRegistry, sectionId, tokenId, mode));
    const normalizedValue = composeColorCellValue(nextColorDraft);
    const savedValue = normalizeAnyColorValue(getTokenValue(savedRegistry, sectionId, tokenId, mode))
      ?? getTokenValue(savedRegistry, sectionId, tokenId, mode).trim();

    if (normalizedValue && normalizedValue === savedValue) {
      clearColorCellDraft(cellKey);
      clearColorCellError(cellKey);
      setEditingColorCellKey((current) => (current === cellKey ? null : current));
      return;
    }

    if (!normalizedValue) {
      const hasValidHex = normalizeBaseHexColorValue(nextColorDraft.hex) !== null;

      setColorCellErrors((current) => ({
        ...current,
        [cellKey]: hasValidHex
          ? 'Enter opacity as a whole number from 0 to 100.'
          : 'Enter a HEX color as #RRGGBB.',
      }));
      return;
    }

    clearColorCellError(cellKey);
    setEditingColorCellKey((current) => (current === cellKey ? null : current));
    clearColorCellDraft(cellKey);

    const nextDraft = cloneRegistry(draftRegistry);
    const collection = nextDraft.collections.find((entry) => entry.id === sectionId);
    const token = collection?.tokens.find((entry) => entry.id === tokenId);

    if (!token) {
      return;
    }

    token.values[mode] = normalizedValue;
    setDraftRegistry(nextDraft);

    await saveItemFromDraft(nextDraft, sectionId, tokenId, itemKey);
  }

  async function copyBasicColorHex(copyKey: string, hex: string) {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(hex);
      } else if (typeof document !== 'undefined') {
        const input = document.createElement('textarea');
        input.value = hex;
        input.setAttribute('readonly', '');
        input.style.position = 'absolute';
        input.style.left = '-9999px';
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }

      setCopiedBasicColorKey(copyKey);
    } catch {
      setCopiedBasicColorKey(null);
    }
  }

  function renderColorsLedger(section: FoundationTokenCollection) {
    return (
      <div className="st-ds-colors-ledger-wrap">
        <div className="st-ds-colors-ledger clip-lg">
          <div className="st-ds-colors-ledger__row st-ds-colors-ledger__row--header">
            <div className="st-ds-colors-ledger__name-col st-ds-colors-ledger__name-col--header">
              Token
            </div>
            {FOUNDATION_THEME_ORDER.map((mode) => (
              <div key={mode} className="st-ds-colors-ledger__header-cell">
                {FOUNDATION_THEME_LABELS[mode]}
              </div>
            ))}
          </div>

          {section.groups.map((group) => {
            const tokens = section.tokens.filter((item) => item.group === group.id);

            if (tokens.length === 0) {
              return null;
            }

            return (
              <div key={group.id} className="st-ds-colors-ledger__group">
                <div className="st-ds-colors-ledger__group-label">{group.label}</div>

                {tokens.map((token) => {
                  const itemKey = getFoundationItemKey(section.id, token.id);
                  const isDirty = dirtyItemKeys.has(itemKey);
                  const isSaving = savingItemKey === itemKey;
                  const itemError = itemErrorMessages[itemKey];
                  const tokenLocked = token.editable === false;

                  return (
                    <div
                      key={token.id}
                      className={[
                        'st-ds-colors-ledger__row',
                        isDirty && 'is-dirty',
                        isSaving && 'is-saving',
                      ].filter(Boolean).join(' ')}
                    >
                      <div className="st-ds-colors-ledger__name-col st-ds-colors-ledger__name-cell">
                        <div className="st-ds-colors-ledger__name-top">
                          <span className="st-ds-colors-ledger__token-label">{token.label}</span>
                          <span className="st-ds-colors-ledger__row-badges">
                            {tokenLocked && <span className="st-ds-foundations-chip">Locked</span>}
                            {isSaving && <span className="st-ds-foundations-list__badge">Saving…</span>}
                            {isDirty && !isSaving && <span className="st-ds-foundations-list__badge">Edited</span>}
                          </span>
                        </div>
                        <code className="st-ds-colors-ledger__token-code">{token.name}</code>
                        {itemError && (
                          <div className="st-ds-colors-ledger__row-error" role="alert">
                            {itemError}
                          </div>
                        )}
                      </div>

                      {FOUNDATION_THEME_ORDER.map((mode) => {
                        const cellKey = getColorCellKey(section.id, token.id, mode);
                        const hexInputLabel = `${token.label} ${FOUNDATION_THEME_LABELS[mode]} color value`;
                        const opacityInputLabel = `${token.label} ${FOUNDATION_THEME_LABELS[mode]} opacity`;
                        const value = token.values[mode] ?? '';
                        const draft = colorCellDrafts[cellKey] ?? getColorCellDraft(value);
                        const isEditing = editingColorCellKey === cellKey;
                        const cellError = colorCellErrors[cellKey];
                        const previewValue = isEditing ? getColorCellPreviewValue(draft) : value;

                        return (
                          <div key={cellKey} className="st-ds-colors-ledger__cell-shell">
                            {isEditing ? (
                              <label
                                className="st-ds-colors-ledger__cell st-ds-colors-ledger__cell--editing"
                                onBlur={(event) => {
                                  const nextFocusedElement = event.relatedTarget as Node | null;

                                  if (event.currentTarget.contains(nextFocusedElement)) {
                                    return;
                                  }

                                  void commitColorCell(section.id, token.id, mode);
                                }}
                              >
                                <span
                                  className="st-ds-colors-ledger__swatch"
                                  style={colorSwatchStyle(previewValue, Boolean(cellError))}
                                  aria-hidden="true"
                                />
                                <span className="st-ds-colors-ledger__field">
                                  <span className="st-ds-colors-ledger__field-main">
                                    <span className="sr-only">{hexInputLabel}</span>
                                    <input
                                      className="st-ds-colors-ledger__input"
                                      aria-label={hexInputLabel}
                                      value={draft.hex}
                                      placeholder="#RRGGBB"
                                      maxLength={7}
                                      spellCheck={false}
                                      autoCapitalize="characters"
                                      autoFocus
                                      disabled={tokenLocked || savingItemKey !== null}
                                      onChange={(event) => updateColorCellDraft(section.id, token.id, mode, {
                                        ...draft,
                                        hex: event.target.value,
                                      })}
                                      onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                          event.preventDefault();
                                          event.currentTarget.blur();
                                        }

                                        if (event.key === 'Escape') {
                                          event.preventDefault();
                                          discardColorCell(section.id, token.id, mode);
                                        }
                                      }}
                                    />
                                  </span>
                                  <span className="st-ds-colors-ledger__field-opacity">
                                    <input
                                      className="st-ds-colors-ledger__opacity-input"
                                      aria-label={opacityInputLabel}
                                      value={draft.opacity}
                                      placeholder="100"
                                      maxLength={3}
                                      inputMode="numeric"
                                      pattern="[0-9]*"
                                      disabled={tokenLocked || savingItemKey !== null}
                                      onChange={(event) => updateColorCellDraft(section.id, token.id, mode, {
                                        ...draft,
                                        opacity: event.target.value.replace(/\D+/g, '').slice(0, 3),
                                      })}
                                      onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                          event.preventDefault();
                                          event.currentTarget.blur();
                                        }

                                        if (event.key === 'Escape') {
                                          event.preventDefault();
                                          discardColorCell(section.id, token.id, mode);
                                        }
                                      }}
                                    />
                                    <span className="st-ds-colors-ledger__opacity-unit">%</span>
                                  </span>
                                </span>
                              </label>
                            ) : (
                              <button
                                type="button"
                                className="st-ds-colors-ledger__cell"
                                aria-label={`Edit ${hexInputLabel}`}
                                disabled={tokenLocked || savingItemKey !== null}
                                onClick={() => beginColorCellEdit(section.id, token.id, mode, value)}
                                onFocus={() => beginColorCellEdit(section.id, token.id, mode, value)}
                              >
                                <span
                                  className="st-ds-colors-ledger__swatch"
                                  style={colorSwatchStyle(value, Boolean(cellError))}
                                  aria-hidden="true"
                                />
                                <span className="st-ds-colors-ledger__field">
                                  <span className="st-ds-colors-ledger__value">{draft.hex}</span>
                                  <span className="st-ds-colors-ledger__field-opacity">
                                    <span className="st-ds-colors-ledger__opacity-value">{draft.opacity}</span>
                                    <span className="st-ds-colors-ledger__opacity-unit">%</span>
                                  </span>
                                </span>
                              </button>
                            )}

                            {cellError && (
                              <div className="st-ds-colors-ledger__cell-error" role="alert">
                                {cellError}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderBasicColorsLedger() {
    return (
      <div className="st-ds-basic-colors-stack">
        <div className="st-ds-basic-colors-ledger-wrap">
          <div className="st-ds-basic-colors-ledger clip-lg">
            <div className="st-ds-basic-colors-ledger__row st-ds-basic-colors-ledger__row--header">
              <div className="st-ds-basic-colors-ledger__tone-col st-ds-basic-colors-ledger__tone-col--header">
                Step
              </div>
              {BASIC_COLOR_PALETTES.map((palette) => (
                <div key={palette.id} className="st-ds-basic-colors-ledger__header-cell">
                  {palette.label}
                </div>
              ))}
            </div>

            {BASIC_COLOR_STEPS.map((step) => (
              <div key={step} className="st-ds-basic-colors-ledger__row">
                <div className="st-ds-basic-colors-ledger__tone-col">
                  <span className="st-ds-basic-colors-ledger__tone-value">{step}</span>
                </div>

                {BASIC_COLOR_PALETTES.map((palette) => {
                  const color = palette.colors[step];
                  const copyKey = `${palette.id}-${step}`;
                  const isCopied = copiedBasicColorKey === copyKey;

                  return (
                    <div key={copyKey} className="st-ds-basic-colors-ledger__cell-shell">
                      <button
                        type="button"
                        className="st-ds-basic-colors-ledger__cell"
                        aria-label={`Copy ${palette.label} ${step} hex ${color.hex}`}
                        onClick={() => {
                          void copyBasicColorHex(copyKey, color.hex);
                        }}
                      >
                        <span
                          className="st-ds-basic-colors-ledger__swatch"
                          style={{ background: color.hex }}
                          aria-hidden="true"
                        />
                        <code className="st-ds-basic-colors-ledger__hex">{color.hex}</code>
                        {isCopied && <span className="st-ds-foundations-list__badge">Copied</span>}
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <section className="st-ds-basic-colors-badges">
          <div className="st-ds-basic-colors-badges__header">
            <span className="st-ds-foundations-group__title">For badges</span>
          </div>
          <div className="st-ds-basic-colors-badges__grid">
            {BASIC_BADGE_COLORS.map((hex) => {
              const copyKey = `badge-${hex}`;
              const isCopied = copiedBasicColorKey === copyKey;

              return (
                <button
                  key={hex}
                  type="button"
                  className="st-ds-basic-colors-badges__item clip-lg"
                  aria-label={`Copy badge hex ${hex}`}
                  onClick={() => {
                    void copyBasicColorHex(copyKey, hex);
                  }}
                >
                  <span
                    className="st-ds-basic-colors-badges__swatch"
                    style={{ background: hex }}
                    aria-hidden="true"
                  />
                  <code className="st-ds-basic-colors-badges__hex">{hex}</code>
                  {isCopied && <span className="st-ds-foundations-list__badge">Copied</span>}
                </button>
              );
            })}
          </div>
        </section>
      </div>
    );
  }

  function renderCoreTokenPreview(token: FoundationToken, mode: string) {
    if (token.preview === 'spacing') {
      const indicatorWidth = getSpacingPreviewWidth(token.values[mode] ?? '');

      return (
        <span className="st-ds-token-ledger__swatch st-ds-token-ledger__swatch--spacing" aria-hidden="true">
          {indicatorWidth > 0 && (
            <span className="st-ds-token-ledger__spacing-indicator" style={{ width: `${indicatorWidth}px` }} />
          )}
        </span>
      );
    }

    return (
      <span
        className={[
          'st-ds-token-ledger__swatch',
          token.preview === 'shadow' && 'st-ds-token-ledger__swatch--shadow',
        ].filter(Boolean).join(' ')}
        style={{
          ...tokenPreviewStyle(token, mode),
          ...(token.preview === 'shadow' ? { border: 'none' } : {}),
        }}
        aria-hidden="true"
      />
    );
  }

  function renderCoreTokenLedger(section: FoundationTokenCollection) {
    const isCompactSection = section.id === 'spacing' || section.id === 'radii';

    return (
      <div
        className={[
          'st-ds-colors-ledger-wrap',
          isCompactSection && 'st-ds-colors-ledger-wrap--compact',
        ].filter(Boolean).join(' ')}
      >
        <div
          className={[
            'st-ds-colors-ledger',
            'st-ds-colors-ledger--token',
            isCompactSection && 'st-ds-colors-ledger--compact',
            'clip-lg',
          ].filter(Boolean).join(' ')}
        >
          <div className="st-ds-colors-ledger__row st-ds-colors-ledger__row--header">
            <div className="st-ds-colors-ledger__name-col st-ds-colors-ledger__name-col--header">
              Token
            </div>
            {section.modes.map((mode) => (
              <div key={mode} className="st-ds-colors-ledger__header-cell">
                {getFoundationModeLabel(mode)}
              </div>
            ))}
          </div>

          {section.groups.map((group) => {
            const tokens = section.tokens.filter((item) => item.group === group.id);

            if (tokens.length === 0) {
              return null;
            }

            return (
              <div key={group.id} className="st-ds-colors-ledger__group">
                <div className="st-ds-colors-ledger__group-label">{group.label}</div>

                {tokens.map((token) => {
                  const itemKey = getFoundationItemKey(section.id, token.id);
                  const isDirty = dirtyItemKeys.has(itemKey);
                  const isSavingItem = savingItemKey === itemKey;
                  const itemError = itemErrorMessages[itemKey];
                  const tokenLocked = token.editable === false;
                  const actionsDisabled = savingItemKey !== null;

                  return (
                    <div
                      key={token.id}
                      className={[
                        'st-ds-colors-ledger__row',
                        isDirty && 'is-dirty',
                        isSavingItem && 'is-saving',
                      ].filter(Boolean).join(' ')}
                    >
                      <div className="st-ds-colors-ledger__name-col st-ds-colors-ledger__name-cell">
                        <div className="st-ds-colors-ledger__name-top">
                          <span className="st-ds-colors-ledger__token-label">{token.label}</span>
                          <span className="st-ds-colors-ledger__row-badges">
                            {tokenLocked && <span className="st-ds-foundations-chip">Locked</span>}
                            {isSavingItem && <span className="st-ds-foundations-list__badge">Saving…</span>}
                            {isDirty && !isSavingItem && <span className="st-ds-foundations-list__badge">Edited</span>}
                          </span>
                        </div>
                        <code className="st-ds-colors-ledger__token-code">{token.name}</code>
                        {itemError && (
                          <div className="st-ds-colors-ledger__row-error" role="alert">
                            {itemError}
                          </div>
                        )}
                        {isDirty && (
                          <div className="st-ds-foundations-card__actions">
                            <div className="st-ds-foundations-card__actions-row" role="group" aria-label={`${token.label} unsaved changes`}>
                              <button
                                type="button"
                                className="st-ds-foundations-btn st-ds-foundations-btn--ghost"
                                onClick={() => handleDiscardItem(section.id, token.id, itemKey)}
                                disabled={actionsDisabled}
                              >
                                Discard
                              </button>
                              <button
                                type="button"
                                className="st-ds-foundations-btn st-ds-foundations-btn--primary"
                                onClick={() => handleSaveItem(section.id, token.id, itemKey)}
                                disabled={actionsDisabled}
                              >
                                {isSavingItem ? 'Saving…' : 'Save'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {section.modes.map((mode) => (
                        <div key={`${token.id}-${mode}`} className="st-ds-colors-ledger__cell-shell">
                          <label className="st-ds-token-ledger__field">
                            <span className="sr-only">{`${token.label} ${getFoundationModeLabel(mode)} value`}</span>
                            {!isCompactSection && renderCoreTokenPreview(token, mode)}
                            <input
                              className="st-ds-foundations-input st-ds-foundations-input--inline st-ds-token-ledger__input"
                              aria-label={`${token.label} ${getFoundationModeLabel(mode)} value`}
                              value={token.values[mode] ?? ''}
                              readOnly={tokenLocked}
                              onChange={(event) => updateTokenValue(section.id, token.id, mode, event.target.value)}
                            />
                          </label>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderFontLibraryManager() {
    if (activeSection.id !== FONTS_SECTION_ID) {
      return null;
    }

    const controlsDisabled = fontLibraryBusy || savingItemKey !== null || !import.meta.env.DEV;

    return (
      <section className="st-ds-font-library clip-lg" aria-label="Font Library">
        <div className="st-ds-font-library__intake">
          <section className="st-ds-font-library__panel">
            <span className="st-ds-foundations-list__label">Google Fonts URL</span>
            <label className="st-ds-foundations-inline-field st-ds-foundations-inline-field--stack">
              <span className="sr-only">Google Fonts CSS URL</span>
              <span className={['st-ds-foundations-control', controlsDisabled && 'is-readonly'].filter(Boolean).join(' ')}>
                <input
                  className="st-ds-foundations-input"
                  aria-label="Google Fonts CSS URL"
                  placeholder="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap"
                  value={googleFontUrlDraft}
                  readOnly={!import.meta.env.DEV}
                  onChange={(event) => setGoogleFontUrlDraft(event.target.value)}
                />
              </span>
            </label>
            <button
              type="button"
              className="st-ds-foundations-btn st-ds-foundations-btn--primary"
              disabled={controlsDisabled || googleFontUrlDraft.trim().length === 0}
              onClick={() => {
                void handleAddGoogleFont();
              }}
            >
              {fontLibraryBusy ? 'Adding…' : 'Add Google Font'}
            </button>
          </section>

          <section className="st-ds-font-library__panel">
            <span className="st-ds-foundations-list__label">Local Upload</span>
            <label className="st-ds-foundations-inline-field st-ds-foundations-inline-field--stack">
              <span className="st-ds-foundations-list__value-label">Font file</span>
              <span className={['st-ds-foundations-control', 'st-ds-foundations-control--file', controlsDisabled && 'is-readonly'].filter(Boolean).join(' ')}>
                <input
                  key={localFontInputKey}
                  className="st-ds-font-library__file-input"
                  aria-label="Local font file"
                  type="file"
                  accept=".woff2,.woff,.ttf,.otf"
                  disabled={!import.meta.env.DEV}
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setLocalFontFile(file);
                  }}
                />
                <span className="st-ds-font-library__file-label">
                  {localFontFile ? localFontFile.name : 'Choose font file'}
                </span>
              </span>
            </label>
            <button
              type="button"
              className="st-ds-foundations-btn st-ds-foundations-btn--primary"
              disabled={controlsDisabled || !localFontFile}
              onClick={() => {
                void handleUploadLocalFont();
              }}
            >
              {fontLibraryBusy ? 'Uploading…' : 'Upload Local Font'}
            </button>
          </section>
        </div>

        {fontLibraryFeedback && (
          <div
            className={[
              'st-ds-font-library__feedback',
              fontLibraryFeedback.tone === 'error' && 'is-error',
              fontLibraryFeedback.tone === 'success' && 'is-success',
            ].filter(Boolean).join(' ')}
            role="status"
          >
            {fontLibraryFeedback.message}
          </div>
        )}
      </section>
    );
  }

  if (loading) {
    return (
      <div className="st-ds-content st-ds-foundations">
        <Heading display level={1}>Foundations</Heading>
        <Text color="secondary">Loading canonical foundation registry…</Text>
      </div>
    );
  }

  if (loadError || !savedRegistry || !draftRegistry || !activeSection) {
    return (
      <div className="st-ds-content st-ds-foundations">
        <Heading display level={1}>Foundations</Heading>
        <div className="st-ds-foundations-alert st-ds-foundations-alert--error">
          {loadError || 'Foundations registry is unavailable.'}
        </div>
      </div>
    );
  }

  function renderNavButton(section: FoundationSection) {
    return (
      <li key={section.id}>
        <button
          type="button"
          onClick={() => setSelectedSectionId(section.id)}
          aria-pressed={activeSection.id === section.id}
          className={[
            'st-ds-sidebar__link',
            'st-ds-foundations-sidebar__button',
            activeSection.id === section.id && 'is-active',
          ].filter(Boolean).join(' ')}
        >
          <span className="st-ds-foundations-sidebar__label">{section.label}</span>
          {isSectionDirty(section.id) && <span className="st-ds-foundations-nav__badge">Edited</span>}
        </button>
      </li>
    );
  }

  function renderSidebarGroup(title: string, sections: FoundationSection[]) {
    if (sections.length === 0) {
      return null;
    }

    return (
      <div className="st-ds-sidebar__group">
        <div className="st-ds-sidebar__group-title">{title}</div>
        <ul className="st-ds-sidebar__list">
          {sections.map(renderNavButton)}
        </ul>
      </div>
    );
  }

  return (
    <div className="st-ds-atoms-root st-ds-foundations-shell">
      <aside className="st-ds-sidebar st-ds-sidebar--foundations" aria-label="Foundations">
        {renderSidebarGroup('Core', primaryNavSections)}
        {renderSidebarGroup('Typography', typographyNavSections)}
      </aside>

      <div className="st-ds-content st-ds-foundations">
        <section
          className={[
            'st-ds-foundations-panel',
            'st-ds-foundations-panel--main',
            (activeSection.id === FONTS_SECTION_ID || activeSection.id === TYPOGRAPHY_SCALE_SECTION_ID) && 'is-compact-token-stack',
            activeSection.id === FONTS_SECTION_ID && 'is-fonts',
            activeSection.id === TYPOGRAPHY_RULES_SECTION_ID && 'is-typography-rules',
          ].filter(Boolean).join(' ')}
        >
          <div
            className={[
              'st-ds-foundations-panel__header',
              isColorsSectionActive && 'st-ds-foundations-panel__header--colors-modes',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <div className="st-ds-foundations-panel__header-copy">
              <Heading level={2}>{activeSection.label}</Heading>
            </div>
            {isColorsSectionActive && (
              <div className="st-ds-foundations-panel__header-meta">
                <div className="st-ds-foundations-modes" role="tablist" aria-label="Colors views">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeColorsView === 'active'}
                    className={['st-ds-foundations-modes__btn', activeColorsView === 'active' && 'is-active'].filter(Boolean).join(' ')}
                    onClick={() => setActiveColorsView('active')}
                  >
                    Theme
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeColorsView === 'basic'}
                    className={['st-ds-foundations-modes__btn', activeColorsView === 'basic' && 'is-active'].filter(Boolean).join(' ')}
                    onClick={() => setActiveColorsView('basic')}
                  >
                    Basic colors
                  </button>
                </div>
              </div>
            )}
            {isIconsSectionActive && (
              <div className="st-ds-foundations-panel__header-meta">
                <a
                  className="st-ds-foundations-btn st-ds-foundations-btn--ghost st-ds-foundations-btn--xs st-ds-foundations-btn--link"
                  href={ICON_LIBRARY_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span>Lucide</span>
                  <ExternalLink size={12} aria-hidden="true" />
                </a>
              </div>
            )}
          </div>

          {isColorsSectionActive ? (
            activeColorsView === 'active' ? renderColorsLedger(activeSection) : renderBasicColorsLedger()
          ) : isIconsSectionActive ? null : (
            isTokenSection(activeSection) && CORE_LEDGER_SECTION_IDS.has(activeSection.id) ? renderCoreTokenLedger(activeSection) : (
            <div className="st-ds-foundations-groups">
            {renderFontLibraryManager()}
            {groupedItems.map((group) => (
                <div key={group.id} className="st-ds-foundations-group">
                  <div className={['st-ds-foundations-list', group.layout === 'token' ? 'is-token-grid' : 'is-rule-grid'].join(' ')}>
                    {group.items.map((entry) => {
                      const itemKey = getFoundationItemKey(entry.sectionId, entry.item.id);
                      const isDirty = dirtyItemKeys.has(itemKey);
                      const isSavingItem = savingItemKey === itemKey;
                      const itemError = itemErrorMessages[itemKey];
                      const actionsDisabled = savingItemKey !== null;

                    if (entry.kind === 'token') {
                      const token = entry.item;
                      const tokenMode = entry.mode;
                      const tokenLocked = token.editable === false;
                      const isFontRoleCard = entry.sectionId === FONTS_SECTION_ID;
                      const fontRoleOptions = isFontRoleCard ? getFontRoleOptions(activeFontLibrary, token.id) : [];
                      const selectedFontOption = fontRoleOptions.find((option) => getFoundationFontStack(option) === (token.values[tokenMode] ?? '')) ?? null;
                      const showTokenPreview = token.preview !== 'spacing';
                      const hasTokenFooter = tokenLocked || showTokenPreview || isDirty;
                      const canSaveItem = savingItemKey === null && (!isFontRoleCard || selectedFontOption !== null);
                      const fontRoleStatusLabel = selectedFontOption ? getFontOptionSourceLabel(selectedFontOption.source) : 'Not Bundled';

                      return (
                        <article
                          key={token.id}
                          className={[
                            'st-ds-foundations-list__item',
                            'is-token-card',
                            isFontRoleCard && 'is-font-role-card',
                            !hasTokenFooter && 'is-token-card--compact',
                            'clip-lg',
                            isDirty && 'is-dirty',
                          ].filter(Boolean).join(' ')}
                        >
                          <div className="st-ds-foundations-card__top">
                            <div className="st-ds-foundations-card__meta">
                              <div className="st-ds-foundations-list__row">
                                <span className="st-ds-foundations-list__label">{token.label}</span>
                                <span className="st-ds-foundations-font-role__badges">
                                  {isFontRoleCard && (
                                    <span className={['st-ds-foundations-chip', !selectedFontOption && 'is-warning'].filter(Boolean).join(' ')}>
                                      {fontRoleStatusLabel}
                                    </span>
                                  )}
                                  {isDirty && <span className="st-ds-foundations-list__badge">Edited</span>}
                                </span>
                              </div>
                              <code className="st-ds-foundations-list__code">{token.name}</code>
                            </div>

                            {isFontRoleCard ? (
                              <label className="st-ds-foundations-inline-field">
                                <span className="sr-only">Project Font</span>
                                <span className={['st-ds-foundations-control', tokenLocked && 'is-readonly'].filter(Boolean).join(' ')}>
                                  <select
                                    className="st-ds-foundations-input"
                                    aria-label={`${token.label} project font`}
                                    value={selectedFontOption ? getFoundationFontStack(selectedFontOption) : ''}
                                    disabled={tokenLocked}
                                    onChange={(event) => updateTokenValue(entry.sectionId, token.id, tokenMode, event.target.value)}
                                  >
                                    {!selectedFontOption && <option value="">Unsupported Current Stack</option>}
                                    {FONT_SOURCE_ORDER.map((source) => {
                                      const options = fontRoleOptions.filter((option) => option.source === source);

                                      if (options.length === 0) {
                                        return null;
                                      }

                                      return (
                                        <optgroup key={`${token.id}-${source}`} label={getFontOptionSourceLabel(source)}>
                                          {options.map((option) => (
                                            <option key={`${token.id}-${option.id}`} value={getFoundationFontStack(option)}>
                                              {`${option.label} • ${getFontCategoryLabel(option.category)}`}
                                            </option>
                                          ))}
                                        </optgroup>
                                      );
                                    })}
                                  </select>
                                </span>
                              </label>
                            ) : (
                              <label className="st-ds-foundations-inline-field">
                                <span className="sr-only">Value ({tokenMode})</span>
                                <span className={['st-ds-foundations-control', tokenLocked && 'is-readonly'].filter(Boolean).join(' ')}>
                                  <input
                                    className="st-ds-foundations-input st-ds-foundations-input--inline"
                                    aria-label={`${token.label} value (${tokenMode})`}
                                    value={token.values[tokenMode] ?? ''}
                                    readOnly={tokenLocked}
                                    onChange={(event) => updateTokenValue(entry.sectionId, token.id, tokenMode, event.target.value)}
                                  />
                                </span>
                              </label>
                            )}
                          </div>

                          {hasTokenFooter && (
                            <div className="st-ds-foundations-card__bottom">
                              <div className="st-ds-foundations-card__notes">
                                {tokenLocked && <span className="st-ds-foundations-chip">Locked</span>}
                                {isFontRoleCard && selectedFontOption && (
                                  <span className="st-ds-foundations-chip">
                                    {getFontCategoryLabel(selectedFontOption.category)}
                                  </span>
                                )}
                              </div>

                              {showTokenPreview && (
                                <div className="st-ds-foundations-card__preview">
                                  <div
                                    className={[
                                      'st-ds-foundations-preview__surface',
                                      'st-ds-foundations-preview__surface--card',
                                      token.preview === 'font' && 'is-font',
                                    ].filter(Boolean).join(' ')}
                                    style={tokenPreviewStyle(token, tokenMode)}
                                  >
                                    {token.preview === 'color' && token.label}
                                    {token.preview === 'font' && 'Sphinx of black quartz.'}
                                    {token.preview === 'text' && 'Type'}
                                    {token.preview === 'generic' && (token.values[tokenMode] ?? 'Value')}
                                  </div>
                                </div>
                              )}

                              {isDirty && (
                                <div className="st-ds-foundations-card__actions">
                                  <div className="st-ds-foundations-card__actions-row" role="group" aria-label={`${token.label} unsaved changes`}>
                                    <button
                                      type="button"
                                      className="st-ds-foundations-btn st-ds-foundations-btn--ghost"
                                      onClick={() => handleDiscardItem(entry.sectionId, token.id, itemKey)}
                                      disabled={actionsDisabled}
                                    >
                                      Discard
                                    </button>
                                    <button
                                      type="button"
                                      className="st-ds-foundations-btn st-ds-foundations-btn--primary"
                                      onClick={() => handleSaveItem(entry.sectionId, token.id, itemKey)}
                                      disabled={actionsDisabled || !canSaveItem}
                                    >
                                      {isSavingItem ? 'Saving…' : 'Save'}
                                    </button>
                                  </div>
                                  {itemError && (
                                    <div className="st-ds-foundations-card__feedback" role="alert">
                                      {itemError}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </article>
                      );
                    }

                    const rule = entry.item;

                    return (
                      <article
                        key={rule.id}
                        className={[
                          'st-ds-foundations-list__item',
                          'is-rule-card',
                          'clip-lg',
                          isDirty && 'is-dirty',
                        ].filter(Boolean).join(' ')}
                      >
                        <div className="st-ds-foundations-card__top">
                          <div className="st-ds-foundations-card__meta">
                            <div className="st-ds-foundations-list__row">
                              <span className="st-ds-foundations-list__label">{rule.label}</span>
                              {isDirty && <span className="st-ds-foundations-list__badge">Edited</span>}
                            </div>
                            <code className="st-ds-foundations-list__code">{rule.id}</code>
                          </div>
                        </div>

                        <div className="st-ds-foundations-rule-grid st-ds-foundations-rule-grid--card">
                          {Object.entries(rule.properties).map(([property, value]) => (
                            <label key={property} className="st-ds-foundations-inline-field st-ds-foundations-inline-field--stack">
                              <span className="st-ds-foundations-list__value-label">{property}</span>
                              <span className="st-ds-foundations-control">
                                <input
                                  className="st-ds-foundations-input"
                                  value={value}
                                  onChange={(event) => updateRuleProperty(entry.sectionId, rule.id, property, event.target.value)}
                                />
                              </span>
                            </label>
                          ))}
                        </div>

                        <div className="st-ds-foundations-card__bottom st-ds-foundations-card__bottom--rule">
                          <div className="st-ds-foundations-card__preview">
                            <div className="st-ds-foundations-preview__surface st-ds-foundations-preview__surface--card is-rule">
                              <span style={rulePreviewStyle(rule)}>
                                {rule.previewText || rule.label}
                              </span>
                            </div>
                          </div>

                          {isDirty && (
                            <div className="st-ds-foundations-card__actions">
                              <div className="st-ds-foundations-card__actions-row" role="group" aria-label={`${rule.label} unsaved changes`}>
                                <button
                                  type="button"
                                  className="st-ds-foundations-btn st-ds-foundations-btn--ghost"
                                  onClick={() => handleDiscardItem(entry.sectionId, rule.id, itemKey)}
                                  disabled={actionsDisabled}
                                >
                                  Discard
                                </button>
                                <button
                                  type="button"
                                  className="st-ds-foundations-btn st-ds-foundations-btn--primary"
                                  onClick={() => handleSaveItem(entry.sectionId, rule.id, itemKey)}
                                  disabled={actionsDisabled}
                                >
                                  {isSavingItem ? 'Saving…' : 'Save'}
                                </button>
                              </div>
                              {itemError && (
                                <div className="st-ds-foundations-card__feedback" role="alert">
                                  {itemError}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
                </div>
              ))}
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
