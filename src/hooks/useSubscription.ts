import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';
import type { PaywallTier } from './usePaywall';

interface SubscriptionState {
  tier: PaywallTier;
  loading: boolean;
  /** Re-fetch tier from DB (e.g. after payment redirect) */
  refresh: () => Promise<void>;
}

/**
 * Reads the user's subscription tier from `user_profiles` table.
 * Falls back to `user_metadata` / `app_metadata` for backward compatibility.
 *
 * Usage: const { tier, loading, refresh } = useSubscription();
 */
export function useSubscription(): SubscriptionState {
  const { user } = useAuth();
  const [tier, setTier] = useState<PaywallTier>('anonymous');
  const [loading, setLoading] = useState(true);

  const fetchTier = async () => {
    if (!user) {
      setTier('anonymous');
      setLoading(false);
      return;
    }

    try {
      // 1. Try user_profiles table first
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('subscription_tier')
        .eq('id', user.id)
        .single();

      if (profile?.subscription_tier === 'paid') {
        setTier('paid');
        setLoading(false);
        return;
      }

      // 2. Fallback: check metadata (backward compat)
      const meta = user.user_metadata ?? {};
      const appMeta = user.app_metadata ?? {};
      if (meta.paid_at || appMeta.is_paid || meta.is_paid) {
        setTier('paid');
        setLoading(false);
        return;
      }

      // 3. Logged in but not paid
      setTier('registered');
    } catch {
      // If table doesn't exist yet, fall back to registered
      setTier(user ? 'registered' : 'anonymous');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTier();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return { tier, loading, refresh: fetchTier };
}
