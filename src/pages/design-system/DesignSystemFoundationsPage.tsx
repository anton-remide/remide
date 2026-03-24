import { useEffect, useMemo, useState } from 'react';
import Heading from '../../components/ui/Heading';
import Text from '../../components/ui/Text';
import type {
  FoundationRegistry,
  FoundationRuleItem,
  FoundationSection,
  FoundationToken,
  FoundationTokenCollection,
} from '../../design-system/foundations';
import {
  generateFoundationCss,
  getDirtyFoundationEntries,
  getFoundationItemKey,
  getFoundationSections,
} from '../../design-system/foundations';

const FOUNDATION_ENDPOINT = '/__internal/foundations';
const FOUNDATION_PUBLIC_URL = `${import.meta.env.BASE_URL}design-system/foundation.registry.json`;
const FOUNDATION_RUNTIME_STYLE_ID = 'st-foundations-runtime-style';
const FONTS_SECTION_ID = 'fonts';
const TYPOGRAPHY_RULES_SECTION_ID = 'typography-rules';
const TYPOGRAPHY_SCALE_SECTION_ID = 'typography-scale';
const TYPOGRAPHY_SECTION_IDS = new Set([TYPOGRAPHY_SCALE_SECTION_ID, TYPOGRAPHY_RULES_SECTION_ID]);
const SECTION_NAV_ORDER = [
  'colors',
  'spacing',
  'radii',
  'shadows',
  FONTS_SECTION_ID,
  TYPOGRAPHY_SCALE_SECTION_ID,
  TYPOGRAPHY_RULES_SECTION_ID,
];
type ProjectFontCategory = 'sans' | 'serif' | 'mono';
type ProjectFontSource = 'google' | 'local';
type DisplayFoundationItem =
  | { kind: 'token'; sectionId: string; item: FoundationToken; mode: string }
  | { kind: 'rule'; sectionId: string; item: FoundationRuleItem };

interface DisplayFoundationGroup {
  id: string;
  label: string;
  layout: 'token' | 'rule';
  items: DisplayFoundationItem[];
}

interface ProjectFontOption {
  value: string;
  label: string;
  category: ProjectFontCategory;
  source: ProjectFontSource;
}

const PROJECT_FONT_OPTIONS: ProjectFontOption[] = [
  {
    value: "'Geist', sans-serif",
    label: 'Geist',
    category: 'sans',
    source: 'google',
  },
  {
    value: "'Satoshi Variable', sans-serif",
    label: 'Satoshi Variable',
    category: 'sans',
    source: 'local',
  },
  {
    value: "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    label: 'Geist Mono',
    category: 'mono',
    source: 'google',
  },
];

function cloneRegistry(registry: FoundationRegistry) {
  return JSON.parse(JSON.stringify(registry)) as FoundationRegistry;
}

function isTokenSection(section: FoundationSection): section is FoundationTokenCollection {
  return section.kind === 'token';
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

  return response.json() as Promise<FoundationRegistry>;
}

