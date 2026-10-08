import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import { subscriptionPrices } from '../../shared/subscriptionCatalog.js';
import { resolveStripeSubscriptionPrice, stripeSubscriptionClient } from '../../shared/stripeSubscriptionCatalog.ts';
export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Sign in to view subscriptions.' }, { status: 401 });
    const sr = base44.asServiceRole;
    const approved = (await sr.entities.NonprofitSubscriptionApproval.filter({ user_id: user.id }).catch(() => []))
      .some((r: any) => r.status === 'approved');
    const { stripe, accountId } = await stripeSubscriptionClient();
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
    const plans = await Promise.all(subscriptionPrices().map(async price => {
      const found = await resolveStripeSubscriptionPrice(sr, stripe, accountId, price.tier, price.interval);
      const available = !!found && endpointReady && (price.tier !== 'nonprofit' || approved);
      return { tier: price.tier, interval: price.interval, amount_cents: price.amount_cents,
        available, price_id: available ? found.id : null };
    }));
    return Response.json({ provider: 'stripe', webhook_configured: endpointReady,
      nonprofit_approved: approved, plans }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('getStripeSubscriptionOptions:', error?.name || 'UnknownError');
    return Response.json({ provider: 'stripe', webhook_configured: false, plans: [] }, { headers: { 'Cache-Control': 'private, no-store' } });
  }
}
