import Heading from '../../components/ui/Heading';
import Text from '../../components/ui/Text';

export default function DesignSystemTemplatesPage() {
  return (
    <div className="st-ds-content" style={{ padding: 'var(--space-8) var(--space-12)' }}>
      <Heading level={1} style={{ marginBottom: 16 }}>
        Page Templates
      </Heading>
      <Text size="lg" color="secondary" style={{ maxWidth: 600 }}>
        Report, Dashboard, Landing, Detail/Entity, and Auth/Form recipes. (Plan 03 — coming next.)
      </Text>
    </div>
  );
}
