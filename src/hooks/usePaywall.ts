import { useMemo } from 'react';
import { useAuth } from './useAuth';
import { useSubscription } from './useSubscription';

export type PaywallTier = 'anonymous' | 'registered' | 'paid';

interface PaywallContext {
  /** Current tier: anonymous → registered (free) → paid (€49) */
  tier: PaywallTier;
  /** Not logged in */
  isAnonymous: boolean;
  /** Logged in but not paid */
  isRegistered: boolean;
  /** Paid user */
  isPaid: boolean;
  /** Shorthand: has at least registered (free) access */
  hasAccess: boolean;
  /** Shorthand: has full paid access */
  hasFullAccess: boolean;
  /** True while fetching tier from DB */
  loading: boolean;
  /** Re-fetch tier from DB (e.g. after Stripe redirect) */
  refresh: () => Promise<void>;
}

/**
 * Three-tier paywall hook.
 *
 * Tier 0 — Anonymous:  VALUES blurred, CTA → /signup
 * Tier 1 — Registered: VALUES visible, limited depth, detail pages behind paywall
 * Tier 2 — Paid:       Everything unlocked
 *
 * Reads subscription tier from `user_profiles` table (via useSubscription).
 * Falls back to user_metadata/app_metadata for backward compat.
 */
export function usePaywall(): PaywallContext {
  const { user } = useAuth();
  const { tier: dbTier, loading, refresh } = useSubscription();

  return useMemo(() => {
    if (!user) {
      return {
        tier: 'anonymous' as const,
        isAnonymous: true,
        isRegistered: false,
        isPaid: false,
        hasAccess: false,
        hasFullAccess: false,
        loading,
        refresh,
      };
    }

    const isPaid = dbTier === 'paid';

    if (isPaid) {
      return {
        tier: 'paid' as const,
        isAnonymous: false,
        isRegistered: false,
        isPaid: true,
        hasAccess: true,
        hasFullAccess: true,
        loading,
        refresh,
      };
    }

    return {
      tier: 'registered' as const,
      isAnonymous: false,
      isRegistered: true,
      isPaid: false,
      hasAccess: true,
      hasFullAccess: false,
      loading,
      refresh,
    };
  }, [user, dbTier, loading, refresh]);
}
