// supabase/functions/stripe-webhook/index.ts
// Handles Stripe webhook events — updates user_profiles on successful payment.
//
// Required Supabase secrets:
//   STRIPE_SECRET_KEY       — sk_test_... or sk_live_...
//   STRIPE_WEBHOOK_SECRET   — whsec_... (from Stripe Dashboard → Webhooks)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno';

serve(async (req) => {
  try {
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')!;
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // 1. Verify Stripe signature
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return new Response('Missing stripe-signature header', { status: 400 });
    }

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        webhookSecret,
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    // 2. Handle event
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.supabase_user_id;
        const customerId = session.customer as string;
        const paymentIntentId = session.payment_intent as string;

        if (!userId) {
          console.error('No supabase_user_id in session metadata');
          break;
        }

        console.log(`Payment completed for user ${userId}, customer ${customerId}`);

        // Update user_profiles → paid
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({
            subscription_tier: 'paid',
            stripe_customer_id: customerId,
            stripe_payment_id: paymentIntentId,
            paid_at: new Date().toISOString(),
          })
          .eq('id', userId);

        if (updateError) {
          console.error('Failed to update user profile:', updateError);
          // Return 200 anyway to prevent Stripe retries — log for manual fix
        } else {
          console.log(`User ${userId} upgraded to paid tier`);
        }

        // Also set app_metadata.is_paid for backward compatibility with usePaywall
        await supabase.auth.admin.updateUserById(userId, {
          app_metadata: { is_paid: true },
        });

        break;
      }

      case 'charge.refunded': {
        // Handle refunds — downgrade back to registered
        const charge = event.data.object as Stripe.Charge;
        const customerId = charge.customer as string;

        if (customerId) {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('id')
            .eq('stripe_customer_id', customerId)
            .single();

          if (profile) {
            await supabase
              .from('user_profiles')
              .update({
                subscription_tier: 'registered',
                paid_at: null,
              })
              .eq('id', profile.id);

            await supabase.auth.admin.updateUserById(profile.id, {
              app_metadata: { is_paid: false },
            });

            console.log(`User ${profile.id} downgraded to registered (refund)`);
          }
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Webhook handler error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
