import { Link, useParams } from 'react-router-dom';
import { getComponentById, CATEGORY_LABELS } from './component-registry';
import { AtomsSidebar } from './DesignSystemAtomsIndex';
import Badge from '../../components/ui/Badge';

export default function DesignSystemAtomPage() {
  const { componentId } = useParams<{ componentId: string }>();
  const meta = componentId ? getComponentById(componentId) : undefined;

  if (!meta) {
    return (
      <div className="st-ds-atoms-root">
        <AtomsSidebar />
        <div className="st-ds-content">
          <div className="st-ds-not-found">
            <h1 className="st-ds-not-found__title">Component not found</h1>
            <p className="st-ds-not-found__desc">
              No component with id &quot;{componentId}&quot; in the registry.
            </p>
            <Link to="/ui/atoms" className="st-ds-not-found__link">
              Back to component catalog
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="st-ds-atoms-root">
      <AtomsSidebar currentId={meta.id} />
      <div className="st-ds-content">
        <div className="st-ds-atom-page">
          <header className="st-ds-atom-page__header">
            <h1 className="st-ds-atom-page__title">{meta.name}</h1>
            <p className="st-ds-atom-page__desc">{meta.description}</p>
            <div className="st-ds-atom-page__badges">
              <Badge variant="neutral">{CATEGORY_LABELS[meta.category]}</Badge>
              <Badge variant={meta.status === 'deprecated' ? 'danger' : meta.status === 'new' ? 'info' : 'neutral'}>
                {meta.status}
              </Badge>
            </div>
          </header>
          <section className="st-ds-atom-page__section">
            <h2 className="st-ds-atom-page__section-title">Demo</h2>
            <p className="st-ds-atom-page__placeholder">
              Live demo and props table will be added here. For full demos see the legacy page.
            </p>
          </section>
          {meta.cssClasses.length > 0 && (
            <section className="st-ds-atom-page__section">
              <h2 className="st-ds-atom-page__section-title">CSS classes</h2>
              <ul className="st-ds-atom-page__class-list">
                {meta.cssClasses.map((cls) => (
                  <li key={cls}>
                    <code>.{cls}</code>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
