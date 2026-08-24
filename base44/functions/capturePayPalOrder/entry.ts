import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { captureOrder, getOrder } from '../../shared/paypal.ts';

const STALE_CAPTURE_CLAIM_MS = 15 * 60 * 1000;

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

    const campaign = await sr.entities.Campaign.get(campaign_id);
    if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });

    // Establish a durable single-winner boundary before the provider capture.
    // The campaign record is used as the existing transactional coordination
    // surface; the claim remains until all local financial side effects are
    // reconciled, so a retry can repair partial local failure without another
    // concurrent worker entering the same order.
    const now = Date.now();
    const currentClaim = campaign.paypal_capture_claim_order_id;
    const claimedAt = campaign.paypal_capture_claimed_at
      ? new Date(campaign.paypal_capture_claimed_at).getTime()
      : NaN;
    const claimIsStale = currentClaim && Number.isFinite(claimedAt) && now - claimedAt >= STALE_CAPTURE_CLAIM_MS;

    if (currentClaim && currentClaim !== order_id && !claimIsStale) {
      return Response.json({ error: 'Another PayPal donation is currently being reconciled for this campaign. Please retry shortly.' }, { status: 409 });
    }

    if (currentClaim && currentClaim !== order_id && claimIsStale) {
      const prior = await getOrder(currentClaim).catch(() => null);
      if (prior?.status === 'COMPLETED' || prior?.status === 'APPROVED') {
        return Response.json({ error: 'A prior PayPal donation requires reconciliation before another donation can be processed.' }, { status: 409 });
      }
    }

    const claimFilter = currentClaim === order_id
      ? { id: campaign_id, paypal_capture_claim_order_id: order_id }
      : {
          id: campaign_id,
          $or: [
            { paypal_capture_claim_order_id: null },
            { paypal_capture_claim_order_id: { $exists: false } },
            { paypal_capture_claim_order_id: currentClaim || '' },
          ],
        };

    const claim = await sr.entities.Campaign.updateMany(claimFilter, {
      $set: {
        paypal_capture_claim_order_id: order_id,
        paypal_capture_claimed_at: new Date().toISOString(),
        paypal_capture_total_applied: currentClaim === order_id ? !!campaign.paypal_capture_total_applied : false,
      },
    });
    if (!claim.success || claim.updated !== 1) {
      return Response.json({ error: 'Another PayPal donation is currently being processed. Please retry shortly.' }, { status: 409 });
    }

    // Sequential and crash-recovery retries are idempotent once the Donation
    // exists. The active campaign claim prevents concurrent local side effects.
    let donation = (await sr.entities.Donation.filter({ paypal_order_id: order_id }))?.[0];

    let payment = order;
    if (!donation && order.status !== 'COMPLETED') {
      if (order.status !== 'APPROVED') {
        await sr.entities.Campaign.update(campaign_id, {
          paypal_capture_claim_order_id: null,
          paypal_capture_claimed_at: null,
          paypal_capture_total_applied: false,
        });
        return Response.json({ error: 'Payment is not ready to be captured.' }, { status: 409 });
      }
      payment = await captureOrder(order_id);
      if (payment.status !== 'COMPLETED' || payment.campaign_id !== campaign_id || payment.currency !== 'USD') {
        await sr.entities.Campaign.update(campaign_id, {
          paypal_capture_claim_order_id: null,
          paypal_capture_claimed_at: null,
          paypal_capture_total_applied: false,
        });
        return Response.json({ error: 'Payment could not be verified as a completed donation.' }, { status: 402 });
      }
    }

    let donor = null;
    try { donor = await base44.auth.me(); } catch (_) { /* supporters may be signed out */ }

    const value = Number(payment.amount || donation?.amount);
    if (!Number.isFinite(value) || value <= 0) {
      return Response.json({ error: 'Completed payment amount could not be verified.' }, { status: 409 });
    }

    if (!donation) {
      donation = await sr.entities.Donation.create({
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
    }

    // The total update and its recovery marker are one entity update. A retry
    // after a crash can therefore tell whether the campaign total was already
    // applied without relying on a separate mutable lock record.
    if (!campaign.paypal_capture_total_applied) {
      await sr.entities.Campaign.update(campaign_id, {
        raised_amount: (campaign.raised_amount || 0) + value,
        donor_count: (campaign.donor_count || 0) + 1,
        paypal_capture_total_applied: true,
      });
    }

    if (campaign.created_by_id) {
      const eventId = `paypal-donation:${order_id}`;
      const existingNotification = await sr.entities.Notification.filter({ external_event_id: eventId });
      if (!existingNotification?.[0]) {
        await sr.entities.Notification.create({
          user_id: campaign.created_by_id,
          title: 'New donation received',
          body: `${donation.donor_name} gave $${value.toLocaleString()} to "${campaign.title}" via Google Pay`,
          type: 'donation',
          link: `/campaign/${campaign_id}`,
          external_event_id: eventId,
        });
      }
    }

    await sr.entities.Campaign.update(campaign_id, {
      paypal_capture_claim_order_id: null,
      paypal_capture_claimed_at: null,
      paypal_capture_total_applied: false,
    });

    return Response.json({ ok: true, donation_id: donation.id, amount: value });
  } catch (error) {
    console.error('capturePayPalOrder error:', error);
    return Response.json({ error: 'Unable to complete the PayPal donation. Please try again.' }, { status: 500 });
  }
}
