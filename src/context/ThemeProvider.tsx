import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

export type Theme = 'tracker' | 'institute' | 'main-site';

const THEMES: Theme[] = ['tracker', 'institute', 'main-site'];
const STORAGE_KEY = 'remide-theme';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  cycleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function normalizeTheme(value: string | null): Theme {
  if (value === 'beige' || value === 'main' || value === 'tracker') {
    return 'tracker';
  }

  if (value === 'darkgray' || value === 'institute') {
    return 'institute';
  }

  if (value === 'nearblack' || value === 'main-site') {
    return 'main-site';
  }

  return 'tracker';
}

function applyTheme(t: Theme) {
  if (t === 'tracker') {
    document.documentElement.removeAttribute('data-theme');
    return;
  }

  document.documentElement.setAttribute('data-theme', t);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    return normalizeTheme(localStorage.getItem(STORAGE_KEY));
  });

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);

  const cycleTheme = useCallback(() => {
    setThemeState(prev => {
      const idx = THEMES.indexOf(prev);
      return THEMES[(idx + 1) % THEMES.length];
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, cycleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

export { THEMES };
