import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { logAudit } from '../../shared/auditLog.ts';

// Permanently deletes the requesting user's account and all of their owned
// data. Order: owned/related data is deleted FIRST (each step idempotent), and
// the account itself is deleted LAST. If any data step fails, the function
// returns an error WITHOUT deleting the account, so the user can retry — every
// data step is a no-op on a second pass (deleteMany/updateMany on already-empty
// or already-anonymized sets), making the whole sequence safely resumable.
// Each failure is recorded in the AuditLog for observability.
export default async function(req) {
  let user = null;
  try {
    const base44 = createClientFromRequest(req);
    user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const admin = base44.asServiceRole;

    const runStep = async (name, fn) => {
      try {
        await fn();
      } catch (stepErr) {
        const detail = stepErr && stepErr.message ? stepErr.message : String(stepErr);
        console.error(`deleteAccount step "${name}" failed:`, detail);
        await logAudit(base44, {
          action: 'account_deletion_failed',
          actor_user_id: user.id,
          target_type: 'user',
          target_id: user.id,
          detail: `Step "${name}" failed: ${detail}`,
          status: 'failure',
        });
        throw stepErr;
      }
    };

    // 1. Personal data
    await runStep('personal_data', async () => {
      await admin.entities.FollowedCampaign.deleteMany({ user_id: user.id });
      await admin.entities.Notification.deleteMany({ user_id: user.id });
      await admin.entities.InboxItem.deleteMany({ user_id: user.id });
      await admin.entities.MissionBrief.deleteMany({ created_by_id: user.id });
      await admin.entities.Recommendation.deleteMany({ created_by_id: user.id });
      await admin.entities.Recommendation.deleteMany({ owner_user_id: user.id });
      await admin.entities.AgentActivity.deleteMany({ owner_user_id: user.id });
      await admin.entities.Message.deleteMany({ created_by_id: user.id });
      await admin.entities.CommunityMember.deleteMany({ user_id: user.id });
      await admin.entities.VolunteerSignup.deleteMany({ user_id: user.id });
      await admin.entities.DiscussionPost.deleteMany({ created_by_id: user.id });
      await admin.entities.DiscussionReply.deleteMany({ created_by_id: user.id });
      await admin.entities.GrantApplication.deleteMany({ applicant_user_id: user.id });
      await admin.entities.Withdrawal.deleteMany({ owner_user_id: user.id });
    });

    // 2. Anonymize donations this user made to OTHER people's campaigns — the
    //    campaign owner still needs the ledger entry, but the donor's identity
    //    is removed. Cancel active recurring gifts first, then strip the PII.
    await runStep('anonymize_donations', async () => {
      await admin.entities.Donation.updateMany(
        { donor_user_id: user.id, recurring_status: 'active' },
        { $set: { recurring_status: 'cancelled' } }
      );
      await admin.entities.Donation.updateMany(
        { donor_user_id: user.id },
        { $set: { donor_user_id: '', donor_name: 'Deleted user', message: '' } }
      );
    });

    // 3. Owned campaigns and everything attached to them
    await runStep('owned_campaigns', async () => {
      const campaigns = await admin.entities.Campaign.filter({ created_by_id: user.id });
      for (const c of campaigns) {
        await admin.entities.CampaignUpdate.deleteMany({ campaign_id: c.id });
        await admin.entities.Donation.deleteMany({ campaign_id: c.id });
        await admin.entities.DistributedPost.deleteMany({ campaign_id: c.id });
        await admin.entities.AgentActivity.deleteMany({ campaign_id: c.id });
      }
      await admin.entities.Campaign.deleteMany({ created_by_id: user.id });
    });

    // 4. Connections
    await runStep('connections', async () => {
      await admin.entities.PlatformConnection.deleteMany({ created_by_id: user.id });
    });

    // 5. Account LAST — only after all owned data is gone.
    await admin.entities.User.delete(user.id);
    await logAudit(base44, {
      action: 'account_deleted',
      actor_user_id: user.id,
      target_type: 'user',
      target_id: user.id,
      detail: 'Account and all owned data deleted.',
      status: 'success',
    });

    return Response.json({ deleted: true });
  } catch (error) {
    console.error('deleteAccount error:', error && error.message ? error.message : error);
    return Response.json({ error: 'Unable to delete your account. Please try again or contact support.' }, { status: 500 });
  }
}