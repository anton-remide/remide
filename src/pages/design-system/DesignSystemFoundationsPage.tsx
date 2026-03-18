import { useEffect, useState } from 'react';

function useTokenValues(tokenNames: readonly string[]) {
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    const style = getComputedStyle(document.documentElement);
    const next: Record<string, string> = {};
    tokenNames.forEach((name) => {
      const value = style.getPropertyValue(name).trim();
      next[name] = value || '—';
    });
    setValues(next);
  }, [tokenNames.join(',')]);
  return values;
}

type ColorToken = { name: string; label: string };

const COLOR_GROUPS: { groupLabel: string; tokens: readonly ColorToken[] }[] = [
  {
    groupLabel: 'Background & Surface',
    tokens: [
      { name: '--color-bg', label: 'Background' },
      { name: '--color-surface', label: 'Surface' },
    ],
  },
  {
    groupLabel: 'Text',
    tokens: [
      { name: '--color-text-main', label: 'Text main' },
      { name: '--color-text-secondary', label: 'Text secondary' },
    ],
  },
  {
    groupLabel: 'Border',
    tokens: [{ name: '--color-border', label: 'Border' }],
  },
  {
    groupLabel: 'Brand / Accent',
    tokens: [{ name: '--color-accent', label: 'Accent' }],
  },
  {
    groupLabel: 'Semantic (Status)',
    tokens: [
      { name: '--color-success', label: 'Success' },
      { name: '--color-warning', label: 'Warning' },
      { name: '--color-danger', label: 'Danger' },
      { name: '--color-info', label: 'Info' },
    ],
  },
];

const allColorTokenNames = COLOR_GROUPS.flatMap((g) => g.tokens.map((t) => t.name));

/** Fixed px for type preview on Foundations (avoids clamp so layout is stable). Matches :root max/canonical values. */
const TYPE_FIXED_PX: Record<string, string> = {
  '--type-display': '56px',
  '--type-heading-1': '36px',
  '--type-heading-2': '22px',
  '--type-heading-3': '18px',
  '--type-body-lg': '16px',
  '--type-body': '14px',
  '--type-body-sm': '13px',
  '--type-caption': '12px',
  '--type-micro': '11px',
  '--type-nano': '10px',
};

