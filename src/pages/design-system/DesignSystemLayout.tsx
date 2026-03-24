import { Outlet, NavLink } from 'react-router-dom';
import ThemeSwitcher from '../../components/layout/ThemeSwitcher';

const TAB_LINKS = [
  { to: '/ui/foundations', label: 'Foundations' },
  { to: '/ui/atoms', label: 'Components' },
  { to: '/ui/composition', label: 'Composition' },
  { to: '/ui/templates', label: 'Templates' },
];

export default function DesignSystemLayout() {
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
        <div className="st-ds-header__actions">
          <ThemeSwitcher className="st-ds-header__theme-switcher" ariaLabel="Design system theme" />
        </div>
      </header>

      <div className="st-ds-main">
        <Outlet />
      </div>
    </div>
  );
}
