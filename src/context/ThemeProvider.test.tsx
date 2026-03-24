import { useEffect } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ThemeProvider, useTheme } from './ThemeProvider';

function ThemeProbe() {
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    document.body.dataset.theme = theme;
  }, [theme]);

  return (
    <div>
      <span>{theme}</span>
      <button type="button" onClick={() => setTheme('darkgray')}>
        Dark Gray
      </button>
    </div>
  );
}

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
  delete document.body.dataset.theme;
});

describe('ThemeProvider', () => {
  it('migrates the legacy beige theme to main root defaults', async () => {
    localStorage.setItem('remide-theme', 'beige');

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByText('main')).toBeInTheDocument();

    await waitFor(() => {
      expect(document.documentElement).not.toHaveAttribute('data-theme');
      expect(localStorage.getItem('remide-theme')).toBe('main');
    });
  });

  it('applies override themes through the data-theme attribute', async () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Dark Gray' }));

    await waitFor(() => {
      expect(screen.getByText('darkgray')).toBeInTheDocument();
      expect(document.documentElement).toHaveAttribute('data-theme', 'darkgray');
      expect(localStorage.getItem('remide-theme')).toBe('darkgray');
    });
  });
});
