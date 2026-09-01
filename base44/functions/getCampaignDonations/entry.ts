import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Returns the donation ledger for a campaign with row-level privacy enforced
// server-side:
//   - The campaign owner (creator) and admins receive the FULL records they
//     need for analytics, withdrawals, and the owner inbox.
//   - Everyone else (public supporters, signed-out visitors) receives a
//     SANITIZED view containing only donor-approved display fields — no
//     payment references, Stripe/PayPal order ids, idempotency keys, internal
//     record ids, donor user ids, or withdrawal/clearing flags. Anonymous gifts
//     (blank donor name) stay anonymous everywhere.
// The Donation entity's RLS is donor-or-admin, so owner and public reads must
// go through this service-role function rather than the user-scoped SDK.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;

    let user = null;
    try { user = await base44.auth.me(); } catch (_) { /* public visitors */ }

    const body = await req.json().catch(() => ({}));
    const campaign_id = body.campaign_id;
    if (!campaign_id) return Response.json({ error: 'Campaign is required' }, { status: 400 });

    const campaign = await sr.entities.Campaign.get(campaign_id).catch(() => null);
    if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });

    const isOwner = !!user && campaign.created_by_id === user.id;
    const isAdmin = user && user.role === 'admin';
    // Drafts are private to their owner and admins.
    if (campaign.status === 'draft' && !isOwner && !isAdmin) {
      return Response.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const donations = await sr.entities.Donation.filter({ campaign_id }, '-created_date', 1000) || [];

    if (isOwner || isAdmin) {
      return Response.json({ donations });
    }

    // Public sanitized view — donor-approved display fields only.
    const safe = donations.map((d) => ({
      donor_name: d.donor_name || 'Anonymous',
      amount: d.amount,
      is_recurring: !!d.is_recurring,
      message: d.message || '',
      created_date: d.created_date,
    }));
    return Response.json({ donations: safe });
  } catch (error) {
    console.error('getCampaignDonations error:', error && error.message ? error.message : error);
    return Response.json({ error: 'Unable to load donations.' }, { status: 500 });
  }
}