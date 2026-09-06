import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import Stripe from 'npm:stripe@17.7.0';
import { secrets } from 'base44:runtime';

// Starts a Stripe subscription checkout for an AI tier.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { tier, interval, price_id, origin, trial_days } = await req.json();
    if (!tier || !price_id || !origin) {
      return Response.json({ error: 'Missing subscription details' }, { status: 400 });
    }

    const stripe = new Stripe(secrets.get('STRIPE_SECRET_KEY'));
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: price_id, quantity: 1 }],
      success_url: `${origin}/subscriptions?subscribed=success`,
      cancel_url: `${origin}/subscriptions`,
      metadata: {
        base44_app_id: secrets.get('BASE44_APP_ID'),
        user_id: user.id,
        subscription_tier: tier,
        subscription_interval: interval || 'monthly',
      },
      ...(trial_days
        ? { subscription_data: { trial_period_days: trial_days, metadata: { subscription_tier: tier, user_id: user.id } } }
        : {}),
    });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error('createSubscriptionCheckout error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}