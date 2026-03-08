import { useMemo } from 'react';
import { useAuth } from './useAuth';

export type PaywallTier = 'anonymous' | 'registered' | 'paid';

interface PaywallContext {
  /** Current tier: anonymous → registered (free) → paid ($49) */
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
}

/**
 * Three-tier paywall hook.
 *
 * Tier 0 — Anonymous:  VALUES blurred, CTA → /signup
 * Tier 1 — Registered: VALUES visible, limited depth, detail pages behind paywall
 * Tier 2 — Paid:       Everything unlocked
 *
 * `isPaid` is determined by user_metadata.paid_at or app_metadata.is_paid.
 * Until payment integration is done, all registered users are Tier 1 only.
 */
export function usePaywall(): PaywallContext {
  const { user } = useAuth();

  return useMemo(() => {
    if (!user) {
      return {
        tier: 'anonymous' as const,
        isAnonymous: true,
        isRegistered: false,
        isPaid: false,
        hasAccess: false,
        hasFullAccess: false,
      };
    }

    // Check for paid status in user metadata
    const meta = user.user_metadata ?? {};
    const appMeta = user.app_metadata ?? {};
    const paid = !!(meta.paid_at || appMeta.is_paid || meta.is_paid);

    if (paid) {
      return {
        tier: 'paid' as const,
        isAnonymous: false,
        isRegistered: false,
        isPaid: true,
        hasAccess: true,
        hasFullAccess: true,
      };
    }

    return {
      tier: 'registered' as const,
      isAnonymous: false,
      isRegistered: true,
      isPaid: false,
      hasAccess: true,
      hasFullAccess: false,
    };
  }, [user]);
}
