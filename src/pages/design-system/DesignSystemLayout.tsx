import { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useTheme, THEMES } from '../../context/ThemeProvider';
import type { Theme } from '../../context/ThemeProvider';

const THEME_LABELS: Record<Theme, string> = {
  beige: 'Beige',
  darkgray: 'Dark Gray',
  nearblack: 'Near Black',
};

const TAB_LINKS = [
  { to: '/ui/foundations', label: 'Foundations' },
  { to: '/ui/atoms', label: 'Components' },
  { to: '/ui/composition', label: 'Composition' },
  { to: '/ui/templates', label: 'Templates' },
];

export default function DesignSystemLayout() {
  const { theme, setTheme } = useTheme();
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop');

  return (
    <div
      className="st-ds-layout"
      style={{
        background: 'var(--color-bg)',
        color: 'var(--color-text-main)',
        transition: 'background 300ms, color 300ms',
      }}
    >
      <header className="st-ds-header">
        <span className="st-ds-header__brand">RemiDe UI</span>
        <nav className="st-ds-header__tabs">
          {TAB_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                ['st-ds-header__tab', isActive && 'is-active'].filter(Boolean).join(' ')
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <div className="st-ds-main">
        <Outlet context={{ viewport }} />
      </div>

      <footer className="st-ds-footer">
        <div className="st-ds-footer__group">
          <span className="st-ds-footer__label">Theme</span>
          {THEMES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTheme(t)}
              className={['st-ds-footer__btn', theme === t && 'is-active'].filter(Boolean).join(' ')}
            >
              {THEME_LABELS[t]}
            </button>
          ))}
        </div>
        <div className="st-ds-footer__group">
          <span className="st-ds-footer__label">Viewport</span>
          {(['desktop', 'mobile'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setViewport(v)}
              className={['st-ds-footer__btn', viewport === v && 'is-active'].filter(Boolean).join(' ')}
              disabled={v === 'mobile'}
            >
              {v}
            </button>
          ))}
        </div>
      </footer>
    </div>
  );
}
