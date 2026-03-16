import type { ReactNode } from 'react';

export interface SidebarNavSection {
  title: string;
  items: { label: string; to: string; badge?: ReactNode }[];
}

export interface SidebarNavProps {
  sections: SidebarNavSection[];
  currentPath?: string;
  className?: string;
}

export default function SidebarNav({ sections, currentPath, className }: SidebarNavProps) {
  return (
    <nav className={['st-sidebar-nav', className].filter(Boolean).join(' ')} aria-label="Sidebar">
      {sections.map((section, i) => (
        <div key={i} className="st-sidebar-nav__section">
          <h3 className="st-sidebar-nav__title">{section.title}</h3>
          <ul className="st-sidebar-nav__list">
            {section.items.map(item => (
              <li key={item.to}>
                <a
                  href={item.to}
                  className={['st-sidebar-nav__link', currentPath === item.to && 'is-active'].filter(Boolean).join(' ')}
                  aria-current={currentPath === item.to ? 'page' : undefined}
                >
                  {item.label}
                  {item.badge && <span className="st-sidebar-nav__badge">{item.badge}</span>}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
