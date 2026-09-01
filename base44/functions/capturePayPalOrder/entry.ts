import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { captureOrder } from '../../shared/paypal.ts';
import { checkRateLimit } from '../../shared/rateLimit.ts';
import { logAudit } from '../../shared/auditLog.ts';
import { computeContribution, round2, validateDonationAmount } from '../../shared/fees.js';
import { assertActiveAccountIfSignedIn } from '../../shared/accountGuard.ts';

// Captures a PayPal order that was confirmed via Google Pay, then records the
// donation in the ledger, updates campaign totals, and notifies the creator —
// mirroring recordDonation so Google Pay gifts land in the same ledger.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;

    const { order_id, campaign_id, donor_name, message, is_recurring, platform_contribution } = await req.json();
    if (!order_id || !campaign_id) {
      return Response.json({ error: 'Order id and campaign are required' }, { status: 400 });
    }

    // Idempotency: if this PayPal order was already captured and recorded,
    // return the existing donation instead of creating a duplicate.
    const existing = await sr.entities.Donation.filter({ stripe_session_id: order_id }).catch(() => []);
    if (existing && existing.length) {
      return Response.json({ ok: true, donation_id: existing[0].id, amount: existing[0].amount, duplicate: true });
    }

    let cap;
    try {
      cap = await captureOrder(order_id);
    } catch (capErr) {
      console.error('capturePayPalOrder capture error:', capErr.message);
      const fl = await checkRateLimit(base44, `captureFail:${order_id}`, 5, 600);
      if (!fl.allowed) return Response.json({ error: 'Too many failed attempts. Please try again later.' }, { status: 429 });
      await logAudit(base44, { action: 'capture_failed', target_type: 'campaign', target_id: campaign_id, detail: 'Capture failed', status: 'failure' });
      return Response.json({ error: 'Unable to complete your donation. Please try again or contact support.' }, { status: 500 });
    }
    if (cap.status !== 'COMPLETED') {
      const fl = await checkRateLimit(base44, `captureFail:${order_id}`, 5, 600);
      if (!fl.allowed) return Response.json({ error: 'Too many failed attempts. Please try again later.' }, { status: 429 });
      await logAudit(base44, { action: 'capture_failed', target_type: 'campaign', target_id: campaign_id, detail: `Capture not completed (${cap.status})`, status: 'failure' });
      return Response.json({ error: 'Payment was not completed', status: cap.status }, { status: 402 });
    }

    const campaign = await sr.entities.Campaign.get(campaign_id).catch(() => null);
    if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });

    const donorGuard = await assertActiveAccountIfSignedIn(base44);
    if (!donorGuard.ok) return Response.json({ error: donorGuard.error }, { status: donorGuard.status });
    const donor = donorGuard.donor;

    // The captured total is authoritative; the optional contribution is an
    // allocation FROM it (never added on top), directed to the platform. The
    // processing fee is covered by the platform, so it is not deducted again
    // at payout — no double-charge. Reject captures that cannot yield a valid gift.
    const totalCheck = validateDonationAmount(cap.amount);
    if (!totalCheck.ok) return Response.json({ error: totalCheck.error }, { status: 400 });
    const total = round2(cap.amount);
    const contribution = computeContribution(total, !!platform_contribution);
    const gift = round2(total - contribution);

    const donation = await sr.entities.Donation.create({
      campaign_id,
      campaign_title: campaign.title,
      amount: total,
      platform_contribution: contribution,
      donor_name: donor_name || cap.payer_name || donor?.full_name || 'Anonymous',
      message: message || '',
      is_recurring: !!is_recurring,
      ...(is_recurring ? { recurring_status: 'active' } : {}),
      donor_user_id: donor?.id,
      payment_method: 'paypal',
      stripe_session_id: order_id, // external reference id (PayPal order id)
    });

    // Atomic increment — avoids the read-modify-write race on concurrent gifts.
    // raised_amount reflects the recipient's gift (the contribution is retained
    // by the platform). Successful captures are never rate-limited.
    await sr.entities.Campaign.updateMany(
      { id: campaign_id },
      { $inc: { raised_amount: gift, donor_count: 1 } }
    );

    if (campaign.created_by_id) {
      await sr.entities.Notification.create({
        user_id: campaign.created_by_id,
        title: 'New donation received',
        body: `${donation.donor_name} gave $${total.toLocaleString()} to "${campaign.title}" via Google Pay`,
        type: 'donation',
        link: `/campaign/${campaign_id}`,
      });
    }

    await logAudit(base44, { action: 'donation_captured', target_type: 'campaign', target_id: campaign_id, detail: `$${total} via paypal captured (gift $${gift})`, status: 'success' });
    return Response.json({ ok: true, donation_id: donation.id, amount: total });
  } catch (error) {
    console.error('capturePayPalOrder error:', error.message);
    return Response.json({ error: 'Unable to complete your donation. Please try again or contact support.' }, { status: 500 });
  }
}