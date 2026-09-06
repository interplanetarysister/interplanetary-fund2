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

    const { campaign_id, amount, donor_name, message, is_recurring, payment_method } = await req.json();
    const value = parseFloat(amount);
    if (!campaign_id || !value || value <= 0) {
      return Response.json({ error: 'A campaign and a positive amount are required' }, { status: 400 });
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
    });

    await sr.entities.Campaign.update(campaign_id, {
      raised_amount: (campaign.raised_amount || 0) + value,
      donor_count: (campaign.donor_count || 0) + 1,
    });

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