import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useSupabaseQuery } from './useSupabaseQuery';

describe('useSupabaseQuery', () => {
  it('starts in loading state', () => {
    const fetcher = vi.fn(() => new Promise<string[]>(() => {})); // never resolves

    const { result } = renderHook(() => useSupabaseQuery(fetcher));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('resolves data and stops loading', async () => {
    const fetcher = vi.fn().mockResolvedValue(['a', 'b', 'c']);

    const { result } = renderHook(() => useSupabaseQuery(fetcher));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(['a', 'b', 'c']);
    expect(result.current.error).toBeNull();
  });

  it('captures errors', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('Network down'));

    const { result } = renderHook(() => useSupabaseQuery(fetcher));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe('Network down');
  });

  it('captures non-Error exceptions as generic message', async () => {
    const fetcher = vi.fn().mockRejectedValue('string error');

    const { result } = renderHook(() => useSupabaseQuery(fetcher));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('An error occurred');
  });

  it('refetch re-invokes the fetcher', async () => {
    let callCount = 0;
    const fetcher = vi.fn(() => Promise.resolve(++callCount));

    const { result } = renderHook(() => useSupabaseQuery(fetcher));

    await waitFor(() => expect(result.current.data).toBe(1));

    act(() => result.current.refetch());

    await waitFor(() => expect(result.current.data).toBe(2));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('re-fetches when deps change', async () => {
    const fetcher = vi.fn((id: string) => Promise.resolve(`result-${id}`));

    const { result, rerender } = renderHook(
      ({ id }) => useSupabaseQuery(() => fetcher(id), [id]),
      { initialProps: { id: 'a' } },
    );

    await waitFor(() => expect(result.current.data).toBe('result-a'));

    rerender({ id: 'b' });

    await waitFor(() => expect(result.current.data).toBe('result-b'));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('ignores stale results after unmount', async () => {
    let resolve: (v: string) => void;
    const fetcher = vi.fn(() => new Promise<string>((r) => { resolve = r; }));

    const { result, unmount } = renderHook(() => useSupabaseQuery(fetcher));

    expect(result.current.loading).toBe(true);
    unmount();

    // Resolve after unmount — should not throw or update
    resolve!('late data');
    // No assertion needed — just ensure no error is thrown
  });
});
