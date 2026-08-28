import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { captureOrder } from '../../shared/paypal.ts';

// Captures a PayPal order that was confirmed via Google Pay, then records the
// donation in the ledger. Provider order identity and amount are authoritative.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;

    const { order_id, campaign_id, donor_name, message } = await req.json();
    if (typeof order_id !== 'string' || !order_id.trim() || typeof campaign_id !== 'string' || !campaign_id.trim()) {
      return Response.json({ error: 'Order id and campaign are required' }, { status: 400 });
    }

    const orderId = order_id.trim();
    const requestedCampaignId = campaign_id.trim();

    // Sequential retries are idempotent. A true uniqueness constraint for the
    // external reference remains a backend/schema requirement for concurrent races.
    const existing = await sr.entities.Donation.filter({ stripe_session_id: orderId });
    if (existing.length > 0) {
      const prior = existing[0];
      if (prior.campaign_id !== requestedCampaignId) {
        return Response.json({ error: 'Payment order is bound to a different campaign' }, { status: 409 });
      }
      return Response.json({ ok: true, donation_id: prior.id, amount: prior.amount, idempotent: true });
    }

    const cap = await captureOrder(orderId);
    if (cap.status !== 'COMPLETED') {
      return Response.json({ error: 'Payment was not completed', status: cap.status }, { status: 402 });
    }
    if (cap.campaign_id !== requestedCampaignId) {
      return Response.json({ error: 'Payment order does not match the requested campaign' }, { status: 409 });
    }
    if (!Number.isFinite(cap.amount) || cap.amount <= 0) {
      return Response.json({ error: 'Payment amount could not be verified' }, { status: 422 });
    }

    const campaign = await sr.entities.Campaign.get(requestedCampaignId);
    if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });

    let donor = null;
    try { donor = await base44.auth.me(); } catch (_) { /* supporters may be signed out */ }

    const safeDonorName = typeof donor_name === 'string' ? donor_name.trim().slice(0, 160) : '';
    const safeMessage = typeof message === 'string' ? message.trim().slice(0, 2000) : '';
    const value = cap.amount;
    const donation = await sr.entities.Donation.create({
      campaign_id: requestedCampaignId,
      campaign_title: campaign.title,
      amount: value,
      donor_name: safeDonorName || cap.payer_name || donor?.full_name || 'Anonymous',
      message: safeMessage,
      is_recurring: false,
      donor_user_id: donor?.id,
      payment_method: 'paypal',
      stripe_session_id: orderId,
    });

    await sr.entities.Campaign.update(requestedCampaignId, {
      raised_amount: (campaign.raised_amount || 0) + value,
      donor_count: (campaign.donor_count || 0) + 1,
    });

    if (campaign.created_by_id) {
      await sr.entities.Notification.create({
        user_id: campaign.created_by_id,
        title: 'New donation received',
        body: `${donation.donor_name} gave $${value.toLocaleString()} to "${campaign.title}" via Google Pay`,
        type: 'donation',
        link: `/campaign/${requestedCampaignId}`,
      });
    }

    return Response.json({ ok: true, donation_id: donation.id, amount: value, idempotent: false });
  } catch (error) {
    console.error('capturePayPalOrder error:', error);
    return Response.json({ error: 'Unable to finalize the payment at this time' }, { status: 500 });
  }
}
