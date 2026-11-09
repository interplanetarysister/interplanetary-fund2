import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { paypalWebhookAdminRequest, IFUND_PAYPAL_ACCOUNT_REF } from '../../shared/paypal.ts';
import { PAYPAL_CAMPAIGN_WEBHOOK_URL, PAYPAL_CAMPAIGN_WEBHOOK_EVENTS } from '../../shared/paypalCampaignWebhookContract.js';

// Admin-only idempotent registration against the EXISTING business REST app.
// No new PayPal app, donation, capture, billing plan or payout is created.
export default async function(req) {
  let stage = 'authorize';
  try {
    if (req.method !== 'POST') return Response.json({ error: 'POST required.' }, { status: 405 });
    const base44 = createClientFromRequest(req);
    const guard = await assertActiveAccount(base44);
    if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });
    if (guard.user.role !== 'admin') return Response.json({ error: 'Administrator access required.' }, { status: 403 });

    stage = 'configuration';
    const mode = secrets.get('PAYPAL_MODE');
    if (!['live', 'sandbox'].includes(mode) ||
        !secrets.get('PAYPAL_CLIENT_ID') || !secrets.get('PAYPAL_CLIENT_SECRET'))
      return Response.json({ error: 'Existing PayPal REST app configuration is incomplete.', stage }, { status: 503 });
    const callback = new URL(PAYPAL_CAMPAIGN_WEBHOOK_URL);
    if (callback.origin !== 'https://interplanetaryfund.base44.app' ||
        callback.pathname !== '/functions/payPalCampaignWebhook' ||
        callback.search || callback.hash)
      return Response.json({ error: 'The trusted PayPal callback URL is invalid.', stage }, { status: 503 });

    const sr = base44.asServiceRole;
    stage = 'local_webhook';
    const local = await sr.entities.PayPalCampaignWebhook.filter({
      provider: 'paypal', account_ref: IFUND_PAYPAL_ACCOUNT_REF, environment: mode,
    });
    if ((local || []).length > 1)
      return Response.json({ error: 'Duplicate PayPal webhook registrations require reconciliation.', stage }, { status: 409 });

    const hasEvents = (remote) => {
      const enabled = new Set((remote?.event_types || []).map(e => e.name));
      return remote?.url === PAYPAL_CAMPAIGN_WEBHOOK_URL &&
        PAYPAL_CAMPAIGN_WEBHOOK_EVENTS.every(e => enabled.has(e) || enabled.has('*'));
    };
    if ((local || []).length === 1) {
      stage = 'verify_existing_registration';
      const row = local[0];
      if (row.url !== PAYPAL_CAMPAIGN_WEBHOOK_URL || !row.webhook_id)
        return Response.json({ error: 'Existing webhook registration needs reconciliation.', stage }, { status: 409 });
      const remote = await paypalWebhookAdminRequest('/v1/notifications/webhooks/' + encodeURIComponent(row.webhook_id));
      if (!hasEvents(remote))
        return Response.json({ error: 'Registered PayPal webhook URL or events differ; no duplicate created.', stage }, { status: 409 });
      return Response.json({ ok: true, webhook_registered: true, existing: true, environment: mode, event_count: PAYPAL_CAMPAIGN_WEBHOOK_EVENTS.length });
    }

    stage = 'list_registered_webhooks';
    const all = await paypalWebhookAdminRequest('/v1/notifications/webhooks');
    const sameUrl = (all?.webhooks || []).filter(h => h.url === PAYPAL_CAMPAIGN_WEBHOOK_URL);
    if (sameUrl.length > 1 || (sameUrl.length && !hasEvents(sameUrl[0])))
      return Response.json({ error: 'Existing PayPal webhook needs reconciliation; no duplicate created.', stage }, { status: 409 });
    stage = 'register_webhook';
    const hook = sameUrl[0] || await paypalWebhookAdminRequest('/v1/notifications/webhooks', {
      method: 'POST', requestId: 'IFUND_CAMPAIGN_WEBHOOK_20261108',
      body: { url: PAYPAL_CAMPAIGN_WEBHOOK_URL, event_types: PAYPAL_CAMPAIGN_WEBHOOK_EVENTS.map(name => ({ name })) },
    });
    if (!hook?.id) throw new Error('PayPal did not confirm webhook registration.');

    stage = 'verify_registered_webhook';
    const verified = await paypalWebhookAdminRequest('/v1/notifications/webhooks/' + encodeURIComponent(hook.id));
    if (!hasEvents(verified)) throw new Error('PayPal webhook verification failed.');

    stage = 'persist_registration';
    await sr.entities.PayPalCampaignWebhook.create({
      provider: 'paypal', account_ref: IFUND_PAYPAL_ACCOUNT_REF,
      webhook_id: hook.id, url: PAYPAL_CAMPAIGN_WEBHOOK_URL,
      events: PAYPAL_CAMPAIGN_WEBHOOK_EVENTS, environment: mode,
      verified_at: new Date().toISOString(),
    });
    return Response.json({ ok: true, webhook_registered: true, existing: Boolean(sameUrl.length), environment: mode, event_count: PAYPAL_CAMPAIGN_WEBHOOK_EVENTS.length });
  } catch (error) {
    console.error('setupPayPalCampaignWebhook failed:', error?.name || 'ProviderError');
    return Response.json({ error: 'Campaign webhook registration could not be verified. Checkout remains disabled.', stage }, { status: 503 });
  }
}
