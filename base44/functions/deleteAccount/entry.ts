import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { logAudit } from '../../shared/auditLog.ts';

// Permanently deletes the requesting user's account and all of their owned
// data, retry-safe.
//
// Step 1 — PERMISSION GATE (before any destructive action): if the user record
//   still exists, attempt User.delete. If the platform refuses (e.g. the app
//   owner cannot be deleted), STOP immediately and report the blocker — NO
//   user data is wiped, so the account is left intact. If the delete succeeds
//   (or the account was already gone from a prior partial run), proceed.
// Step 2 — DATA WIPE: every step is idempotent (deleteMany/updateMany on
//   already-empty or already-anonymized sets), so a retry after a mid-wipe
//   failure resumes cleanly. The account is already gone, so nothing
//   orphaned can remain accessible.
// Each failure is recorded in the AuditLog for observability.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const admin = base44.asServiceRole;

    // Step 1: permission gate. Verify User.delete is permitted BEFORE wiping.
    const stillExists = await admin.entities.User.get(user.id).catch(() => null);
    if (stillExists) {
      try {
        await admin.entities.User.delete(user.id);
      } catch (delErr) {
        const reason = delErr && delErr.message ? delErr.message : String(delErr);
        console.error('deleteAccount: User.delete not permitted:', reason);
        await logAudit(base44, {
          action: 'account_deletion_blocked',
          actor_user_id: user.id,
          target_type: 'user',
          target_id: user.id,
          detail: 'Account deletion is not permitted for this user.',
          status: 'failure',
        });
        return Response.json({ error: 'Your account cannot be deleted at this time. Please contact support.' }, { status: 403 });
      }
    }

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

    // Step 2: wipe data (idempotent).
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

    await runStep('connections', async () => {
      await admin.entities.PlatformConnection.deleteMany({ created_by_id: user.id });
    });

    await logAudit(base44, {
      action: 'account_deleted',
      actor_user_id: user.id,
      target_type: 'user',
      target_id: user.id,
      detail: 'Account deleted and all owned data wiped.',
      status: 'success',
    });

    return Response.json({ deleted: true });
  } catch (error) {
    console.error('deleteAccount error:', error && error.message ? error.message : error);
    return Response.json({ error: 'Unable to delete your account. Please try again or contact support.' }, { status: 500 });
  }
}