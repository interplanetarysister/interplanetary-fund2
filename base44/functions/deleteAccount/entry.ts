import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { logAudit } from '../../shared/auditLog.ts';

// Retry-safe account deletion state machine. The account is deleted or
// anonymized LAST — never first — so a mid-process failure leaves the user
// intact and able to retry. Each stage is recorded in the AuditLog without PII
// (only the user id is recorded; never email or name).
//
// Stage 1 — AUTHORIZE (no deletion): confirm the caller is the authenticated
//   user. A prior run already in progress (account_deletion_pending) skips
//   straight to cleanup.
// Stage 2 — MARK PENDING + REVOKE ACCESS: set account_deletion_pending. The app
//   revokes access for a pending account (frontend guard in AuthContext), so
//   the user can no longer use the platform while cleanup runs.
// Stage 3 — DATA CLEANUP: every step is idempotent (deleteMany/updateMany on
//   already-empty / already-anonymized sets), so a retry after a mid-wipe
//   failure resumes cleanly.
// Stage 4 — DELETE OR ANONYMIZE LAST: attempt User.delete. If the platform
//   refuses (e.g. the app owner cannot be deleted), anonymize the remaining
//   custom data so the account is inert; the built-in identity fields cannot
//   be cleared.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const sr = base44.asServiceRole;

    const audit = (action, status, detail) => logAudit(base44, {
      action,
      actor_user_id: user.id,
      target_type: 'user',
      target_id: user.id,
      detail: detail || '',
      status: status || 'success',
    });

    // ---- Stage 1: authorize (no deletion) ----
    const fresh = await sr.entities.User.get(user.id).catch(() => null);
    if (!fresh) {
      // Account already gone from a completed prior run.
      return Response.json({ deleted: true, resumed: true });
    }
    const resuming = !!fresh.account_deletion_pending;
    if (!resuming) {
      await audit('account_deletion_authorized', 'success', 'Deletion authorized; no data touched yet.');
    }

    // ---- Stage 2: mark pending + revoke access ----
    if (!resuming) {
      await sr.entities.User.update(user.id, { account_deletion_pending: true });
      await audit('account_deletion_pending', 'success', 'Access revoked; cleanup will run next.');
    }

    // ---- Stage 3: data cleanup (idempotent) ----
    const runStep = async (name, fn) => {
      try {
        await fn();
      } catch (stepErr) {
        const detail = stepErr && stepErr.message ? stepErr.message : String(stepErr);
        console.error(`deleteAccount step "${name}" failed:`, detail);
        await audit('account_deletion_failed', 'failure', `Step "${name}" failed: ${detail}`);
        throw stepErr;
      }
    };

    await runStep('personal_data', async () => {
      await sr.entities.FollowedCampaign.deleteMany({ user_id: user.id });
      await sr.entities.Notification.deleteMany({ user_id: user.id });
      await sr.entities.InboxItem.deleteMany({ user_id: user.id });
      await sr.entities.MissionBrief.deleteMany({ created_by_id: user.id });
      await sr.entities.Recommendation.deleteMany({ created_by_id: user.id });
      await sr.entities.Recommendation.deleteMany({ owner_user_id: user.id });
      await sr.entities.AgentActivity.deleteMany({ owner_user_id: user.id });
      await sr.entities.Message.deleteMany({ created_by_id: user.id });
      await sr.entities.CommunityMember.deleteMany({ user_id: user.id });
      await sr.entities.VolunteerSignup.deleteMany({ user_id: user.id });
      await sr.entities.DiscussionPost.deleteMany({ created_by_id: user.id });
      await sr.entities.DiscussionReply.deleteMany({ created_by_id: user.id });
      await sr.entities.GrantApplication.deleteMany({ applicant_user_id: user.id });
      await sr.entities.Withdrawal.deleteMany({ owner_user_id: user.id });
    });

    await runStep('anonymize_donations', async () => {
      await sr.entities.Donation.updateMany(
        { donor_user_id: user.id, recurring_status: 'active' },
        { $set: { recurring_status: 'cancelled' } }
      );
      await sr.entities.Donation.updateMany(
        { donor_user_id: user.id },
        { $set: { donor_user_id: '', donor_name: 'Deleted user', message: '' } }
      );
    });

    await runStep('owned_campaigns', async () => {
      const campaigns = await sr.entities.Campaign.filter({ created_by_id: user.id });
      for (const c of campaigns) {
        await sr.entities.CampaignUpdate.deleteMany({ campaign_id: c.id });
        await sr.entities.Donation.deleteMany({ campaign_id: c.id });
        await sr.entities.DistributedPost.deleteMany({ campaign_id: c.id });
        await sr.entities.AgentActivity.deleteMany({ campaign_id: c.id });
      }
      await sr.entities.Campaign.deleteMany({ created_by_id: user.id });
    });

    await runStep('connections', async () => {
      await sr.entities.PlatformConnection.deleteMany({ created_by_id: user.id });
    });

    await audit('account_deletion_cleanup_done', 'success', 'All owned data wiped.');

    // ---- Stage 4: delete or anonymize the account LAST ----
    try {
      await sr.entities.User.delete(user.id);
      await audit('account_deleted', 'success', 'Account deleted after data wipe.');
      return Response.json({ deleted: true });
    } catch (delErr) {
      // The platform refused to delete the account (e.g. the app owner). Keep
      // the account but anonymize every custom field so it is inert. The
      // built-in identity fields (id, email, full_name) cannot be cleared.
      const reason = delErr && delErr.message ? delErr.message : String(delErr);
      console.error('deleteAccount: User.delete not permitted, anonymizing:', reason);
      await sr.entities.User.update(user.id, {
        onboarding: {},
        comm_prefs: {},
        subscription_tier: 'free',
        subscription_status: 'none',
        subscription_renews_at: null,
        trial_end: null,
        stripe_customer_id: '',
        account_deletion_pending: true,
      });
      await audit('account_anonymized', 'success', 'Account could not be deleted; custom data anonymized. Built-in identity retained by the platform.');
      return Response.json({ anonymized: true, reason: 'Account anonymized.' });
    }
  } catch (error) {
    console.error('deleteAccount error:', error && error.message ? error.message : error);
    return Response.json({ error: 'Unable to delete your account. Please try again or contact support.' }, { status: 500 });
  }
}