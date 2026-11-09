import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import { verifyWebhookSignature, getOrder, IFUND_PAYPAL_ACCOUNT_REF } from '../../shared/paypal.ts';
import {
  PAYPAL_CAMPAIGN_WEBHOOK_URL, paypalCampaignEventInfo, confirmedCampaignCapture,
} from '../../shared/paypalCampaignWebhookContract.js';

// Public endpoint with authenticated PayPal signatures. It records verified
// evidence and checks existing canonical operations; it NEVER initiates charges,
// grants funds, changes balances, clears holds, refunds or triggers payouts.
// Captures not already present in canonical accounting stay pending review.
export default async function(req) {
  if (req.method === 'GET')
    return Response.json({ type: 'ifund_paypal_campaign_webhook', ready: true, financial_actions: false });
  if (req.method !== 'POST')
    return Response.json({ error: 'Method not allowed.' }, { status: 405 });
  try {
    const mode = secrets.get('PAYPAL_MODE');
    if (!['live', 'sandbox'].includes(mode))
      return Response.json({ error: 'PayPal environment is not configured.' }, { status: 503 });
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const hookRows = await sr.entities.PayPalCampaignWebhook.filter({
      provider: 'paypal', account_ref: IFUND_PAYPAL_ACCOUNT_REF, environment: mode,
    });
    const hooks = (hookRows || []).filter(x => x.url === PAYPAL_CAMPAIGN_WEBHOOK_URL && x.webhook_id);
    if (hookRows.length !== 1 || hooks.length !== 1)
      return Response.json({ error: 'Campaign webhook is not uniquely registered.' }, { status: 503 });

    const raw = await req.text();
    if (!raw || raw.length > 150000)
      return Response.json({ error: 'Webhook payload is empty or too large.' }, { status: 413 });
    const verified = await verifyWebhookSignature(raw, req.headers, hooks[0].webhook_id);
    if (!verified)
      return Response.json({ error: 'Webhook signature was not verified.' }, { status: 401 });

    const event = JSON.parse(raw);
    const info = paypalCampaignEventInfo(event);
    if (!info.ok)
      return Response.json({ error: 'Invalid webhook event identity.' }, { status: 400 });
    if (!info.relevant) return Response.json({ received: true, ignored: true });

    const key = 'paypal_campaign:' + info.eventId;
    const existing = await sr.entities.WebhookEvent.filter({ source: 'paypal_campaign', event_key: key });
    if (existing.length > 1)
      return Response.json({ error: 'Duplicate webhook receipts require manual reconciliation.' }, { status: 409 });
    let record = existing[0] || null;
    if (record && record.event_type !== info.type)
      return Response.json({ error: 'Webhook event identity conflict.' }, { status: 409 });
    if (record?.state === 'financial_applied' || record?.state === 'side_effects_complete')
      return Response.json({ received: true, duplicate: true });

    // The event is only a trigger for read-only provider verification. Its
    // resource data cannot credit a campaign without an authoritative PayPal
    // order and the canonical financial operation.
    let financialState = 'awaiting_canonical_reconciliation';
    let canonicalId = '';
    if (info.type === 'PAYMENT.CAPTURE.COMPLETED') {
      if (!info.orderId || !info.captureId)
        return Response.json({ error: 'Captured payment requires its PayPal order reference.' }, { status: 503 });
      const order = await getOrder(info.orderId);
      if (!confirmedCampaignCapture(order, event))
        return Response.json({ error: 'PayPal capture and originating order disagree.' }, { status: 409 });
      const campaignId = String(order.custom_id).split('|')[0];
      const ops = await sr.entities.FinancialOperation.filter({ operation_key: 'paypal:' + info.orderId });
      if (ops.length > 1)
        return Response.json({ error: 'Canonical financial operation requires reconciliation.' }, { status: 409 });
      if (ops.length === 1) {
        const op = ops[0];
        if (op.state !== 'applied' || op.provider !== 'paypal' ||
            op.operation_type !== 'donation' || op.campaign_id !== campaignId ||
            String(op.provider_transaction_id) !== info.captureId)
          return Response.json({ error: 'PayPal capture conflicts with canonical donation.' }, { status: 409 });
        canonicalId = String(op.id);
        financialState = 'canonical_donation_verified';
      }
    }

    if (!record) {
      record = await sr.entities.WebhookEvent.create({
        source: 'paypal_campaign', event_key: key, event_type: info.type,
        state: 'claimed', description: financialState,
      });
    }
    if (canonicalId) {
      await sr.entities.WebhookEvent.update(record.id, {
        state: 'financial_applied', canonical_operation_id: canonicalId,
        financial_applied_at: new Date().toISOString(),
        description: financialState, last_error: '',
      });
      return Response.json({ received: true, canonical_reconciled: true });
    }
    // A signed capture not yet found in canonical operations is NOT a donation.
    // Keep it visible to admin reconciliation, even if PayPal retries delivery.
    if (record.description !== financialState) {
      await sr.entities.WebhookEvent.update(record.id, {
        state: 'claimed', description: financialState,
      });
    }
    return Response.json({ received: true, canonical_reconciled: false, pending_review: true }, { status: 202 });
  } catch (error) {
    console.error('payPalCampaignWebhook:', error?.name || 'UnknownError');
    return Response.json({ error: 'Webhook verification or reconciliation did not complete.' }, { status: 503 });
  }
}
