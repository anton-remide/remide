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
      <button type="button" onClick={() => setTheme('institute')}>
        Institute
      </button>
    </div>
  );
}

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
  delete document.body.dataset.theme;
});

describe('ThemeProvider', () => {
  it('migrates legacy theme ids to tracker root defaults', async () => {
    localStorage.setItem('remide-theme', 'beige');

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByText('tracker')).toBeInTheDocument();

    await waitFor(() => {
      expect(document.documentElement).not.toHaveAttribute('data-theme');
      expect(localStorage.getItem('remide-theme')).toBe('tracker');
    });
  });

  it('applies override themes through the data-theme attribute', async () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Institute' }));

    await waitFor(() => {
      expect(screen.getByText('institute')).toBeInTheDocument();
      expect(document.documentElement).toHaveAttribute('data-theme', 'institute');
      expect(localStorage.getItem('remide-theme')).toBe('institute');
    });
  });

  it('migrates nearblack to main-site', async () => {
    localStorage.setItem('remide-theme', 'nearblack');

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('main-site')).toBeInTheDocument();
      expect(document.documentElement).toHaveAttribute('data-theme', 'main-site');
      expect(localStorage.getItem('remide-theme')).toBe('main-site');
    });
  });
});
