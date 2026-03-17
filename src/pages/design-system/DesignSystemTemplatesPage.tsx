export default function DesignSystemTemplatesPage() {
  return (
    <div className="st-ds-content" style={{ padding: 'var(--space-8) var(--space-12)' }}>
      <h1
        style={{
          fontFamily: 'var(--font2)',
          fontSize: 'var(--type-heading-1)',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '-0.03em',
          marginBottom: 16,
        }}
      >
        Page Templates
      </h1>
      <p
        style={{
          fontSize: 'var(--type-body-lg)',
          color: 'var(--color-text-secondary)',
          maxWidth: 600,
        }}
      >
        Report, Dashboard, Landing, Detail/Entity, and Auth/Form recipes. (Plan 03 — coming next.)
      </p>
    </div>
  );
}
