import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const SAFE_ERROR = 'Unable to complete the fraud-control action.';

function requireReason(value) {
  const reason = String(value || '').trim();
  if (!reason) throw new Error('A moderation reason is required.');
  if (reason.length > 500) throw new Error('Moderation reason is too long.');
  return reason;
}

function uniqueIds(values) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}

async function clearMigrationClaim(sr, withdrawal) {
  if (!withdrawal?.campaign_id || !withdrawal?.migration_request_id) return;
  const result = await sr.entities.Campaign.updateMany(
    { id: withdrawal.campaign_id, active_migration_request_id: withdrawal.migration_request_id },
    { $unset: { active_migration_request_id: '' } },
  );
  if (!result?.success || result.updated !== 1) {
    console.error('Fraud denial migration claim reconciliation incomplete:', {
      campaign_id: withdrawal.campaign_id,
      migration_request_id: withdrawal.migration_request_id,
      withdrawal_id: withdrawal.id,
    });
  }
}

async function reconcileReservedDonations(sr, withdrawalId, donationIds) {
  const ids = uniqueIds(donationIds);
  if (!ids.length) return { complete: true, remaining: [] };

  await sr.entities.Donation.updateMany(
    { id: { $in: ids }, withdrawal_id: withdrawalId },
    { $set: { withdrawal_id: '' } },
  );

  const remaining = await sr.entities.Donation.filter({
    id: { $in: ids },
    withdrawal_id: withdrawalId,
  });

  return {
    complete: remaining.length === 0,
    remaining: remaining.map((donation) => donation.id),
  };
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

      let newlyClaimed = false;
      if (withdrawal.status === 'under_review') {
        const claim = await sr.entities.Withdrawal.updateMany(
          { id: withdrawal.id, status: 'under_review' },
          {
            $set: {
              status: 'processing',
              review_action: 'deny',
              reviewed_by_id: user.id,
              reviewed_at: now,
              review_note: `Denial in progress by admin ${user.id}: ${reason}`,
            },
          },
        );
        if (!claim.success || claim.updated !== 1) {
          return Response.json({ error: 'This withdrawal is already being processed or has changed state. Reconcile its current status before retrying.' }, { status: 409 });
        }
        newlyClaimed = true;
      } else if (withdrawal.status === 'processing' && withdrawal.review_action === 'deny') {
        // Retry of an already-claimed denial.
      } else if (withdrawal.status === 'failed' && withdrawal.review_action === 'deny') {
        // Recovery after the denial decision was committed but reservation release was incomplete.
      } else if (withdrawal.status !== 'processing') {
        return Response.json({ error: 'Only held withdrawals can be denied.' }, { status: 400 });
      } else {
        return Response.json({ error: 'This payout is already being processed for approval. Reconcile its current status before retrying.' }, { status: 409 });
      }

      if (newlyClaimed) {
        const finalize = await sr.entities.Withdrawal.updateMany(
          { id: withdrawal.id, status: 'processing', review_action: 'deny' },
          {
            $set: {
              status: 'failed',
              review_note: `Denied by admin ${user.id}: ${reason}`,
              processed_at: now,
            },
          },
        );

        if (!finalize.success || finalize.updated !== 1) {
          return Response.json({ error: 'Withdrawal denial could not be finalized. Reconcile its current state before retrying.' }, { status: 409 });
        }
      }

      const donationIds = Array.isArray(withdrawal.covered_donation_ids) ? withdrawal.covered_donation_ids : [];
      const reconciliation = await reconcileReservedDonations(sr, withdrawal.id, donationIds);
      if (!reconciliation.complete) {
        console.error('Fraud denial reconciliation incomplete:', {
          withdrawal_id: withdrawal.id,
          remaining_donation_ids: reconciliation.remaining,
        });
        return Response.json({ error: 'Withdrawal is denied and still reconciling reserved donations. Retry the denial action; the decision will not be reopened.' }, { status: 409 });
      }

      await clearMigrationClaim(sr, withdrawal);
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
    const clientError = error?.message === 'A moderation reason is required.' || error?.message === 'Moderation reason is too long.';
    return Response.json({ error: clientError ? error.message : SAFE_ERROR }, { status: clientError ? 400 : 500 });
  }
}
