import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const publicFields = ['id', 'campaign_id', 'amount', 'donor_name', 'message', 'created_date'];
const ownerFields = [...publicFields, 'is_recurring', 'recurring_status', 'payment_method', 'is_institutional', 'cleared', 'withdrawal_id'];

function projectDonation(donation, fields) {
  return Object.fromEntries(fields.filter((field) => donation[field] !== undefined).map((field) => [field, donation[field]]));
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    const { campaign_id, limit = 25 } = await req.json();
    if (!campaign_id || typeof campaign_id !== 'string') {
      return Response.json({ error: 'Invalid campaign request' }, { status: 400 });
    }

    const campaign = await base44.entities.Campaign.get(campaign_id);
    if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });

    const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
    const donations = await base44.asServiceRole.entities.Donation.filter(
      { campaign_id },
      '-created_date',
      safeLimit,
    );

    const isOwner = Boolean(user && campaign.created_by_id === user.id);
    const isAdmin = Boolean(user && user.role === 'admin');
    const fields = isOwner || isAdmin ? ownerFields : publicFields;

    return Response.json({
      donations: donations.map((donation) => projectDonation(donation, fields)),
      viewer: isOwner || isAdmin ? 'authorized' : 'public',
    });
  } catch (error) {
    console.error('getCampaignDonationView error:', error?.message || error);
    return Response.json({ error: 'Unable to load donation information' }, { status: 500 });
  }
}
