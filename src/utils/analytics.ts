/**
 * Umami event tracking utility.
 *
 * Usage:
 *   trackEvent('paywall_shown', { page: '/jurisdictions/ae' });
 *
 * Events are only sent when Umami is loaded (production).
 * In dev, calls are silently ignored.
 */

declare global {
  interface Window {
    umami?: {
      track: (name: string, data?: Record<string, string | number>) => void;
    };
  }
}

/**
 * Track a custom event in Umami analytics.
 * Safe to call anywhere — no-ops if Umami is not loaded.
 */
export function trackEvent(name: string, data?: Record<string, string | number>): void {
  try {
    if (typeof window !== 'undefined' && window.umami) {
      window.umami.track(name, data);
    }
  } catch {
    // Silently ignore — analytics should never break the app
  }
}
