import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
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

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function cloneRegistry(registry: FoundationRegistry) {
  return JSON.parse(JSON.stringify(registry)) as FoundationRegistry;
}

function isTokenSection(section: FoundationSection): section is FoundationTokenCollection {
  return section.kind === 'token';
}

function getSectionItems(section: FoundationSection) {
  return isTokenSection(section) ? section.tokens : section.items;
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
    textTransform: item.properties.transform as CSSProperties['textTransform'],
    color: 'var(--color-text-main)',
  };
}

function valueSummary(section: FoundationSection, itemId: string, mode?: string) {
  if (isTokenSection(section)) {
    const token = section.tokens.find((entry) => entry.id === itemId);
    return token && mode ? token.values[mode] : '';
  }

  const item = section.items.find((entry) => entry.id === itemId);
  return item ? Object.entries(item.properties).slice(0, 2).map(([key, value]) => `${key}: ${value}`).join(' · ') : '';
}

export default function DesignSystemFoundationsPage() {
  const [savedRegistry, setSavedRegistry] = useState<FoundationRegistry | null>(null);
  const [draftRegistry, setDraftRegistry] = useState<FoundationRegistry | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<Record<string, string>>({});
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

  useEffect(() => {
    if (sections.length === 0) {
      return;
    }

    if (!selectedSectionId || !sections.some((section) => section.id === selectedSectionId)) {
      setSelectedSectionId(sections[0].id);
    }
  }, [sections, selectedSectionId]);

  const activeSection = useMemo(
    () => sections.find((section) => section.id === selectedSectionId) ?? sections[0] ?? null,
    [sections, selectedSectionId],
  );

  useEffect(() => {
    if (!activeSection) {
      return;
    }

    setSelectedItemIds((current) => {
      const items = getSectionItems(activeSection);
      const currentId = current[activeSection.id];

      if (currentId && items.some((item) => item.id === currentId)) {
        return current;
      }

      return {
        ...current,
        [activeSection.id]: items[0]?.id ?? '',
      };
    });

    if (isTokenSection(activeSection) && activeSection.modes.length > 0) {
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
    }
  }, [activeSection]);

  const activeMode = activeSection && isTokenSection(activeSection)
    ? selectedModes[activeSection.id] ?? activeSection.modes[0]
    : undefined;

  const selectedItem = useMemo(() => {
    if (!activeSection) {
      return null;
    }

    const selectedId = selectedItemIds[activeSection.id];
    return getSectionItems(activeSection).find((item) => item.id === selectedId) ?? getSectionItems(activeSection)[0] ?? null;
  }, [activeSection, selectedItemIds]);

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

  function updateTokenField(collectionId: string, tokenId: string, field: 'label' | 'description' | 'usage' | 'group', value: string) {
    updateDraft((next) => {
      const collection = next.collections.find((entry) => entry.id === collectionId);
      const token = collection?.tokens.find((entry) => entry.id === tokenId);
      if (!token) {
        return;
      }

      if (field === 'usage') {
        token.usage = value;
        return;
      }

      token[field] = value;
    });
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

  function updateRuleField(collectionId: string, itemId: string, field: 'label' | 'description' | 'previewText', value: string) {
    updateDraft((next) => {
      const collection = next.rules.find((entry) => entry.id === collectionId);
      const item = collection?.items.find((entry) => entry.id === itemId);
      if (!item) {
        return;
      }

      if (field === 'previewText') {
        item.previewText = value;
        return;
      }

      item[field] = value;
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

  if (loadError || !savedRegistry || !draftRegistry || !activeSection || !selectedItem) {
    return (
      <div className="st-ds-content st-ds-foundations">
        <Heading display level={1}>Foundations</Heading>
        <div className="st-ds-foundations-alert st-ds-foundations-alert--error">
          {loadError || 'Foundations registry is unavailable.'}
        </div>
      </div>
    );
  }

  const groupedItems = activeSection.groups.map((group) => ({
    ...group,
    items: getSectionItems(activeSection).filter((item) => item.group === group.id),
  })).filter((group) => group.items.length > 0);

  const selectedToken = isTokenSection(activeSection) ? selectedItem as FoundationToken : null;
  const selectedRule = isTokenSection(activeSection) ? null : selectedItem as FoundationRuleItem;
  const selectedTokenLocked = selectedToken?.editable === false;
  const selectedItemDirty = dirtyItemKeys.has(getFoundationItemKey(activeSection.id, selectedItem.id));

  return (
    <div className="st-ds-content st-ds-foundations">
      <div className="st-ds-foundations-hero">
        <div>
          <Heading display level={1}>Foundations</Heading>
          <Text size="lg" color="secondary" className="st-ds-foundations-hero__copy">
            Canonical foundation editor for tokens and rules. Draft changes stay local to this page until you press Save.
          </Text>
        </div>
        <div className="st-ds-foundations-hero__meta">
          <span className="st-ds-foundations-chip">Source: <code>public/design-system/foundation.registry.json</code></span>
          <span className="st-ds-foundations-chip">Last saved: {formatTimestamp(savedRegistry.meta.updatedAt)}</span>
          <span className={['st-ds-foundations-chip', dirty && 'is-dirty'].filter(Boolean).join(' ')}>
            {dirty ? 'Draft changed' : 'Saved state'}
          </span>
        </div>
      </div>

      <div className="st-ds-foundations-toolbar">
        <div className="st-ds-foundations-toolbar__summary">
          <Text size="sm" color="secondary">
            Select any token or rule and edit it directly. Save appears only after the draft changes.
          </Text>
        </div>

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
      </div>

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
          <div className="st-ds-foundations-panel__header">
            <Text size="caption" color="secondary">Collections</Text>
          </div>
          <div className="st-ds-foundations-nav">
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setSelectedSectionId(section.id)}
                className={['st-ds-foundations-nav__item', activeSection.id === section.id && 'is-active'].filter(Boolean).join(' ')}
              >
                <span className="st-ds-foundations-nav__title">
                  {section.label}
                  {dirtySectionIds.has(section.id) && <span className="st-ds-foundations-nav__badge">Edited</span>}
                </span>
                <span className="st-ds-foundations-nav__meta">{section.kind === 'token' ? 'Variables' : 'Rules'}</span>
                {section.description && (
                  <span className="st-ds-foundations-nav__desc">{section.description}</span>
                )}
              </button>
            ))}
          </div>
        </aside>

        <section className="st-ds-foundations-panel st-ds-foundations-panel--main">
          <div className="st-ds-foundations-panel__header st-ds-foundations-panel__header--stack">
            <div className="st-ds-foundations-panel__header-copy">
              <Heading level={2}>{activeSection.label}</Heading>
              {activeSection.description && (
                <Text size="sm" color="secondary">{activeSection.description}</Text>
              )}
            </div>

            {isTokenSection(activeSection) && (
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
                <div className="st-ds-foundations-list">
                  {group.items.map((item) => {
                    const isSelected = selectedItemIds[activeSection.id] === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={[
                          'st-ds-foundations-list__item',
                          isSelected && 'is-active',
                          dirtyItemKeys.has(getFoundationItemKey(activeSection.id, item.id)) && 'is-dirty',
                        ].filter(Boolean).join(' ')}
                        onClick={() => setSelectedItemIds((current) => ({ ...current, [activeSection.id]: item.id }))}
                      >
                        <span className="st-ds-foundations-list__row">
                          <span className="st-ds-foundations-list__label">{item.label}</span>
                          {dirtyItemKeys.has(getFoundationItemKey(activeSection.id, item.id)) && (
                            <span className="st-ds-foundations-list__badge">Edited</span>
                          )}
                        </span>
                        <code className="st-ds-foundations-list__code">
                          {isTokenSection(activeSection) ? (item as FoundationToken).name : item.id}
                        </code>
                        <span className="st-ds-foundations-list__value-label">
                          {isTokenSection(activeSection) ? 'Current value' : 'Rule summary'}
                        </span>
                        <span className="st-ds-foundations-list__value">
                          {valueSummary(activeSection, item.id, activeMode)}
                        </span>
                        <span className="st-ds-foundations-list__desc">{item.description}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="st-ds-foundations-panel st-ds-foundations-panel--inspector">
          <div className="st-ds-foundations-panel__header st-ds-foundations-panel__header--inspector">
            <div className="st-ds-foundations-panel__header-copy">
              <Text size="caption" color="secondary">Inspector</Text>
              <Heading level={3}>{selectedItem.label}</Heading>
            </div>
            <div className="st-ds-foundations-panel__header-meta">
              {selectedItemDirty && <span className="st-ds-foundations-chip is-dirty">Unsaved</span>}
              {selectedTokenLocked && <span className="st-ds-foundations-chip">Locked</span>}
            </div>
          </div>

          {selectedToken && activeMode && (
            <div className="st-ds-foundations-inspector">
              <label className="st-ds-foundations-field">
                <span className="st-ds-foundations-field__label">Token</span>
                <code className="st-ds-foundations-field__readonly">{selectedToken.name}</code>
              </label>

              <label className="st-ds-foundations-field">
                <span className="st-ds-foundations-field__label">Label</span>
                <input
                  className="st-ds-foundations-input"
                  value={selectedToken.label}
                  readOnly={selectedTokenLocked}
                  onChange={(event) => updateTokenField(activeSection.id, selectedToken.id, 'label', event.target.value)}
                />
              </label>

              <label className="st-ds-foundations-field">
                <span className="st-ds-foundations-field__label">Description</span>
                <textarea
                  className="st-ds-foundations-textarea"
                  value={selectedToken.description}
                  readOnly={selectedTokenLocked}
                  onChange={(event) => updateTokenField(activeSection.id, selectedToken.id, 'description', event.target.value)}
                />
              </label>

              <label className="st-ds-foundations-field">
                <span className="st-ds-foundations-field__label">Usage</span>
                <textarea
                  className="st-ds-foundations-textarea"
                  value={selectedToken.usage ?? ''}
                  readOnly={selectedTokenLocked}
                  onChange={(event) => updateTokenField(activeSection.id, selectedToken.id, 'usage', event.target.value)}
                />
              </label>

              <label className="st-ds-foundations-field">
                <span className="st-ds-foundations-field__label">Value ({activeMode})</span>
                <input
                  className="st-ds-foundations-input"
                  value={selectedToken.values[activeMode] ?? ''}
                  readOnly={selectedTokenLocked}
                  onChange={(event) => updateTokenValue(activeSection.id, selectedToken.id, activeMode, event.target.value)}
                />
              </label>

              {selectedTokenLocked && (
                <Text size="sm" color="secondary">
                  This alias token is read-only and mirrors another canonical role.
                </Text>
              )}

              <div className="st-ds-foundations-preview">
                <div className="st-ds-foundations-preview__label">Preview</div>
                <div
                  className={[
                    'st-ds-foundations-preview__surface',
                    selectedToken.preview === 'spacing' && 'is-spacing',
                    selectedToken.preview === 'font' && 'is-font',
                  ].filter(Boolean).join(' ')}
                  style={tokenPreviewStyle(selectedToken, activeMode)}
                >
                  {selectedToken.preview === 'color' && selectedToken.label}
                  {selectedToken.preview === 'font' && 'Sphinx of black quartz, judge my vow.'}
                  {selectedToken.preview === 'text' && 'Type Sample'}
                  {selectedToken.preview === 'generic' && (selectedToken.values[activeMode] ?? 'Value')}
                </div>
              </div>
            </div>
          )}

          {selectedRule && (
            <div className="st-ds-foundations-inspector">
              <label className="st-ds-foundations-field">
                <span className="st-ds-foundations-field__label">Rule id</span>
                <code className="st-ds-foundations-field__readonly">{selectedRule.id}</code>
              </label>

              <label className="st-ds-foundations-field">
                <span className="st-ds-foundations-field__label">Label</span>
                <input
                  className="st-ds-foundations-input"
                  value={selectedRule.label}
                  onChange={(event) => updateRuleField(activeSection.id, selectedRule.id, 'label', event.target.value)}
                />
              </label>

              <label className="st-ds-foundations-field">
                <span className="st-ds-foundations-field__label">Description</span>
                <textarea
                  className="st-ds-foundations-textarea"
                  value={selectedRule.description}
                  onChange={(event) => updateRuleField(activeSection.id, selectedRule.id, 'description', event.target.value)}
                />
              </label>

              <label className="st-ds-foundations-field">
                <span className="st-ds-foundations-field__label">Preview text</span>
                <textarea
                  className="st-ds-foundations-textarea"
                  value={selectedRule.previewText ?? ''}
                  onChange={(event) => updateRuleField(activeSection.id, selectedRule.id, 'previewText', event.target.value)}
                />
              </label>

              <div className="st-ds-foundations-rule-grid">
                {Object.entries(selectedRule.properties).map(([property, value]) => (
                  <label key={property} className="st-ds-foundations-field">
                    <span className="st-ds-foundations-field__label">{property}</span>
                    <input
                      className="st-ds-foundations-input"
                      value={value}
                      onChange={(event) => updateRuleProperty(activeSection.id, selectedRule.id, property, event.target.value)}
                    />
                  </label>
                ))}
              </div>

              <div className="st-ds-foundations-preview">
                <div className="st-ds-foundations-preview__label">Preview</div>
                <div className="st-ds-foundations-preview__surface is-rule">
                  <span style={rulePreviewStyle(selectedRule)}>
                    {selectedRule.previewText || selectedRule.label}
                  </span>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