export default function DesignSystemFoundationsPage() {
  const typeTokens = [
    { name: '--type-display', label: 'Display' },
    { name: '--type-heading-1', label: 'Heading 1' },
    { name: '--type-heading-2', label: 'Heading 2' },
    { name: '--type-heading-3', label: 'Heading 3' },
    { name: '--type-body-lg', label: 'Body large' },
    { name: '--type-body', label: 'Body' },
    { name: '--type-body-sm', label: 'Body small' },
    { name: '--type-caption', label: 'Caption' },
    { name: '--type-micro', label: 'Micro' },
    { name: '--type-nano', label: 'Nano' },
  ] as const;

  const spaceTokens = [
    '--space-0',
    '--space-0-5',
    '--space-1',
    '--space-2',
    '--space-3',
    '--space-4',
    '--space-6',
    '--space-8',
    '--space-12',
    '--space-16',
    '--space-24',
  ] as const;

  const radiusTokens = [
    { name: '--radius-sm', label: 'sm' },
    { name: '--radius-md', label: 'md' },
    { name: '--radius-lg', label: 'lg' },
    { name: '--radius-pill', label: 'pill' },
  ] as const;

  const shadowTokens = [
    { name: '--shadow-sm', label: 'Small' },
    { name: '--shadow-md', label: 'Medium' },
    { name: '--shadow-lg', label: 'Large' },
  ] as const;

  const allTokenNames = [
    ...allColorTokenNames,
    ...typeTokens.map((t) => t.name),
    ...spaceTokens,
    ...radiusTokens.map((t) => t.name),
    ...shadowTokens.map((t) => t.name),
  ] as const;
  const tokenValues = useTokenValues(allTokenNames);

  return (
    <div className="st-ds-content st-ds-foundations">
      <h1 className="st-ds-foundations__title">Foundations</h1>
      <p className="st-ds-foundations__desc">
        Base design tokens from <code>app.css</code> <code>:root</code>.
      </p>

      <section className="st-ds-foundations-section" id="colors">
        <h2 className="st-ds-foundations-section__title">Colors</h2>
        {COLOR_GROUPS.map(({ groupLabel, tokens }) => (
          <div key={groupLabel} className="st-ds-foundations-color-group">
            <h3 className="st-ds-foundations-color-group__title">{groupLabel}</h3>
            <div className="st-ds-foundations-swatches">
              {tokens.map(({ name, label }) => (
                <div key={name} className="st-ds-foundations-swatch">
                  <div
                    className="st-ds-foundations-swatch__block"
                    style={
                      name.startsWith('--color-text')
                        ? { background: 'var(--color-bg)', color: `var(${name})` }
                        : name === '--color-border'
                          ? { background: 'var(--color-bg)', border: '2px solid var(--color-border)' }
                          : { background: `var(${name})` }
                    }
                  >
                    {name.startsWith('--color-text') && <span aria-hidden>Aa</span>}
                  </div>
                  <code className="st-ds-foundations-swatch__name">{name}</code>
                  <span className="st-ds-foundations-swatch__value">{tokenValues[name] ?? '—'}</span>
                  <span className="st-ds-foundations-swatch__label">{label}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="st-ds-foundations-section" id="typography">
        <h2 className="st-ds-foundations-section__title">Typography</h2>
        <p className="st-ds-foundations-section__meta">
          Fonts: <code>--font1</code> (DM Sans), <code>--font2</code> (Doto).
        </p>
        <div className="st-ds-foundations-type-scale">
          {typeTokens.map(({ name, label }) => (
            <div key={name} className="st-ds-foundations-type-row">
              <span className="st-ds-foundations-type-row__sample" style={{ fontFamily: 'var(--font1)', fontSize: TYPE_FIXED_PX[name] ?? `var(${name})` }}>
                Aa
              </span>
              <code className="st-ds-foundations-type-row__token">{name}</code>
              <span className="st-ds-foundations-type-row__value">{tokenValues[name] ?? '—'}</span>
              <span className="st-ds-foundations-type-row__label">{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="st-ds-foundations-section" id="spacing">
        <h2 className="st-ds-foundations-section__title">Spacing (4px grid)</h2>
        <div className="st-ds-foundations-spacing">
          {spaceTokens.map((token) => (
            <div key={token} className="st-ds-foundations-spacing-row">
              <div className="st-ds-foundations-spacing-bar" style={{ width: `var(${token})`, minWidth: 2 }} />
              <code className="st-ds-foundations-spacing-row__token">{token}</code>
              <span className="st-ds-foundations-spacing-row__value">{tokenValues[token] ?? '—'}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="st-ds-foundations-section" id="radii">
        <h2 className="st-ds-foundations-section__title">Border radius</h2>
        <div className="st-ds-foundations-radii">
          {radiusTokens.map(({ name, label }) => (
            <div key={name} className="st-ds-foundations-radius-item">
              <div
                className="st-ds-foundations-radius-box"
                style={{ borderRadius: `var(${name})` }}
              />
              <code className="st-ds-foundations-radius-item__token">{name}</code>
              <span className="st-ds-foundations-radius-item__value">{tokenValues[name] ?? '—'}</span>
              <span className="st-ds-foundations-radius-item__label">{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="st-ds-foundations-section" id="shadows">
        <h2 className="st-ds-foundations-section__title">Shadows</h2>
        <div className="st-ds-foundations-shadows">
          {shadowTokens.map(({ name, label }) => (
            <div key={name} className="st-ds-foundations-shadow-item">
              <div
                className="st-ds-foundations-shadow-card"
                style={{ boxShadow: `var(${name})` }}
                aria-hidden
              />
              <code className="st-ds-foundations-shadow-item__token">{name}</code>
              <span className="st-ds-foundations-shadow-item__value">{tokenValues[name] ?? '—'}</span>
              <span className="st-ds-foundations-shadow-item__label">{label}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
