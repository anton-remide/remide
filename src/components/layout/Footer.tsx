import { Link, useLocation } from 'react-router-dom';
import { useTheme, THEMES, type Theme } from '../../context/ThemeProvider';

const THEME_ICON: Record<Theme, string> = {
  beige: '☀️',
  darkgray: '🌗',
  nearblack: '🌑',
};

const THEME_LABEL: Record<Theme, string> = {
  beige: 'Light',
  darkgray: 'Dark',
  nearblack: 'Black',
};

export default function Footer() {
  const { theme, setTheme } = useTheme();
  const { pathname } = useLocation();
  const isDesignSystem = pathname.startsWith('/ui');

  if (isDesignSystem) {
    return <footer className="st-footer" />;
  }

  return (
    <footer className="st-footer">
      <div className="st-footer-inner">
        <div className="st-footer-left">
          <div className="st-footer-copyright">&copy; 2026 RemiDe. All rights reserved.</div>
        </div>

        <div className="st-theme-switcher">
          {THEMES.map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`st-theme-switcher__btn${theme === t ? ' is-active' : ''}`}
              aria-label={`Switch to ${THEME_LABEL[t]} theme`}
              aria-pressed={theme === t}
            >
              <span className="st-theme-switcher__icon">{THEME_ICON[t]}</span>
              <span className="st-theme-switcher__label">{THEME_LABEL[t]}</span>
            </button>
          ))}
        </div>

        <div className="st-footer-links">
          <Link to="/jurisdictions">Jurisdictions</Link>
          <Link to="/entities">Entities</Link>
        </div>
      </div>
    </footer>
  );
}
