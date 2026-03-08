import { useEffect } from 'react';
import { useAuth } from './useAuth';
import { trackEvent } from '../utils/analytics';

/**
 * Hook for per-section paywall gating.
 * Returns `isLocked: true` when the user is not authenticated.
 * Also fires a `paywall_section_shown` event for analytics.
 */
export function usePaywallSection(sectionName: string, pagePath?: string) {
  const { user } = useAuth();
  const isLocked = !user;

  useEffect(() => {
    if (isLocked) {
      trackEvent('paywall_section_shown', {
        section: sectionName,
        ...(pagePath ? { page: pagePath } : {}),
      });
    }
  }, [isLocked, sectionName, pagePath]);

  return { isLocked };
}
