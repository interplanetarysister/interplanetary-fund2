import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import Stripe from 'npm:stripe@17.7.0';
import { secrets } from 'base44:runtime';
import { getSubscriptionPrice, SUPPORTED_SUBSCRIPTION_INTERVALS } from '../../shared/subscriptionCatalog.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { tier, interval = 'monthly', origin, trial_days } = await req.json();
    const price_id = getSubscriptionPrice(tier, interval);
    if (!tier || !origin || !price_id || !SUPPORTED_SUBSCRIPTION_INTERVALS.includes(interval)) {
      return Response.json({ error: 'Invalid subscription plan.' }, { status: 400 });
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
      },
      ...(trial_days
        ? { subscription_data: { trial_period_days: Math.max(0, Math.min(Number(trial_days), 30)), metadata: { user_id: user.id } } }
        : {}),
    });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error('createSubscriptionCheckout error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}