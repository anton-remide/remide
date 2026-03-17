export default function DesignSystemCompositionPage() {
  return (
    <div className="st-ds-content" style={{ padding: 'var(--space-8) var(--space-12)' }}>
      <h1
        className="st-heading"
        style={{
          fontFamily: 'var(--font2)',
          fontSize: 'var(--type-heading-1)',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '-0.03em',
          marginBottom: 16,
        }}
      >
        Composition Patterns
      </h1>
      <p
        style={{
          fontSize: 'var(--type-body-lg)',
          color: 'var(--color-text-secondary)',
          maxWidth: 600,
        }}
      >
        Grid system, section rhythm, component insets, stacking patterns, responsive behavior, and z-index scale. (Plan 03 — coming next.)
      </p>
    </div>
  );
}