async function saveFoundationRegistry(registry: FoundationRegistry) {
  if (!import.meta.env.DEV) {
    throw new Error('Local Save is available only in the Vite dev server.');
  }

  const response = await fetch(FOUNDATION_ENDPOINT, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ registry }),
  });

  const payload = await response.json() as { error?: string } & FoundationRegistry;

  if (!response.ok) {
    throw new Error(payload.error || `Failed to save foundations (${response.status})`);
  }

  return payload as FoundationRegistry;
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
    case 'spacing':
      return {
        width: `min(${value}, 100%)`,
        background: 'var(--color-accent)',
        borderRadius: '999px',
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

function getFontOptionSourceLabel(source: ProjectFontSource) {
  switch (source) {
    case 'google':
      return 'Google';
    case 'local':
      return 'Local';
    default:
      return 'Bundled';
  }
}

function getFontRoleCategories(tokenId: string): ProjectFontCategory[] {
  if (tokenId === 'font-mono') {
    return ['mono'];
  }

  return ['sans', 'serif'];
}

function getFontRoleOptions(tokenId: string) {
  const categories = getFontRoleCategories(tokenId);
  return PROJECT_FONT_OPTIONS.filter((option) => categories.includes(option.category));
}

export default function DesignSystemFoundationsPage() {
  const [savedRegistry, setSavedRegistry] = useState<FoundationRegistry | null>(null);
  const [draftRegistry, setDraftRegistry] = useState<FoundationRegistry | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingItemKey, setSavingItemKey] = useState<string | null>(null);
  const [itemErrorMessages, setItemErrorMessages] = useState<Record<string, string>>({});
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedModes, setSelectedModes] = useState<Record<string, string>>({});

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

  const activeSection = useMemo(
    () => visibleSections.find((section) => section.id === selectedSectionId) ?? visibleSections[0] ?? null,
    [selectedSectionId, visibleSections],
  );

  useEffect(() => {
    if (!activeSection || !isTokenSection(activeSection) || activeSection.modes.length === 0) {
      return;
    }

    setSelectedModes((current) => {
      const selectedMode = current[activeSection.id];
      if (selectedMode && activeSection.modes.includes(selectedMode)) {
        return current;
      }

      return {
        ...current,
        [activeSection.id]: activeSection.modes[0],
      };
    });
  }, [activeSection]);

  const activeMode = activeSection && isTokenSection(activeSection)
    ? selectedModes[activeSection.id] ?? activeSection.modes[0]
    : undefined;

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
        items: activeSection.tokens
          .filter((item) => item.group === group.id)
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

  async function handleSaveItem(sectionId: string, itemId: string, itemKey: string) {
    if (!savedRegistry || !draftRegistry || savingItemKey) {
      return;
    }

    const nextSavedRegistry = cloneRegistry(savedRegistry);
    const copied = copyFoundationItem(draftRegistry, nextSavedRegistry, sectionId, itemId);
    if (!copied) {
      return;
    }

    const previousDraft = cloneRegistry(draftRegistry);
    const pendingItemKeys = dirtyEntries.itemKeys.filter((entryKey) => entryKey !== itemKey);
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

  function handleDiscardItem(sectionId: string, itemId: string, itemKey: string) {
    if (!savedRegistry) {
      return;
    }

    clearItemError(itemKey);
    updateDraft((next) => {
      copyFoundationItem(savedRegistry, next, sectionId, itemId);
    });
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
      <button
        key={section.id}
        type="button"
        onClick={() => setSelectedSectionId(section.id)}
        className={['st-ds-foundations-nav__item', activeSection.id === section.id && 'is-active'].filter(Boolean).join(' ')}
      >
        <span className="st-ds-foundations-nav__title">
          {section.label}
          {isSectionDirty(section.id) && <span className="st-ds-foundations-nav__badge">Edited</span>}
        </span>
      </button>
    );
  }

  return (
    <div className="st-ds-content st-ds-foundations">
      <div className="st-ds-foundations-workspace">
        <aside className="st-ds-foundations-panel st-ds-foundations-panel--sidebar">
          <div className="st-ds-foundations-nav">
            <div className="st-ds-foundations-nav__group">
              {primaryNavSections.map(renderNavButton)}
            </div>
            {typographyNavSections.length > 0 && (
              <div className="st-ds-foundations-nav__group st-ds-foundations-nav__group--secondary">
                {typographyNavSections.map(renderNavButton)}
              </div>
            )}
          </div>
        </aside>

        <section className="st-ds-foundations-panel st-ds-foundations-panel--main">
          <div className="st-ds-foundations-panel__header">
            <div className="st-ds-foundations-panel__header-copy">
              <Heading level={2}>{activeSection.label}</Heading>
            </div>

            {isTokenSection(activeSection) && activeSection.modes.length > 1 && (
              <div className="st-ds-foundations-modes" role="tablist" aria-label={`${activeSection.label} modes`}>
                {activeSection.modes.map((entry) => (
                  <button
                    key={entry}
                    type="button"
                    className={['st-ds-foundations-modes__btn', activeMode === entry && 'is-active'].filter(Boolean).join(' ')}
                    onClick={() => setSelectedModes((current) => ({ ...current, [activeSection.id]: entry }))}
                  >
                    {entry}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="st-ds-foundations-groups">
            {groupedItems.map((group) => (
                <div key={group.id} className="st-ds-foundations-group">
                  <div className="st-ds-foundations-group__title">{group.label}</div>
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
                      const fontRoleOptions = isFontRoleCard ? getFontRoleOptions(token.id) : [];
                      const selectedFontOption = fontRoleOptions.find((option) => option.value === (token.values[tokenMode] ?? '')) ?? null;
                      const showTokenPreview = !isFontRoleCard;
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
                                <select
                                  className="st-ds-foundations-input"
                                  aria-label={`${token.label} project font`}
                                  value={selectedFontOption?.value ?? ''}
                                  disabled={tokenLocked}
                                  onChange={(event) => updateTokenValue(entry.sectionId, token.id, tokenMode, event.target.value)}
                                >
                                  {!selectedFontOption && <option value="">Unsupported Current Stack</option>}
                                  {fontRoleOptions.map((option) => (
                                    <option key={`${token.id}-${option.value}`} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            ) : (
                              <label className="st-ds-foundations-inline-field">
                                <span className="sr-only">Value ({tokenMode})</span>
                                <input
                                  className="st-ds-foundations-input st-ds-foundations-input--inline"
                                  aria-label={`${token.label} value (${tokenMode})`}
                                  value={token.values[tokenMode] ?? ''}
                                  readOnly={tokenLocked}
                                  onChange={(event) => updateTokenValue(entry.sectionId, token.id, tokenMode, event.target.value)}
                                />
                              </label>
                            )}
                          </div>

                          {hasTokenFooter && (
                            <div className="st-ds-foundations-card__bottom">
                              <div className="st-ds-foundations-card__notes">
                                {tokenLocked && <span className="st-ds-foundations-chip">Locked</span>}
                              </div>

                              {showTokenPreview && (
                                <div className="st-ds-foundations-card__preview">
                                  <div
                                    className={[
                                      'st-ds-foundations-preview__surface',
                                      'st-ds-foundations-preview__surface--card',
                                      token.preview === 'spacing' && 'is-spacing',
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
                              <input
                                className="st-ds-foundations-input"
                                value={value}
                                onChange={(event) => updateRuleProperty(entry.sectionId, rule.id, property, event.target.value)}
                              />
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
        </section>
      </div>
    </div>
  );
}
