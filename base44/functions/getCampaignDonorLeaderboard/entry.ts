import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
const HIDDEN_NAMES = /^(anonymous|anon|private|unnamed|guest)?$/i;

// Public donor leaderboard for one campaign. Only provider-verified, live
// donations are counted. Anonymous supporters are excluded entirely (never
// listed, never counted by name). Only display name and total are exposed.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const { campaign_id } = await req.json().catch(() => ({}));
    if (!campaign_id) return Response.json({ error: 'Campaign is required' }, { status: 400 });

    const campaign = await sr.entities.Campaign.get(campaign_id).catch(() => null);
    if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });
    if (campaign.status === 'draft') return Response.json({ leaderboard: [], donor_total: 0, hidden_anonymous: 0 });

    const rows = await sr.entities.Donation.filter({ campaign_id }, '-created_date', 1000);
    if (!Array.isArray(rows)) throw new Error('Unable to read donations');

    const grouped = new Map();
    let hidden = 0;
    for (const row of rows) {
      if (row.payment_verified !== true) continue;
      if (String(row.environment || 'live') !== 'live') continue;
      const name = String(row.donor_name || '').trim();
      if (!name || HIDDEN_NAMES.test(name) || /^anonymous$/i.test(name)) { hidden += 1; continue; }
      const key = name.toLowerCase();
      const entry = grouped.get(key) || { name, total: 0, gifts: 0 };
      entry.total += Number(row.amount || 0);
      entry.gifts += 1;
      grouped.set(key, entry);
    }

    const leaderboard = [...grouped.values()]
      .map((entry) => ({ name: entry.name, total: round2(entry.total), gifts: entry.gifts }))
      .filter((entry) => entry.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    return Response.json({
      leaderboard,
      donor_total: grouped.size,
      hidden_anonymous: hidden,
    });
  } catch (error) {
    console.error('getCampaignDonorLeaderboard failed:', error?.name || 'UnknownError');
    return Response.json({ error: 'Unable to load the supporter leaderboard.' }, { status: 503 });
  }
}