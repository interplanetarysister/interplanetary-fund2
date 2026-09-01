import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Records a donation made through PayPal or Cash App. Those flows complete on
// an external site, so the supporter confirms the gift here and the ledger,
// campaign totals, and the creator's notification are all updated together.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;

    let donor = null;
    try { donor = await base44.auth.me(); } catch (_) { /* supporters may be signed out */ }

    const { campaign_id, amount, donor_name, message, is_recurring, payment_method, idempotency_key } = await req.json();
    const value = parseFloat(amount);
    if (!campaign_id || !value || value <= 0) {
      return Response.json({ error: 'A campaign and a positive amount are required' }, { status: 400 });
    }

    // Idempotency: if the client passed a key (generated once per donation
    // intent), return the existing record instead of creating a duplicate.
    if (idempotency_key) {
      const existing = await sr.entities.Donation.filter({ idempotency_key }).catch(() => []);
      if (existing && existing.length) {
        return Response.json({ ok: true, donation_id: existing[0].id, duplicate: true });
      }
    }

    const campaign = await sr.entities.Campaign.get(campaign_id);
    if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });

    const donation = await sr.entities.Donation.create({
      campaign_id,
      campaign_title: campaign.title,
      amount: value,
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
    await sr.entities.Campaign.updateMany(
      { id: campaign_id },
      { $inc: { raised_amount: value, donor_count: 1 } }
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

    return Response.json({ ok: true, donation_id: donation.id });
  } catch (error) {
    console.error('recordDonation error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}