import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { paypalBillingRequest, IFUND_PAYPAL_ACCOUNT_REF } from '../../shared/paypalSubscriptions.ts';
const SUB_EVENTS = [
  'BILLING.SUBSCRIPTION.ACTIVATED', 'BILLING.SUBSCRIPTION.UPDATED',
  'BILLING.SUBSCRIPTION.SUSPENDED', 'BILLING.SUBSCRIPTION.CANCELLED',
  'BILLING.SUBSCRIPTION.EXPIRED', 'BILLING.SUBSCRIPTION.PAYMENT.FAILED',
  'PAYMENT.SALE.COMPLETED', 'PAYMENT.SALE.REFUNDED', 'PAYMENT.SALE.REVERSED',
];
const URL = 'https://interplanetaryfund.base44.app/functions/payPalSubscriptionWebhook';
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const admin = await base44.auth.me();
    if (!admin || admin.role !== 'admin') return Response.json({ error: 'Administrator access required.' }, { status: 403 });
    if (req.method !== 'POST') return Response.json({ error: 'POST required.' }, { status: 405 });
    // Don't register a callback pointing at a landing page/404. Require
    // actual deployed function to confirm its routing identity first.
    const check = await fetch(URL, { headers: { Accept: 'application/json' }, redirect: 'error' });
    const probe = check.ok ? await check.json().catch(() => null) : null;
    if (probe?.type !== 'ifund_paypal_subscription_webhook' || probe.ready !== true) {
      return Response.json({ error: 'The live PayPal webhook route is not published or reachable yet. Publish the backend before enabling subscription purchases.' }, { status: 503 });
    }
    const sr = base44.asServiceRole;
    const hooks = await sr.entities.PayPalBillingWebhook.filter({ provider: 'paypal', account_ref: IFUND_PAYPAL_ACCOUNT_REF });
    const existing = (hooks || []).find(row => row.url === URL && row.webhook_id);
    if (existing) {
      const remote = await paypalBillingRequest('/v1/notifications/webhooks/' + encodeURIComponent(existing.webhook_id)).catch(() => null);
      const enabled = new Set((remote?.event_types || []).map(item => item.name));
      if (remote?.url === URL && SUB_EVENTS.every(e => enabled.has(e) || enabled.has('*'))) {
        return Response.json({ ok: true, webhook_registered: true, existing: true });
      }
      return Response.json({ error: 'Existing PayPal webhook needs reconciliation. No second webhook was created.' }, { status: 409 });
    }
    // Reuse a matching remote webhook when local persistence was interrupted.
    const remoteList = await paypalBillingRequest('/v1/notifications/webhooks');
    const matching = (remoteList.webhooks || []).find(row => row.url === URL &&
      SUB_EVENTS.every(e => (row.event_types || []).some(t => t.name === e || t.name === '*')));
    const hook = matching || await paypalBillingRequest('/v1/notifications/webhooks', {
      method: 'POST', requestId: 'IFUND_SUBSCRIPTION_WEBHOOK_202610',
      body: { url: URL, event_types: SUB_EVENTS.map(name => ({ name })) },
    });
    if (!hook?.id) throw new Error('PayPal did not confirm the subscription webhook.');
    await sr.entities.PayPalBillingWebhook.create({
      provider: 'paypal', account_ref: IFUND_PAYPAL_ACCOUNT_REF,
      webhook_id: hook.id, url: URL, events: SUB_EVENTS,
      verified_at: new Date().toISOString(),
    });
    return Response.json({ ok: true, webhook_registered: true, existing: !!matching });
  } catch (error) {
    console.error('setupPayPalSubscriptionWebhook:', error?.name || 'UnknownError');
    return Response.json({ error: 'PayPal subscription webhook provisioning could not finish.' }, { status: 503 });
  }
}