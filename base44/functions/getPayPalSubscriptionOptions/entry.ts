import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { subscriptionPrices } from '../../shared/subscriptionCatalog.js';
import { IFUND_PAYPAL_ACCOUNT_REF } from '../../shared/paypalSubscriptions.ts';
import { secrets } from 'base44:runtime';
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Sign in to see subscription payments.' }, { status: 401 });
    const catalog = subscriptionPrices();
    const rows = await base44.asServiceRole.entities.SubscriptionPlanMapping.filter({
      provider: 'paypal', account_ref: IFUND_PAYPAL_ACCOUNT_REF,
    }).catch(() => []);
    const live = secrets.get('PAYPAL_MODE') === 'live' &&
      !!secrets.get('PAYPAL_CLIENT_ID') && !!secrets.get('PAYPAL_CLIENT_SECRET');
    const hooks = await base44.asServiceRole.entities.PayPalBillingWebhook.filter({
      provider: 'paypal', account_ref: IFUND_PAYPAL_ACCOUNT_REF,
    }).catch(() => []);
    const webhookReady = (hooks || []).some(row => !!row.webhook_id && !!row.url);
    return Response.json({
      provider: 'paypal',
      live_configured: live,
      webhook_configured: webhookReady,
      plans: catalog.map(price => {
        const row = (rows || []).find(item => item.tier === price.tier && item.interval === price.interval &&
          item.catalog_version === price.version && item.amount_cents === price.amount_cents && item.currency === 'USD');
        return { tier: price.tier, interval: price.interval, amount_cents: price.amount_cents,
          available: !!(live && webhookReady && row?.plan_id), currency: 'USD' };
      }),
    });
  } catch (error) {
    console.error('getPayPalSubscriptionOptions:', error?.name || 'UnknownError');
    return Response.json({ error: 'Subscription payment methods are currently unavailable.' }, { status: 503 });
  }
}