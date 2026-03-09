import { supabase } from './supabase';

const CHECKOUT_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`;

/**
 * Redirects the current user to Stripe Checkout for the €49 one-time payment.
 * Requires the user to be authenticated.
 *
 * Flow: Frontend → Supabase Edge Function → Stripe Checkout → redirect back
 */
export async function redirectToCheckout(): Promise<{ error: string | null }> {
  try {
    // 1. Get current session token
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { error: 'Please sign in first' };
    }

    // 2. Call Edge Function to create Checkout session
    const response = await fetch(CHECKOUT_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.error || 'Failed to create checkout session' };
    }

    if (!data.url) {
      return { error: 'No checkout URL returned' };
    }

    // 3. Redirect to Stripe Checkout
    window.location.href = data.url;
    return { error: null };
  } catch (err) {
    console.error('Checkout redirect error:', err);
    return { error: 'Something went wrong. Please try again.' };
  }
}
