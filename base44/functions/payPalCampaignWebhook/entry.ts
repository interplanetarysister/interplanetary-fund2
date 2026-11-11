import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { verifyWebhookSignature, getOrder } from '../../shared/paypal.ts';
import { resolvePayPalEnvironment } from '../../shared/paypalEnvironment.ts';
import { resolveVerifiedCampaignWebhookId } from '../../shared/paypalCampaignReadiness.ts';
import { reconcileCanonicalCampaignProjection } from '../../shared/base44Financial.ts';
import {
  PAYPAL_CAMPAIGN_WEBHOOK_URL, paypalCampaignEventInfo, confirmedCampaignCapture,
} from '../../shared/paypalCampaignWebhookContract.js';

// Public HTTPS endpoint authenticated by PayPal's own webhook signature
// verification against the webhook registered for THIS environment (sandbox or
// live). It never initiates a charge, refund or payout and never trusts a
// client. Completed captures only reconcile to a canonical donation that a real
// server capture already wrote; pending/denied/refunded/reversed events update
// provider state and reverse ledger entries without duplicating money.
export default async function(req) {
  if (req.method === 'GET')
    return Response.json({ type: 'ifund_paypal_campaign_webhook', ready: true, financial_actions: false });
  if (req.method !== 'POST')
    return Response.json({ error: 'Method not allowed.' }, { status: 405 });
  try {
    const environment = resolvePayPalEnvironment();
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;

    // Sandbox and live webhooks are different registrations; never verify a
    // sandbox delivery with the live webhook id or vice versa.
    const webhookId = await resolveVerifiedCampaignWebhookId(sr, environment);
    if (!webhookId) return Response.json({ error: 'Campaign webhook is not registered for this environment.' }, { status: 503 });

    const raw = await req.text();
    if (!raw || raw.length > 150000)
      return Response.json({ error: 'Webhook payload is empty or too large.' }, { status: 413 });

    const verified = await verifyWebhookSignature(raw, req.headers, webhookId, environment);
    if (!verified)
      return Response.json({ error: 'Webhook signature was not verified.' }, { status: 401 });

    const event = JSON.parse(raw);
    const info = paypalCampaignEventInfo(event);
    if (!info.ok)
      return Response.json({ error: 'Invalid webhook event identity.' }, { status: 400 });
    if (!info.relevant) return Response.json({ received: true, ignored: true });

    const eventKey = `${environment}:${info.eventId}`;
    const existing = await sr.entities.WebhookEvent.filter({ source: 'paypal_campaign', event_key: eventKey }).catch(() => []);
    if (!Array.isArray(existing)) return Response.json({ error: 'Webhook receipt unavailable.' }, { status: 503 });
    if (existing.length > 1)
      return Response.json({ error: 'Duplicate webhook receipts require manual reconciliation.' }, { status: 409 });
    let record = existing[0] || null;
    if (record && record.event_type !== info.type)
      return Response.json({ error: 'Webhook event identity conflict.' }, { status: 409 });
    if (record && ['financial_applied', 'side_effects_complete', 'nonfinancial_complete'].includes(record.state))
      return Response.json({ received: true, duplicate: true });

    if (!record) {
      // Durable uniqueness for provider event ids: the (source, event_key) key
      // makes a replayed delivery converge on the same row instead of a clone.
      const claimed = await sr.entities.WebhookEvent.upsert([{
        source: 'paypal_campaign', event_key: eventKey, event_type: info.type,
        state: 'claimed', attempt_count: 1, description: `environment=${environment}`,
      }], { key: ['source', 'event_key'] });
      record = claimed?.records?.[0] || null;
      const confirm = await sr.entities.WebhookEvent.filter({ source: 'paypal_campaign', event_key: eventKey }).catch(() => []);
      if (!record || !Array.isArray(confirm) || confirm.length !== 1) {
        return Response.json({ error: 'Webhook receipt could not be confirmed uniquely.' }, { status: 503 });
      }
      record = confirm[0];
    }

    // Refund webhooks frequently carry a refund ID and an original capture
    // reference but no order_id. Resolve only against a UNIQUE locally
    // persisted capture; never misinterpret the refund ID as a capture ID.
    let resolvedOrderId = info.orderId;
    if (!resolvedOrderId && info.captureId &&
        ['PAYMENT.CAPTURE.REFUNDED', 'PAYMENT.CAPTURE.REVERSED'].includes(info.type)) {
      const capturedRows = await sr.entities.PayPalOrder.filter({ capture_id: info.captureId }).catch(() => null);
      if (!Array.isArray(capturedRows) || capturedRows.length > 1)
        return Response.json({ error: 'PayPal capture reference needs reconciliation.' }, { status: 409 });
      if (capturedRows.length === 1 && capturedRows[0].environment === environment)
        resolvedOrderId = String(capturedRows[0].order_id || '');
    }
    const orders = resolvedOrderId ? await sr.entities.PayPalOrder.filter({ order_id: resolvedOrderId }).catch(() => null) : [];
    if (!Array.isArray(orders) || orders.length > 1)
      return Response.json({ error: 'PayPal order requires reconciliation.' }, { status: 409 });
    const savedOrder = orders[0] || null;
    if (savedOrder && String(savedOrder.environment) !== environment)
      return Response.json({ error: 'PayPal order belongs to another environment.' }, { status: 409 });

    const markOrder = async (state, extra = {}) => {
      if (!savedOrder) return;
      await sr.entities.PayPalOrder.update(savedOrder.id, { state, ...extra }).catch(() => null);
    };

    // ---- Non-financial provider state -------------------------------------
    if (info.type === 'CHECKOUT.ORDER.APPROVED') {
      if (savedOrder && savedOrder.state !== 'captured') await markOrder('approved');
      await sr.entities.WebhookEvent.update(record.id, {
        state: 'nonfinancial_complete', processed_at: new Date().toISOString(),
        description: `order approved; environment=${environment}`,
      });
      return Response.json({ received: true, state: 'approved' });
    }
    if (info.type === 'PAYMENT.CAPTURE.PENDING') {
      if (savedOrder && savedOrder.state !== 'captured') await markOrder('pending');
      await sr.entities.WebhookEvent.update(record.id, {
        state: 'nonfinancial_complete', processed_at: new Date().toISOString(),
        description: `capture pending; no ledger change; environment=${environment}`,
      });
      return Response.json({ received: true, state: 'pending' });
    }
    if (info.type === 'PAYMENT.CAPTURE.DENIED') {
      if (savedOrder && savedOrder.state !== 'captured') await markOrder('denied', { last_error: 'provider_denied' });
      await sr.entities.WebhookEvent.update(record.id, {
        state: 'nonfinancial_complete', processed_at: new Date().toISOString(),
        description: `capture denied; no ledger change; environment=${environment}`,
      });
      return Response.json({ received: true, state: 'denied' });
    }

    // ---- Completed capture: reconcile to an existing canonical donation ---
    if (info.type === 'PAYMENT.CAPTURE.COMPLETED') {
      if (!info.orderId || !info.captureId)
        return Response.json({ error: 'Captured payment requires its PayPal order reference.' }, { status: 503 });
      const order = await getOrder(info.orderId, environment);
      if (!confirmedCampaignCapture(order, event))
        return Response.json({ error: 'PayPal capture and originating order disagree.' }, { status: 409 });
      const campaignId = String(order.custom_id).split('|')[0];
      const ops = await sr.entities.FinancialOperation.filter({ operation_key: 'paypal:' + info.orderId }).catch(() => []);
      if (!Array.isArray(ops) || ops.length > 1)
        return Response.json({ error: 'Canonical financial operation requires reconciliation.' }, { status: 409 });

      if (ops.length === 1) {
        const op = ops[0];
        if (op.state !== 'applied' || op.provider !== 'paypal' ||
            op.operation_type !== 'donation' || op.campaign_id !== campaignId ||
            String(op.provider_transaction_id) !== info.captureId ||
            String(op.environment || 'live') !== environment)
          return Response.json({ error: 'PayPal capture conflicts with canonical donation.' }, { status: 409 });
        await sr.entities.WebhookEvent.update(record.id, {
          state: 'financial_applied', canonical_operation_id: String(op.id),
          financial_applied_at: new Date().toISOString(),
          description: `canonical donation verified; environment=${environment}`, last_error: '',
        });
        return Response.json({ received: true, canonical_reconciled: true });
      }

      // A signed capture not present in canonical accounting is NOT a donation.
      // Never create money from a webhook; keep it visible for admin recovery.
      await sr.entities.WebhookEvent.update(record.id, {
        state: 'claimed',
        description: `awaiting_canonical_reconciliation; environment=${environment}`,
        last_error: 'no_canonical_operation',
      });
      return Response.json({ received: true, canonical_reconciled: false, pending_review: true }, { status: 202 });
    }

    // ---- Refund / reversal: reverse the exact canonical donation ----------
    if (['PAYMENT.CAPTURE.REFUNDED', 'PAYMENT.CAPTURE.REVERSED', 'CHECKOUT.PAYMENT-APPROVAL.REVERSED'].includes(info.type)) {
      if (!resolvedOrderId) {
        await sr.entities.WebhookEvent.update(record.id, {
          state: 'claimed', last_error: 'refund_order_reference_missing',
          description: 'Signed PayPal reversal cannot yet be matched to a unique order.',
        });
        return Response.json({ received: true, pending_review: true }, { status: 202 });
      }
      const ops = await sr.entities.FinancialOperation.filter({ operation_key: 'paypal:' + resolvedOrderId }).catch(() => []);
      if (!Array.isArray(ops) || ops.length > 1)
        return Response.json({ error: 'Canonical financial operation requires reconciliation.' }, { status: 409 });
      const op = ops[0] || null;
      const terminalState = info.type === 'PAYMENT.CAPTURE.REFUNDED' ? 'refunded' : 'reversed';

      if (!op) {
        // Nothing was ever booked for this order: record provider state only.
        await markOrder(terminalState);
        await sr.entities.WebhookEvent.update(record.id, {
          state: 'nonfinancial_complete', processed_at: new Date().toISOString(),
          description: `no canonical donation to reverse; environment=${environment}`,
        });
        return Response.json({ received: true, reversed: false });
      }
      if (op.state === 'cancelled') {
        await sr.entities.WebhookEvent.update(record.id, {
          state: 'side_effects_complete', processed_at: new Date().toISOString(),
          description: `already reversed; environment=${environment}`,
        });
        return Response.json({ received: true, duplicate: true });
      }
      if (String(op.environment || 'live') !== environment ||
          op.operation_type !== 'donation' || op.provider !== 'paypal' || op.state !== 'applied')
        return Response.json({ error: 'Canonical donation state or environment does not match the PayPal reversal.' }, { status: 409 });
      if (info.captureId && String(op.provider_transaction_id) !== info.captureId)
        return Response.json({ error: 'Refunded capture does not match the canonical donation.' }, { status: 409 });
      if (info.type === 'CHECKOUT.PAYMENT-APPROVAL.REVERSED') {
        // Revoked approval is NOT proof that a completed capture was refunded.
        await sr.entities.WebhookEvent.update(record.id, {
          state: 'claimed', last_error: 'approval_reversed_after_capture',
          description: 'Approval reversal arrived for an already-booked capture; manual review required.',
        });
        return Response.json({ received: true, pending_review: true }, { status: 202 });
      }
      if (info.type === 'PAYMENT.CAPTURE.REFUNDED') {
        const refund = event?.resource || {};
        const grossCents = Math.round(
          Number(savedOrder?.captured_amount || (Number(op.gross_amount) + Number(op.processing_fee))) * 100
        );
        // PayPal includes cumulative refunded amount when available. A partial
        // refund needs a proportional ledger adjustment and may not cancel the
        // entire donor gift. Queue review instead of zeroing the full donation.
        const totalRefunded = refund?.seller_payable_breakdown?.total_refunded_amount || refund?.amount || {};
        const refundedCents = Math.round(Number(totalRefunded.value) * 100);
        if (String(refund.status || '').toUpperCase() !== 'COMPLETED' ||
            String(totalRefunded.currency_code || '').toUpperCase() !== 'USD' ||
            !Number.isSafeInteger(refundedCents) || refundedCents <= 0 ||
            !Number.isSafeInteger(grossCents) || grossCents <= 0 || refundedCents > grossCents + 1)
          return Response.json({ error: 'PayPal refund amount or completion is not verified.' }, { status: 409 });
        if (refundedCents < grossCents - 1) {
          await sr.entities.WebhookEvent.update(record.id, {
            state: 'claimed', last_error: 'partial_refund_requires_adjustment',
            description: 'Partial PayPal refund requires a proportional canonical ledger adjustment.',
          });
          return Response.json({ received: true, pending_review: true, partial_refund: true }, { status: 202 });
        }
      }

      await sr.entities.FinancialOperation.update(op.id, {
        state: 'cancelled', cancelled_at: new Date().toISOString(),
        note: `PayPal ${terminalState} (${info.refundId || info.captureId || resolvedOrderId})`,
      });
      const donations = await sr.entities.Donation.filter({ canonical_operation_id: op.id }).catch(() => []);
      for (const donation of Array.isArray(donations) ? donations : []) {
        await sr.entities.Donation.update(donation.id, {
          payment_verified: false, cleared: false,
          description: `Reversed by PayPal (${terminalState}).`,
        }).catch(() => null);
      }
      const holdings = await sr.entities.HoldingLedgerEntry.filter({ canonical_operation_id: op.id }).catch(() => []);
      for (const entry of Array.isArray(holdings) ? holdings : []) {
        if (entry.state === 'settled') await sr.entities.HoldingLedgerEntry.update(entry.id, { state: 'reversed' }).catch(() => null);
      }
      await reconcileCanonicalCampaignProjection(sr, op.campaign_id);
      await markOrder(terminalState, { last_error: '' });
      await sr.entities.WebhookEvent.update(record.id, {
        state: 'side_effects_complete', processed_at: new Date().toISOString(),
        canonical_operation_id: String(op.id),
        description: `canonical donation ${terminalState}; environment=${environment}`,
      });
      return Response.json({ received: true, reversed: true, state: terminalState });
    }

    await sr.entities.WebhookEvent.update(record.id, {
      state: 'nonfinancial_complete', processed_at: new Date().toISOString(),
      description: `unhandled event type; environment=${environment}`,
    });
    return Response.json({ received: true, ignored: true });
  } catch (error) {
    console.error('payPalCampaignWebhook:', error?.name || 'UnknownError');
    return Response.json({ error: 'Webhook verification or reconciliation did not complete.' }, { status: 503 });
  }
}