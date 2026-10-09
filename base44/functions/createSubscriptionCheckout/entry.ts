import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import Stripe from 'npm:stripe@17.7.0';
import { secrets } from 'base44:runtime';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { isFeatureEnabled, featureUnavailable } from '../../shared/featureFlagGate.ts';
import { subscriptionPrice } from '../../shared/subscriptionCatalog.js';
import { stripeSubscriptionClient, resolveStripeSubscriptionPrice } from '../../shared/stripeSubscriptionCatalog.ts';
import { effectiveSubscription } from '../../shared/subscriptionEntitlements.ts';
import { PREMIUM_WELCOME_COUPON_ID, introductoryCouponIsValid } from '../../shared/premiumAccessCatalog.ts';

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

    const { tier, interval, price_id, origin, trial_days, intro_discount } = await req.json();
    if (!tier || !price_id || !origin) {
      return Response.json({ error: 'Missing subscription details' }, { status: 400 });
    }
    // Bind the exact Stripe price to the chosen tier and interval. Matching
    // some unrelated allowed ID must NEVER grant a more expensive tier.
    if (!subscriptionPrice(tier, interval)) {
      return Response.json({ error: 'Invalid subscription plan or billing interval.' }, { status: 400 });
    }
    if (tier === 'nonprofit') {
      const approval = await base44.asServiceRole.entities.NonprofitSubscriptionApproval.filter({ user_id: user.id });
      if (!(approval || []).some(row => row.status === 'approved')) {
        return Response.json({ error: 'IFund must verify nonprofit eligibility before discounted checkout.' }, { status: 403 });
      }
    }
    if (effectiveSubscription(user).active || user.subscription_status === 'past_due') {
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
    const { stripe, accountId } = await stripeSubscriptionClient();
    const merchant = await stripe.accounts.retrieve();
    if (merchant.id !== accountId || merchant.charges_enabled !== true || merchant.capabilities?.card_payments !== 'active') {
      return Response.json({ error: 'Stripe card payments are awaiting business verification. Choose an available payment option.' }, { status: 503 });
    }
    const found = await resolveStripeSubscriptionPrice(base44.asServiceRole, stripe, accountId, tier, interval);
    if (!found || found.id !== price_id) {
      return Response.json({ error: 'Stripe price is not a verified IFund subscription price.' }, { status: 409 });
    }
    const hooks = await stripe.webhookEndpoints.list({ limit: 100 });
    const requiredEvents = ['checkout.session.completed','invoice.paid','customer.subscription.updated','customer.subscription.deleted'];
    const verifiedEndpoint = (hooks.data || []).some(row => {
      const enabled = new Set(row.enabled_events || []);
      const url = String(row.url || '').toLowerCase();
      return row.livemode && row.status === 'enabled' && url.includes('stripewebhook') &&
        (url.includes('interplanetaryfund') || url.includes('6a67a778342a8fe05ee79cba')) &&
        (enabled.has('*') || requiredEvents.every(name => enabled.has(name)));
    });
    if (!verifiedEndpoint) return Response.json({ error: 'Stripe billing webhook is not yet verified. No subscription started.' }, { status: 503 });
    const welcomeEligible = !user.premium_trial_started_at && !user.trial_end &&
      !user.stripe_customer_id && !user.paypal_subscription_id &&
      tier === 'basic' && interval === 'monthly';
    if (intro_discount === true && !welcomeEligible) {
      return Response.json({ error: 'The welcome discount is for first-time monthly members only.' }, { status: 409 });
    }
    let discounts;
    if (intro_discount === true) {
      const coupon = await stripe.coupons.retrieve(PREMIUM_WELCOME_COUPON_ID);
      if (!introductoryCouponIsValid(coupon)) {
        return Response.json({ error: 'The first-month discount is not currently available.' }, { status: 503 });
      }
      discounts = [{ coupon: PREMIUM_WELCOME_COUPON_ID }];
    }
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: price_id, quantity: 1 }],
      ...(discounts ? { discounts } : {}),
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