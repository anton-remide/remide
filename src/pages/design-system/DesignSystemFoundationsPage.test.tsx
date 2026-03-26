import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DesignSystemFoundationsPage from './DesignSystemFoundationsPage';
import { renderWithProviders } from '../../test/helpers';
import type { FoundationRegistry } from '../../design-system/foundations';

const REGISTRY_PATH = resolve(process.cwd(), 'public/design-system/foundation.registry.json');

function loadRegistry() {
  const raw = readFileSync(REGISTRY_PATH, 'utf8');
  return JSON.parse(raw) as FoundationRegistry;
}

describe('DesignSystemFoundationsPage', () => {
  let currentRegistry: FoundationRegistry;
  let fetchMock: ReturnType<typeof vi.fn>;
  let clipboardWriteTextMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    currentRegistry = loadRegistry();
    clipboardWriteTextMock = vi.fn(async () => undefined);

    fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? 'GET';

      if (method === 'PUT') {
        const payload = JSON.parse(String(init?.body)) as { registry: FoundationRegistry };
        currentRegistry = payload.registry;
      }

      return new Response(JSON.stringify(currentRegistry), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('CSS', {
      supports: (_property: string, value: string) => value !== 'not-a-color',
    });
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: clipboardWriteTextMock,
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders colors as a tri-palette ledger', async () => {
    renderWithProviders(<DesignSystemFoundationsPage />);

    expect(await screen.findByRole('heading', { name: 'Colors' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Theme' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Basic colors' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByText('Tracker')).toBeInTheDocument();
    expect(screen.getByText('Institute')).toBeInTheDocument();
    expect(screen.getByText('Main site')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Edit Background Primary Tracker color value' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Edit Background Primary Institute color value' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Edit Background Primary Main site color value' }),
    ).toBeInTheDocument();
    expect(screen.getByText('#21201C14')).toBeInTheDocument();
  });

  it('switches colors to basic palette view and copies hex values', async () => {
    renderWithProviders(<DesignSystemFoundationsPage />);

    expect(await screen.findByRole('heading', { name: 'Colors' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Basic colors' }));

    expect(screen.getByRole('tab', { name: 'Basic colors' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Malachite')).toBeInTheDocument();
    expect(screen.getByText('Havelockblue')).toBeInTheDocument();
    expect(screen.getByText('Blazeorange')).toBeInTheDocument();
    expect(screen.getByText('Mediumpurple')).toBeInTheDocument();
    expect(screen.getByText('Ironsidegray')).toBeInTheDocument();
    expect(screen.getByText('For badges')).toBeInTheDocument();
    expect(screen.getByText('#B4A534')).toBeInTheDocument();
    expect(screen.getByText('#74746E')).toBeInTheDocument();
    expect(screen.queryByText('Tracker')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Copy Malachite 500 hex #08BA3D' }));

    await waitFor(() => {
      expect(clipboardWriteTextMock).toHaveBeenCalledWith('#08BA3D');
    });

    expect(screen.getByText('Copied')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Copy badge hex #2A64F6' }));

    await waitFor(() => {
      expect(clipboardWriteTextMock).toHaveBeenCalledWith('#2A64F6');
    });
  });

  it('renders foundations inside the shared sidebar shell', async () => {
    const { container } = renderWithProviders(<DesignSystemFoundationsPage />);

    await screen.findByRole('heading', { name: 'Colors' });

    const sidebar = screen.getByRole('complementary', { name: 'Foundations' });

    expect(container.querySelector('.st-ds-atoms-root')).toBeInTheDocument();
    expect(sidebar).toHaveClass('st-ds-sidebar');
    expect(within(sidebar).getByRole('button', { name: 'Colors' })).toBeInTheDocument();
  });

  it('moves fonts into typography nav and renders compact ledgers for spacing and radii', async () => {
    const { container } = renderWithProviders(<DesignSystemFoundationsPage />);

    await screen.findByRole('heading', { name: 'Colors' });

    const sidebar = screen.getByRole('complementary', { name: 'Foundations' });

    expect(within(sidebar).getByText('Typography')).toBeInTheDocument();
    expect(within(sidebar).getByRole('button', { name: 'Fonts' })).toBeInTheDocument();

    fireEvent.click(within(sidebar).getByRole('button', { name: 'Spacing' }));

    expect(await screen.findByRole('heading', { name: 'Spacing' })).toBeInTheDocument();
    const spacingLedger = container.querySelector('.st-ds-colors-ledger--compact');

    expect(spacingLedger).toBeInTheDocument();
    expect(screen.getByText('Base')).toBeInTheDocument();
    expect(spacingLedger?.querySelector('.st-ds-token-ledger__swatch')).not.toBeInTheDocument();

    fireEvent.click(within(sidebar).getByRole('button', { name: 'Radii' }));

    expect(await screen.findByRole('heading', { name: 'Radii' })).toBeInTheDocument();
    const radiiLedger = container.querySelector('.st-ds-colors-ledger--compact');

    expect(radiiLedger).toBeInTheDocument();
    expect(radiiLedger?.querySelector('.st-ds-token-ledger__swatch')).not.toBeInTheDocument();
  });

  it('renders fonts and typography scale in a compact fixed-width card layout', async () => {
    const { container } = renderWithProviders(<DesignSystemFoundationsPage />);

    await screen.findByRole('heading', { name: 'Colors' });

    const sidebar = screen.getByRole('complementary', { name: 'Foundations' });
    fireEvent.click(within(sidebar).getByRole('button', { name: 'Fonts' }));

    expect(await screen.findByRole('heading', { name: 'Fonts' })).toBeInTheDocument();
    expect(container.querySelector('.st-ds-foundations-panel--main.is-compact-token-stack')).toBeInTheDocument();
    expect(container.querySelector('.st-ds-foundations-list__item.is-font-role-card')).toBeInTheDocument();

    fireEvent.click(within(sidebar).getByRole('button', { name: 'Typography Scale' }));

    expect(await screen.findByRole('heading', { name: 'Typography Scale' })).toBeInTheDocument();
    expect(container.querySelector('.st-ds-foundations-panel--main.is-compact-token-stack')).toBeInTheDocument();
  });

  it('autosaves a valid color edit on blur', async () => {
    renderWithProviders(<DesignSystemFoundationsPage />);

    const trigger = await screen.findByRole('button', {
      name: 'Edit Background Primary Tracker color value',
    });

    fireEvent.click(trigger);

    const input = screen.getByLabelText('Background Primary Tracker color value');
    fireEvent.change(input, { target: { value: '#ABCDEF80' } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    const putCall = fetchMock.mock.calls[1];
    const putPayload = JSON.parse(String(putCall?.[1]?.body)) as { registry: FoundationRegistry };

    expect(putCall?.[1]?.method).toBe('PUT');
    expect(
      putPayload.registry.collections
        .find((collection) => collection.id === 'colors')
        ?.tokens.find((token) => token.id === 'color-bg')
        ?.values.tracker,
    ).toBe('#ABCDEF80');
  });

  it('autosaves on Enter and cancels on Escape', async () => {
    renderWithProviders(<DesignSystemFoundationsPage />);

    const trigger = await screen.findByRole('button', {
      name: 'Edit Background Primary Institute color value',
    });

    fireEvent.click(trigger);

    const input = screen.getByLabelText('Background Primary Institute color value');
    fireEvent.change(input, { target: { value: '#123456' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    const secondTrigger = await screen.findByRole('button', {
      name: 'Edit Background Primary Main site color value',
    });

    fireEvent.click(secondTrigger);

    const secondInput = screen.getByLabelText('Background Primary Main site color value');
    fireEvent.change(secondInput, { target: { value: '#654321' } });
    fireEvent.keyDown(secondInput, { key: 'Escape' });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: 'Edit Background Primary Main site color value' })).toBeInTheDocument();
  });

  it('shows inline error and skips save for invalid colors', async () => {
    renderWithProviders(<DesignSystemFoundationsPage />);

    const trigger = await screen.findByRole('button', {
      name: 'Edit Background Primary Tracker color value',
    });

    fireEvent.click(trigger);

    const input = screen.getByLabelText('Background Primary Tracker color value');
    fireEvent.change(input, { target: { value: 'rgba(0, 0, 0, 0.5)' } });
    fireEvent.blur(input);

    expect(await screen.findByText('Enter a HEX color as #RRGGBB or #RRGGBBAA.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
