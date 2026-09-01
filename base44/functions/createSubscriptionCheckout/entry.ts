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
    // Allowlist the Stripe price ids that match our published plans — prevents
    // a caller from checking out an arbitrary price from another account/tier.
    const ALLOWED_PRICE_IDS = new Set([
      'price_1Tz8iSEkntycHB4NlQlYd0Gs', // basic monthly
      'price_1Tz8iSEkntycHB4N8J7EXq42', // basic annual
      'price_1Tz8iSEkntycHB4NESNtjyOx', // outreach monthly
      'price_1Tz8iSEkntycHB4N5iujmlJZ', // outreach annual
    ]);
    if (!ALLOWED_PRICE_IDS.has(price_id)) {
      return Response.json({ error: 'Invalid subscription plan.' }, { status: 400 });
    }
    let originUrl;
    try {
      originUrl = new URL(origin);
    } catch (_) {
      return Response.json({ error: 'Missing subscription details' }, { status: 400 });
    }
    if (originUrl.protocol !== 'https:' && originUrl.protocol !== 'http:') {
      return Response.json({ error: 'Missing subscription details' }, { status: 400 });
    }
    if (trial_days != null && (Number(trial_days) <= 0 || Number(trial_days) > 365)) {
      return Response.json({ error: 'Invalid subscription details' }, { status: 400 });
    }

    const stripe = new Stripe(secrets.get('STRIPE_SECRET_KEY'));
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: price_id, quantity: 1 }],
      success_url: `${originUrl.origin}/subscriptions?subscribed=success`,
      cancel_url: `${originUrl.origin}/subscriptions`,
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
    return Response.json({ error: 'Could not start your subscription. Please try again.' }, { status: 500 });
  }
}