import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { logAudit } from '../../shared/auditLog.ts';
import { computeContribution, round2, validateDonationAmount } from '../../shared/fees.js';
import { assertActiveAccountIfSignedIn } from '../../shared/accountGuard.ts';
import { emitActivityEvent } from '../../shared/activityEvent.ts';

// Records a donation made through PayPal or Cash App. Those flows complete on
// an external site, so the supporter confirms the gift here and the ledger,
// campaign totals, and the creator's notification are all updated together.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;

    const donorGuard = await assertActiveAccountIfSignedIn(base44);
    if (!donorGuard.ok) return Response.json({ error: donorGuard.error }, { status: donorGuard.status });
    const donor = donorGuard.donor;

    const { campaign_id, amount, donor_name, message, is_recurring, payment_method, idempotency_key, platform_contribution } = await req.json();
    const amountCheck = validateDonationAmount(amount);
    if (!amountCheck.ok) return Response.json({ error: amountCheck.error }, { status: 400 });
    if (!campaign_id) {
      return Response.json({ error: 'A campaign is required' }, { status: 400 });
    }
    const value = Number(amount);

    // Idempotency: if the client passed a key (generated once per donation
    // intent), return the existing record instead of creating a duplicate.
    if (idempotency_key) {
      const existing = await sr.entities.Donation.filter({ idempotency_key }).catch(() => []);
      if (existing && existing.length) {
        return Response.json({ ok: true, donation_id: existing[0].id, duplicate: true });
      }
    }

    const campaign = await sr.entities.Campaign.get(campaign_id).catch(() => null);
    if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });

    const contribution = computeContribution(value, !!platform_contribution);
    const gift = round2(value - contribution);
    const donation = await sr.entities.Donation.create({
      campaign_id,
      campaign_title: campaign.title,
      amount: value,
      platform_contribution: contribution,
      donor_name: donor_name || donor?.full_name || 'Anonymous',
      message: message || '',
      is_recurring: !!is_recurring,
      ...(is_recurring ? { recurring_status: 'active' } : {}),
      donor_user_id: donor?.id,
      payment_method: payment_method || 'paypal',
      ...(idempotency_key ? { idempotency_key } : {}),
    });

    // Atomic increment — avoids the read-modify-write race where two
    // concurrent donations each overwrite the other's campaign total.
    // raised_amount reflects the recipient's gift (the contribution is
    // retained by the platform).
    await sr.entities.Campaign.updateMany(
      { id: campaign_id },
      { $inc: { raised_amount: gift, donor_count: 1 } }
    );

    if (campaign.created_by_id) {
      await sr.entities.Notification.create({
        user_id: campaign.created_by_id,
        title: 'New donation received',
        body: `${donation.donor_name} gave $${value.toLocaleString()} to "${campaign.title}"`,
        type: 'donation',
        link: `/campaign/${campaign_id}`,
      });
    }

    const named = donation.donor_name && donation.donor_name !== 'Anonymous';
    await emitActivityEvent(base44, {
      type: 'donation_received',
      actor_user_id: donor?.id || undefined,
      actor_display_name: named ? donation.donor_name : 'A supporter',
      campaign_id,
      campaign_title: campaign.title,
      campaign_image_url: campaign.cover_image_url || undefined,
      body: `${named ? donation.donor_name : 'A supporter'} gave $${value.toLocaleString()} to "${campaign.title}"`,
      link: `/campaign/${campaign_id}`,
      visibility: 'public',
      metadata: { amount: value, payment_method: payment_method || 'paypal' },
    });

    await logAudit(base44, { action: 'donation_recorded', target_type: 'campaign', target_id: campaign_id, detail: `$${value} via ${payment_method || 'paypal'} recorded`, status: 'success' });
    return Response.json({ ok: true, donation_id: donation.id });
  } catch (error) {
    console.error('recordDonation error:', error.message);
    return Response.json({ error: 'Unable to record your donation. Please try again or contact support.' }, { status: 500 });
  }
}