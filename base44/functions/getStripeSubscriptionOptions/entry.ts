import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import { subscriptionPrices } from '../../shared/subscriptionCatalog.js';
import { resolveStripeSubscriptionPrice, stripeSubscriptionClient } from '../../shared/stripeSubscriptionCatalog.ts';
import { verifiedDayPassPrice, PREMIUM_DAY_PASS_PRICE_ID } from '../../shared/premiumAccessCatalog.ts';
import { effectiveSubscription } from '../../shared/subscriptionEntitlements.ts';
export default async function(req: Request) {
  let trialEligible = false;
  let welcomeDiscountAvailable = false;
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Sign in to view subscriptions.' }, { status: 401 });
    const accessAvailable = user.role !== 'admin' && !effectiveSubscription(user).active &&
      user.subscription_status !== 'past_due';
    trialEligible = accessAvailable && !user.trial_end && !user.premium_trial_started_at &&
      !user.stripe_customer_id && !user.paypal_subscription_id;
    welcomeDiscountAvailable = trialEligible;
    const sr = base44.asServiceRole;
    const approved = (await sr.entities.NonprofitSubscriptionApproval.filter({ user_id: user.id }).catch(() => []))
      .some((r: any) => r.status === 'approved');
    const { stripe, accountId } = await stripeSubscriptionClient();
    const merchant = await stripe.accounts.retrieve();
    // Products and live prices are not sufficient: an unverified merchant cannot charge buyers.
    const paymentReady = merchant.id === accountId && merchant.charges_enabled === true &&
      merchant.capabilities?.card_payments === 'active';
    const hooks = await stripe.webhookEndpoints.list({ limit: 100 });
    const signatureReady = String(secrets.get('STRIPE_WEBHOOK_SECRET') || '').startsWith('whsec_');
    const required = ['checkout.session.completed', 'invoice.paid', 'customer.subscription.updated','customer.subscription.deleted'];
    const endpointReady = signatureReady && (hooks.data || []).some((row: any) => {
      const enabled = new Set(row.enabled_events || []);
      const url = String(row.url || '').toLowerCase();
      return row.livemode && row.status === 'enabled' &&
        url.includes('stripewebhook') &&
        (url.includes('interplanetaryfund') || url.includes('6a67a778342a8fe05ee79cba')) &&
        (enabled.has('*') || required.every(event => enabled.has(event)));
    });
    const dayPassPrice = await stripe.prices.retrieve(PREMIUM_DAY_PASS_PRICE_ID).catch(() => null);
    const dayPassAvailable = accessAvailable && paymentReady && endpointReady && verifiedDayPassPrice(dayPassPrice) &&
      (hooks.data || []).some((row: any) => {
        const events = new Set(row.enabled_events || []);
        const url = String(row.url || '').toLowerCase();
        return row.livemode && row.status === 'enabled' && url.includes('stripewebhook') &&
          (url.includes('interplanetaryfund') || url.includes('6a67a778342a8fe05ee79cba')) &&
          (events.has('*') || ['checkout.session.async_payment_succeeded','charge.refunded','charge.dispute.created'].every(e => events.has(e)));
      });
    const plans = await Promise.all(subscriptionPrices().map(async price => {
      const found = await resolveStripeSubscriptionPrice(sr, stripe, accountId, price.tier, price.interval);
      const available = !!found && paymentReady && endpointReady && (price.tier !== 'nonprofit' || approved);
      return { tier: price.tier, interval: price.interval, amount_cents: price.amount_cents,
        available, price_id: available ? found.id : null };
    }));
    return Response.json({ provider: 'stripe', merchant_payments_enabled: paymentReady, webhook_configured: endpointReady,
      nonprofit_approved: approved, trial_eligible: trialEligible,
      welcome_discount_available: welcomeDiscountAvailable,
      day_pass: { amount_cents: 100, duration_hours: 24, available: dayPassAvailable }, plans }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('getStripeSubscriptionOptions:', error?.name || 'UnknownError');
    return Response.json({ provider: 'stripe', webhook_configured: false, trial_eligible: trialEligible,
      welcome_discount_available: welcomeDiscountAvailable,
      day_pass: { amount_cents: 100, duration_hours: 24, available: false }, plans: [] }, { headers: { 'Cache-Control': 'private, no-store' } });
  }
}
