import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, screen, waitFor } from '@testing-library/react';
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

  beforeEach(() => {
    currentRegistry = loadRegistry();

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
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders colors as a tri-palette ledger', async () => {
    renderWithProviders(<DesignSystemFoundationsPage />);

    expect(await screen.findByRole('heading', { name: 'Colors' })).toBeInTheDocument();
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
  });

  it('autosaves a valid color edit on blur', async () => {
    renderWithProviders(<DesignSystemFoundationsPage />);

    const trigger = await screen.findByRole('button', {
      name: 'Edit Background Primary Tracker color value',
    });

    fireEvent.click(trigger);

    const input = screen.getByLabelText('Background Primary Tracker color value');
    fireEvent.change(input, { target: { value: '#ABCDEF' } });
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
    ).toBe('#ABCDEF');
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
    fireEvent.change(input, { target: { value: 'not-a-color' } });
    fireEvent.blur(input);

    expect(await screen.findByText('Enter a valid CSS color.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
