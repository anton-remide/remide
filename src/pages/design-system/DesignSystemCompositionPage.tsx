import Heading from '../../components/ui/Heading';
import Text from '../../components/ui/Text';

export default function DesignSystemCompositionPage() {
  return (
    <div className="st-ds-content" style={{ padding: 'var(--space-8) var(--space-12)' }}>
      <Heading level={1} style={{ marginBottom: 16 }}>
        Composition Patterns
      </Heading>
      <Text size="lg" color="secondary" style={{ maxWidth: 600 }}>
        Grid system, section rhythm, component insets, stacking patterns, responsive behavior, and z-index scale. (Plan 03 — coming next.)
      </Text>
    </div>
  );
}
