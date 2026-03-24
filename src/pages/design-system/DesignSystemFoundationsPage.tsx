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
  validateFoundationRegistry,
} from '../../design-system/foundations';

const FOUNDATION_ENDPOINT = '/__internal/foundations';
const FOUNDATION_PUBLIC_URL = `${import.meta.env.BASE_URL}design-system/foundation.registry.json`;
const FOUNDATION_RUNTIME_STYLE_ID = 'st-foundations-runtime-style';
const FONTS_SECTION_ID = 'fonts';
const TYPOGRAPHY_RULES_SECTION_ID = 'typography-rules';
const HIDDEN_SECTION_IDS = new Set([FONTS_SECTION_ID]);
const TYPOGRAPHY_SECTION_IDS = new Set(['typography-scale', TYPOGRAPHY_RULES_SECTION_ID]);

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type DisplayFoundationItem =
  | { kind: 'token'; sectionId: string; item: FoundationToken; mode: string }
  | { kind: 'rule'; sectionId: string; item: FoundationRuleItem };

interface DisplayFoundationGroup {
  id: string;
  label: string;
  layout: 'token' | 'rule';
  items: DisplayFoundationItem[];
}

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

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
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

export default function DesignSystemFoundationsPage() {
  const [savedRegistry, setSavedRegistry] = useState<FoundationRegistry | null>(null);
  const [draftRegistry, setDraftRegistry] = useState<FoundationRegistry | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
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
  const visibleSections = useMemo(
    () => sections.filter((section) => !HIDDEN_SECTION_IDS.has(section.id)),
    [sections],
  );
  const fontsSection = useMemo(
    () => activeRegistry?.collections.find((entry) => entry.id === FONTS_SECTION_ID) ?? null,
    [activeRegistry],
  );
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

  const validationIssues = useMemo(
    () => (draftRegistry ? validateFoundationRegistry(draftRegistry) : []),
    [draftRegistry],
  );

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
  const dirtyItemCount = dirtyEntries.itemKeys.length;

  const groupedItems = useMemo<DisplayFoundationGroup[]>(() => {
    if (!activeSection) {
      return [];
    }

    if (activeSection.id === TYPOGRAPHY_RULES_SECTION_ID && !isTokenSection(activeSection) && fontsSection) {
      const fontMode = fontsSection.modes[0] ?? 'base';
      const fontGroups = fontsSection.groups.map((group) => ({
        id: `${fontsSection.id}-${group.id}`,
        label: group.label,
        layout: 'token' as const,
        items: fontsSection.tokens
          .filter((item) => item.group === group.id)
          .map((item) => ({ kind: 'token' as const, sectionId: fontsSection.id, item, mode: fontMode })),
      }));

      const ruleGroups = activeSection.groups.map((group) => ({
        id: `${activeSection.id}-${group.id}`,
        label: group.label,
        layout: 'rule' as const,
        items: activeSection.items
          .filter((item) => item.group === group.id)
          .map((item) => ({ kind: 'rule' as const, sectionId: activeSection.id, item })),
      }));

      return [...fontGroups, ...ruleGroups].filter((group) => group.items.length > 0);
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
  }, [activeMode, activeSection, fontsSection]);

  function isSectionDirty(sectionId: string) {
    if (sectionId === TYPOGRAPHY_RULES_SECTION_ID) {
      return dirtySectionIds.has(sectionId) || dirtySectionIds.has(FONTS_SECTION_ID);
    }

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
    setSaveState('idle');
    setSaveMessage(null);
  }

  function updateTokenValue(collectionId: string, tokenId: string, tokenMode: string, value: string) {
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
    updateDraft((next) => {
      const collection = next.rules.find((entry) => entry.id === collectionId);
      const item = collection?.items.find((entry) => entry.id === itemId);
      if (!item) {
        return;
      }

      item.properties[property] = value;
    });
  }

  async function handleSave() {
    if (!draftRegistry) {
      return;
    }

    if (validationIssues.length > 0) {
      setSaveState('error');
      setSaveMessage('Fix validation issues before saving.');
      return;
    }

    setSaveState('saving');
    setSaveMessage(null);

    try {
      const saved = await saveFoundationRegistry(draftRegistry);
      applyFoundationRegistry(saved);
      setSavedRegistry(saved);
      setDraftRegistry(cloneRegistry(saved));
      setSaveState('saved');
      setSaveMessage(`Saved locally at ${formatTimestamp(saved.meta.updatedAt)}.`);
    } catch (error) {
      setSaveState('error');
      setSaveMessage(error instanceof Error ? error.message : 'Failed to save foundations.');
    }
  }

  function handleReset() {
    if (!savedRegistry) {
      return;
    }

    setDraftRegistry(cloneRegistry(savedRegistry));
    setSaveState('idle');
    setSaveMessage('Draft reset to last saved state.');
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
      {dirty && (
        <div className="st-ds-foundations-toolbar__actions" role="group" aria-label="Unsaved foundation changes">
          <span className="st-ds-foundations-toolbar__status">
            Unsaved changes
            {dirtyItemCount > 0 ? ` · ${dirtyItemCount} ${dirtyItemCount === 1 ? 'item' : 'items'}` : ''}
          </span>
          <button
            type="button"
            className="st-ds-foundations-btn st-ds-foundations-btn--ghost"
            onClick={handleReset}
            disabled={saveState === 'saving'}
          >
            Discard
          </button>
          <button
            type="button"
            className="st-ds-foundations-btn st-ds-foundations-btn--primary"
            onClick={handleSave}
            disabled={saveState === 'saving' || validationIssues.length > 0}
          >
            {saveState === 'saving' ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}

      {saveMessage && (
        <div
          className={['st-ds-foundations-alert', saveState === 'error' && 'st-ds-foundations-alert--error'].filter(Boolean).join(' ')}
          role={saveState === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          {saveMessage}
        </div>
      )}

      {validationIssues.length > 0 && (
        <div className="st-ds-foundations-alert st-ds-foundations-alert--error">
          <strong>{validationIssues.length}</strong> validation issue(s) block Save.
          <ul className="st-ds-foundations-issues">
            {validationIssues.slice(0, 8).map((issue) => (
              <li key={`${issue.path}-${issue.message}`}>
                <code>{issue.path}</code> — {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}

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

                    if (entry.kind === 'token') {
                      const token = entry.item;
                      const tokenMode = entry.mode;
                      const tokenLocked = token.editable === false;

                      return (
                        <article
                          key={token.id}
                          className={[
                            'st-ds-foundations-list__item',
                            'is-token-card',
                            'clip-lg',
                            isDirty && 'is-dirty',
                          ].filter(Boolean).join(' ')}
                        >
                          <div className="st-ds-foundations-card__top">
                            <div className="st-ds-foundations-card__meta">
                              <div className="st-ds-foundations-list__row">
                                <span className="st-ds-foundations-list__label">{token.label}</span>
                                {isDirty && <span className="st-ds-foundations-list__badge">Edited</span>}
                              </div>
                              <code className="st-ds-foundations-list__code">{token.name}</code>
                            </div>

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
                          </div>

                          <div className="st-ds-foundations-card__bottom">
                            <div className="st-ds-foundations-card__notes">
                              {tokenLocked && <span className="st-ds-foundations-chip">Locked</span>}
                            </div>

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
                          </div>
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
