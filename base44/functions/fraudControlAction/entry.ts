import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const SAFE_ERROR = 'Unable to complete the fraud-control action.';

function requireReason(value) {
  const reason = String(value || '').trim();
  if (!reason) throw new Error('A moderation reason is required.');
  if (reason.length > 500) throw new Error('Moderation reason is too long.');
  return reason;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only.' }, { status: 403 });
    }

    const body = await req.json();
    const action = body.action;
    const now = new Date().toISOString();

    if (action === 'denyWithdrawal') {
      const withdrawalId = String(body.withdrawal_id || '').trim();
      const reason = requireReason(body.reason);
      if (!withdrawalId) return Response.json({ error: 'Withdrawal id is required.' }, { status: 400 });

      const withdrawal = await sr.entities.Withdrawal.get(withdrawalId);
      if (!withdrawal) return Response.json({ error: 'Withdrawal not found.' }, { status: 404 });
      if (withdrawal.status !== 'under_review') {
        return Response.json({ error: 'Only held withdrawals can be denied.' }, { status: 400 });
      }

      const donationIds = Array.isArray(withdrawal.covered_donation_ids) ? withdrawal.covered_donation_ids : [];
      if (donationIds.length > 0) {
        await sr.entities.Donation.updateMany(
          { id: { $in: donationIds }, withdrawal_id: withdrawal.id },
          { $set: { withdrawal_id: '' } },
        );
      }

      const result = await sr.entities.Withdrawal.updateMany(
        { id: withdrawal.id, status: 'under_review' },
        {
          $set: {
            status: 'failed',
            review_note: `Denied by admin ${user.id}: ${reason}`,
            processed_at: now,
            reviewed_by_id: user.id,
            reviewed_at: now,
          },
        },
      );

      if (!result.success || result.updated !== 1) {
        throw new Error('Withdrawal denial could not be committed.');
      }

      return Response.json({ ok: true, status: 'failed', withdrawal_id: withdrawal.id });
    }

    if (action === 'pauseCampaign' || action === 'restoreCampaign') {
      const campaignId = String(body.campaign_id || '').trim();
      const reason = requireReason(body.reason);
      if (!campaignId) return Response.json({ error: 'Campaign id is required.' }, { status: 400 });

      const expectedStatus = action === 'pauseCampaign' ? 'active' : 'paused';
      const nextStatus = action === 'pauseCampaign' ? 'paused' : 'active';
      const campaign = await sr.entities.Campaign.get(campaignId);
      if (!campaign) return Response.json({ error: 'Campaign not found.' }, { status: 404 });
      if (campaign.status !== expectedStatus) {
        return Response.json({ error: `Campaign is not ${expectedStatus}.` }, { status: 400 });
      }

      const result = await sr.entities.Campaign.updateMany(
        { id: campaignId, status: expectedStatus },
        {
          $set: {
            status: nextStatus,
            moderation_note: reason,
            moderated_by_id: user.id,
            moderated_at: now,
          },
        },
      );

      if (!result.success || result.updated !== 1) {
        throw new Error('Campaign moderation action could not be committed.');
      }

      return Response.json({ ok: true, status: nextStatus, campaign_id: campaignId });
    }

    return Response.json({ error: 'Unsupported fraud-control action.' }, { status: 400 });
  } catch (error) {
    console.error('fraudControlAction error:', error?.message || error);
    return Response.json({ error: error?.message === 'A moderation reason is required.' || error?.message === 'Moderation reason is too long.' ? error.message : SAFE_ERROR }, { status: 500 });
  }
}
