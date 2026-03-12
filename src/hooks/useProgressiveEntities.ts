import { useState, useEffect, useCallback } from 'react';
import type { Entity } from '../types';
import { getEntitiesProgressive, clearEntityCache } from '../data/dataLoader';

interface ProgressiveEntitiesState {
  /** null = no data yet (show skeleton), non-null = data available (show table) */
  data: Entity[] | null;
  /** true while still fetching pages — table may already be visible with partial data */
  loading: boolean;
  /** { loaded: N, total: T } — for progress indicator */
  progress: { loaded: number; total: number };
  error: string | null;
  refetch: () => void;
}

/**
 * Progressive entity loading hook.
 * - Cache hit → returns 14K entities instantly (0ms)
 * - Cold start → delivers first 1000 entities in ~300ms, then fills in the rest
 * - Shows progress: "Loading 3,000 / 14,000"
 */
export function useProgressiveEntities(): ProgressiveEntitiesState {
  const [data, setData] = useState<Entity[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);

  useEffect(() => {
    const signal = { cancelled: false };
    setLoading(true);
    setError(null);

    getEntitiesProgressive(
      (entities, loaded, total) => {
        if (!signal.cancelled) {
          setData(entities);
          setProgress({ loaded, total });
        }
      },
      signal,
    )
      .then(() => {
        if (!signal.cancelled) setLoading(false);
      })
      .catch((err) => {
        if (!signal.cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load entities');
          setLoading(false);
        }
      });

    return () => {
      signal.cancelled = true;
    };
  }, [trigger]);

  const refetch = useCallback(() => {
    clearEntityCache();
    setData(null);
    setProgress({ loaded: 0, total: 0 });
    setTrigger((n) => n + 1);
  }, []);

  return { data, loading, progress, error, refetch };
}
