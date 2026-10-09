import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { isFeatureEnabled, featureUnavailable } from '../../shared/featureFlagGate.ts';
import { effectiveSubscription } from '../../shared/subscriptionEntitlements.ts';
import { stripeSubscriptionClient } from '../../shared/stripeSubscriptionCatalog.ts';
import { PREMIUM_DAY_PASS_PRICE_ID, verifiedDayPassPrice } from '../../shared/premiumAccessCatalog.ts';

const ALLOWED_ORIGINS = new Set([
  'https://interplanetaryfund.com',
  'https://www.interplanetaryfund.com',
  'https://interplanetaryfund.base44.app',
  'https://interplanetary-fund2.interplanetary-fund.workers.dev',
]);

export default async function(req: Request) {
  if (req.method !== 'POST') return Response.json({ error: 'POST required.' }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    if (!(await isFeatureEnabled(base44, 'subscription_checkout'))) return featureUnavailable('Premium day passes');
    const guard = await assertActiveAccount(base44);
    if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });
    const user = guard.user;
    if (user.role === 'admin') return Response.json({ error: 'Admin access is already included.' }, { status: 409 });
    if (effectiveSubscription(user).active || user.subscription_status === 'past_due') {
      return Response.json({ error: 'Premium access already exists. Manage your current plan first.' }, { status: 409 });
    }
    const { origin } = await req.json().catch(() => ({}));
    let url;
    try { url = new URL(origin); }
    catch { return Response.json({ error: 'A valid IFund origin is required.' }, { status: 400 }); }
    if (url.protocol !== 'https:' || !ALLOWED_ORIGINS.has(url.origin)) {
      return Response.json({ error: 'Invalid checkout origin.' }, { status: 400 });
    }

    const signingSecret = String(secrets.get('STRIPE_WEBHOOK_SECRET') || '');
    if (!signingSecret.startsWith('whsec_')) {
      return Response.json({ error: 'Secure payment confirmation is not yet available.' }, { status: 503 });
    }
    const { stripe, accountId } = await stripeSubscriptionClient();
    if (accountId !== 'acct_1TxdGsGg5Dyxp347') {
      return Response.json({ error: 'Stripe merchant account does not match IFund.' }, { status: 503 });
    }
    const merchant = await stripe.accounts.retrieve();
    if (merchant.id !== accountId || merchant.charges_enabled !== true || merchant.capabilities?.card_payments !== 'active') {
      return Response.json({ error: 'Stripe card payments are awaiting business verification. No day-pass payment was started.' }, { status: 503 });
    }
    const price = await stripe.prices.retrieve(PREMIUM_DAY_PASS_PRICE_ID);
    if (!verifiedDayPassPrice(price)) {
      return Response.json({ error: 'The $1 Stripe day-pass price could not be verified.' }, { status: 503 });
    }
    const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
    const events = ['checkout.session.completed', 'checkout.session.async_payment_succeeded',
      'charge.refunded', 'charge.dispute.created'];
    const webhookReady = (endpoints.data || []).some((row: any) => {
      const enabled = new Set(row.enabled_events || []);
      const url = String(row.url || '').toLowerCase();
      return row.livemode && row.status === 'enabled' &&
        url.includes('stripewebhook') &&
        (url.includes('interplanetaryfund') || url.includes('6a67a778342a8fe05ee79cba')) &&
        (enabled.has('*') || events.every(event => enabled.has(event)));
    });
    if (!webhookReady) {
      return Response.json({ error: 'Stripe payment confirmation is not fully linked. No checkout was started.' }, { status: 503 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      client_reference_id: user.id,
      line_items: [{ price: PREMIUM_DAY_PASS_PRICE_ID, quantity: 1 }],
      success_url: url.origin + '/subscriptions?day_pass=confirming',
      cancel_url: url.origin + '/subscriptions',
      metadata: { ifund_purchase: 'premium_day_pass', user_id: user.id },
      payment_intent_data: { metadata: { ifund_purchase: 'premium_day_pass', user_id: user.id } },
    });
    return Response.json({ url: session.url });
  } catch (error) {
    console.error('createPremiumDayPassCheckout:', error?.name || 'UnknownError');
    return Response.json({ error: 'Could not start day-pass checkout.' }, { status: 503 });
  }
}
