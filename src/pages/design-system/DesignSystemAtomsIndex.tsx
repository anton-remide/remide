import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  COMPONENT_REGISTRY,
  CATEGORY_ORDER,
  CATEGORY_LABELS,
  type ComponentMeta,
  type ComponentCategory,
} from './component-registry';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Heading from '../../components/ui/Heading';
import Text from '../../components/ui/Text';
import Input from '../../components/ui/Input';

function MiniPreview({ componentId }: { componentId: string }) {
  switch (componentId) {
    case 'badge':
      return <Badge variant="success">Active</Badge>;
    case 'button':
      return <Button variant="primary">Button</Button>;
    case 'heading':
      return <Heading level="h3">Heading</Heading>;
    case 'text':
      return <Text size="sm">Text</Text>;
    case 'input':
      return <Input placeholder="Input" disabled />;
    default:
      return (
        <div
          className="st-ds-card-preview-placeholder"
          style={{
            width: 56,
            height: 32,
            background: 'var(--color-surface-raised)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
          }}
        />
      );
  }
}

export function AtomsSidebar({ currentId }: { currentId?: string }) {
  const byCategory = useMemo(() => {
    const map = new Map<ComponentCategory, ComponentMeta[]>();
    for (const cat of CATEGORY_ORDER) {
      map.set(cat, COMPONENT_REGISTRY.filter((c) => c.category === cat));
    }
    return map;
  }, []);

  return (
    <nav className="st-ds-sidebar" aria-label="Components">
      {CATEGORY_ORDER.map((cat) => {
        const items = byCategory.get(cat) ?? [];
        if (items.length === 0) return null;
        return (
          <div key={cat} className="st-ds-sidebar__group">
            <div className="st-ds-sidebar__group-title">{CATEGORY_LABELS[cat]}</div>
            <ul className="st-ds-sidebar__list">
              {items.map((c) => (
                <li key={c.id}>
                  <Link
                    to={`/ui/atoms/${c.id}`}
                    className={['st-ds-sidebar__link', currentId === c.id && 'is-active'].filter(Boolean).join(' ')}
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

const STATUS_LABELS: Record<ComponentMeta['status'], string> = {
  stable: 'Stable',
  new: 'New',
  experimental: 'Experimental',
  deprecated: 'Deprecated',
};

export default function DesignSystemAtomsIndex() {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return COMPONENT_REGISTRY;
    return COMPONENT_REGISTRY.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q)
    );
  }, [search]);

  return (
    <>
      <AtomsSidebar currentId={undefined} />
      <div className="st-ds-content">
        <div className="st-ds-content__toolbar">
          <input
            type="search"
            placeholder="Search components…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="st-ds-search"
            aria-label="Search components"
          />
        </div>
        <div className="st-ds-card-grid">
          {filtered.map((c) => (
            <Link
              key={c.id}
              to={`/ui/atoms/${c.id}`}
              className="st-ds-card"
            >
              <div className="st-ds-card__preview">
                <MiniPreview componentId={c.id} />
              </div>
              <div className="st-ds-card__body">
                <div className="st-ds-card__title">{c.name}</div>
                <p className="st-ds-card__desc">{c.description}</p>
                <div className="st-ds-card__badges">
                  <span className="st-ds-card__cat">{CATEGORY_LABELS[c.category]}</span>
                  <Badge variant={c.status === 'deprecated' ? 'danger' : c.status === 'new' ? 'info' : 'neutral'}>
                    {STATUS_LABELS[c.status]}
                  </Badge>
                </div>
              </div>
            </Link>
          ))}
        </div>
        {filtered.length === 0 && (
          <p className="st-ds-empty">No components match &quot;{search}&quot;</p>
        )}
      </div>
    </>
  );
}
