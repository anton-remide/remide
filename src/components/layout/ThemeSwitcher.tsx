import { useTheme, THEMES, type Theme } from '../../context/ThemeProvider';

const THEME_LABELS: Record<Theme, string> = {
  main: 'Main',
  darkgray: 'Dark Gray',
  nearblack: 'Near Black',
};

interface ThemeSwitcherProps {
  ariaLabel?: string;
  className?: string;
}

export default function ThemeSwitcher({ ariaLabel = 'Theme', className }: ThemeSwitcherProps) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className={['st-theme-switcher', className].filter(Boolean).join(' ')}
      role="group"
      aria-label={ariaLabel}
    >
      {THEMES.map((entry) => (
        <button
          key={entry}
          type="button"
          onClick={() => setTheme(entry)}
          className={`st-theme-switcher__btn${theme === entry ? ' is-active' : ''}`}
          aria-label={`Switch to ${THEME_LABELS[entry]} theme`}
          aria-pressed={theme === entry}
        >
          {THEME_LABELS[entry]}
        </button>
      ))}
    </div>
  );
}
