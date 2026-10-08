import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import Stripe from 'npm:stripe@17.7.0';
import { secrets } from 'base44:runtime';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { isFeatureEnabled, featureUnavailable } from '../../shared/featureFlagGate.ts';
import { stripePriceFor, subscriptionPrice } from '../../shared/subscriptionCatalog.js';

// Starts a Stripe subscription checkout for an AI tier.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    if (!(await isFeatureEnabled(base44, 'subscription_checkout'))) return featureUnavailable('New paid subscriptions');
    const guard = await assertActiveAccount(base44);
    if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });
    const user = guard.user;
    // Admin subscription access is role-derived and permanent. Never create a
    // paid Stripe subscription for an administrator.
    if (user.role === 'admin') {
      return Response.json({ error: 'Administrators already have permanent top-tier access.', admin_entitlement: true }, { status: 409 });
    }

    const { tier, interval, price_id, origin, trial_days } = await req.json();
    if (!tier || !price_id || !origin) {
      return Response.json({ error: 'Missing subscription details' }, { status: 400 });
    }
    // Bind the exact Stripe price to the chosen tier and interval. Matching
    // some unrelated allowed ID must NEVER grant a more expensive tier.
    if (!subscriptionPrice(tier, interval) || stripePriceFor(tier, interval) !== price_id) {
      return Response.json({ error: 'Invalid subscription plan or billing interval.' }, { status: 400 });
    }
    if (user.subscription_status === 'active' || user.subscription_status === 'trialing' || user.subscription_status === 'past_due') {
      return Response.json({ error: 'Manage your existing subscription before buying another plan.' }, { status: 409 });
    }
    let originUrl;
    try {
      originUrl = new URL(origin);
    } catch (_) {
      return Response.json({ error: 'Missing subscription details' }, { status: 400 });
    }
    const allowedOrigins = new Set([
      'https://interplanetaryfund.com',
      'https://www.interplanetaryfund.com',
      'https://interplanetaryfund.base44.app',
      'https://interplanetary-fund2.interplanetary-fund.workers.dev',
    ]);
    if (originUrl.protocol !== 'https:' || !allowedOrigins.has(originUrl.origin)) {
      return Response.json({ error: 'Invalid subscription origin' }, { status: 400 });
    }
    // Trials are a merchant-controlled offer, never an arbitrary number of
    // free days submitted by a buyer.
    if (trial_days != null) return Response.json({ error: 'Trial offers are not available for this checkout.' }, { status: 400 });

    const stripeSecret = secrets.get('STRIPE_SECRET_KEY');
    const stripeWebhookSecret = secrets.get('STRIPE_WEBHOOK_SECRET');
    if (!stripeSecret || !String(stripeSecret).startsWith('sk_live_') || !stripeWebhookSecret) {
      return Response.json({ error: 'Subscription checkout is not currently available.' }, { status: 503 });
    }
    const stripe = new Stripe(stripeSecret);
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
      subscription_data: { metadata: { subscription_tier: tier, subscription_interval: interval, user_id: user.id } },
    });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error('createSubscriptionCheckout error:', error?.name || 'UnknownError');
    return Response.json({ error: 'Could not start your subscription. Please try again.' }, { status: 500 });
  }
}