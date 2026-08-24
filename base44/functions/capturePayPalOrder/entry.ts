import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { captureOrder, getOrder } from '../../shared/paypal.ts';

// Captures a PayPal order that was confirmed via Google Pay, then records the
// donation in the ledger, updates campaign totals, and notifies the creator.
// The PayPal order metadata and captured amount are authoritative for ledger
// effects; caller-supplied campaign identity is only used to cross-check them.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;

    const { order_id, campaign_id, donor_name, message } = await req.json();
    if (!order_id || !campaign_id) {
      return Response.json({ error: 'Order id and campaign are required' }, { status: 400 });
    }

    // Validate the provider source of truth before exposing any existing
    // donation record or treating this request as an idempotent replay.
    const order = await getOrder(order_id);
    if (order.campaign_id !== campaign_id || order.currency !== 'USD') {
      return Response.json({ error: 'Payment order does not match this campaign.' }, { status: 409 });
    }

    // Sequential retries are idempotent once the Donation is recorded.
    const existing = await sr.entities.Donation.filter({ paypal_order_id: order_id });
    if (existing?.[0]) {
      return Response.json({ ok: true, donation_id: existing[0].id, amount: existing[0].amount, replay: true });
    }

    let payment = order;
    if (order.status !== 'COMPLETED') {
      if (order.status !== 'APPROVED') {
        return Response.json({ error: 'Payment is not ready to be captured.' }, { status: 409 });
      }
      payment = await captureOrder(order_id);
      if (payment.status !== 'COMPLETED' || payment.campaign_id !== campaign_id || payment.currency !== 'USD') {
        return Response.json({ error: 'Payment could not be verified as a completed donation.' }, { status: 402 });
      }
    }

    const campaign = await sr.entities.Campaign.get(campaign_id);
    if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });

    let donor = null;
    try { donor = await base44.auth.me(); } catch (_) { /* supporters may be signed out */ }

    const value = Number(payment.amount);
    if (!Number.isFinite(value) || value <= 0) {
      return Response.json({ error: 'Completed payment amount could not be verified.' }, { status: 409 });
    }

    const donation = await sr.entities.Donation.create({
      campaign_id,
      campaign_title: campaign.title,
      amount: value,
      donor_name: donor_name || payment.payer_name || donor?.full_name || 'Anonymous',
      message: (message || '').slice(0, 1000),
      is_recurring: false,
      donor_user_id: donor?.id,
      payment_method: 'paypal',
      paypal_order_id: order_id,
    });

    await sr.entities.Campaign.update(campaign_id, {
      raised_amount: (campaign.raised_amount || 0) + value,
      donor_count: (campaign.donor_count || 0) + 1,
    });

    if (campaign.created_by_id) {
      await sr.entities.Notification.create({
        user_id: campaign.created_by_id,
        title: 'New donation received',
        body: `${donation.donor_name} gave $${value.toLocaleString()} to "${campaign.title}" via Google Pay`,
        type: 'donation',
        link: `/campaign/${campaign_id}`,
      });
    }

    return Response.json({ ok: true, donation_id: donation.id, amount: value });
  } catch (error) {
    console.error('capturePayPalOrder error:', error);
    return Response.json({ error: 'Unable to complete the PayPal donation. Please try again.' }, { status: 500 });
  }
}