export const GLOBAL_ICON_STROKE_WIDTH_STORAGE_KEY = 'remide-icon-stroke-width';
export const GLOBAL_ICON_STROKE_WIDTH_CSS_VAR = '--st-icon-stroke-width';
export const ICON_STROKE_PRESETS = [1, 1.5, 2, 2.5, 3] as const;
export const DEFAULT_GLOBAL_ICON_STROKE_WIDTH = 2;

export type IconStrokePreset = typeof ICON_STROKE_PRESETS[number];

function isIconStrokePreset(value: number): value is IconStrokePreset {
  return ICON_STROKE_PRESETS.includes(value as IconStrokePreset);
}

export function normalizeIconStrokeWidth(value: unknown): IconStrokePreset {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) && isIconStrokePreset(parsed) ? parsed : DEFAULT_GLOBAL_ICON_STROKE_WIDTH;
}

export function readGlobalIconStrokeWidth(storage?: Pick<Storage, 'getItem'>): IconStrokePreset {
  if (storage) {
    return normalizeIconStrokeWidth(storage.getItem(GLOBAL_ICON_STROKE_WIDTH_STORAGE_KEY));
  }

  if (typeof window === 'undefined') {
    return DEFAULT_GLOBAL_ICON_STROKE_WIDTH;
  }

  return normalizeIconStrokeWidth(window.localStorage.getItem(GLOBAL_ICON_STROKE_WIDTH_STORAGE_KEY));
}

export function applyGlobalIconStrokeWidth(
  value: unknown,
  target?: Pick<CSSStyleDeclaration, 'setProperty'> | HTMLElement,
): IconStrokePreset {
  const normalized = normalizeIconStrokeWidth(value);

  if (target && 'style' in target) {
    target.style.setProperty(GLOBAL_ICON_STROKE_WIDTH_CSS_VAR, String(normalized));
    return normalized;
  }

  if (target) {
    target.setProperty(GLOBAL_ICON_STROKE_WIDTH_CSS_VAR, String(normalized));
    return normalized;
  }

  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty(GLOBAL_ICON_STROKE_WIDTH_CSS_VAR, String(normalized));
  }

  return normalized;
}

export function setGlobalIconStrokeWidth(
  value: unknown,
  options?: {
    storage?: Pick<Storage, 'setItem'>;
    target?: Pick<CSSStyleDeclaration, 'setProperty'> | HTMLElement;
  },
): IconStrokePreset {
  const normalized = applyGlobalIconStrokeWidth(value, options?.target);

  if (options?.storage) {
    options.storage.setItem(GLOBAL_ICON_STROKE_WIDTH_STORAGE_KEY, String(normalized));
    return normalized;
  }

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(GLOBAL_ICON_STROKE_WIDTH_STORAGE_KEY, String(normalized));
  }

  return normalized;
}

export function initializeGlobalIconSettings() {
  return applyGlobalIconStrokeWidth(readGlobalIconStrokeWidth());
}
