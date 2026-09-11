import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { logAudit } from '../../shared/auditLog.ts';

const SAFE_ERROR = 'Unable to delete your account. Please try again or contact support.';
const ALLOWED_METHOD = 'POST';
const MAX_BODY_KEYS = 0;
const MAX_DIAGNOSTIC_TYPE = 32;

function diagnosticType(value) {
  const tag = Object.prototype.toString.call(value);
  if (tag === '[object Error]') return 'error';
  if (tag === '[object String]') return 'string';
  if (tag === '[object Object]') return 'object';
  if (tag === '[object Null]') return 'null';
  if (tag === '[object Undefined]') return 'undefined';
  return tag.slice(8, -1).toLowerCase().slice(0, MAX_DIAGNOSTIC_TYPE);
}

function isExplicitNotFound(error) {
  const status = Number(error?.status ?? error?.statusCode);
  const code = String(error?.code ?? '').toUpperCase();
  return status === 404 || code === 'NOT_FOUND';
}

async function parseEmptyBody(req) {
  const raw = await req.text();
  if (!raw.trim()) return {};
  let parsed;
  try { parsed = JSON.parse(raw); } catch { throw new Response(null, { status: 400 }); }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Response(null, { status: 400 });
  if (Object.keys(parsed).length > MAX_BODY_KEYS) throw new Response(null, { status: 400 });
  return parsed;
}

export default async function(req) {
  try {
    if (req.method !== ALLOWED_METHOD) {
      return Response.json({ error: 'Method not allowed.' }, { status: 405, headers: { Allow: ALLOWED_METHOD } });
    }
    await parseEmptyBody(req);

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

    const getFreshUser = async () => {
      try {
        return await sr.entities.User.get(user.id);
      } catch (error) {
        if (isExplicitNotFound(error)) return null;
        console.error('deleteAccount user lookup failed', { diagnostic_type: diagnosticType(error) });
        throw error;
      }
    };

    const fresh = await getFreshUser();
    if (!fresh) return Response.json({ deleted: true, resumed: true });
    const resuming = !!fresh.account_deletion_pending;
    if (!resuming) await audit('account_deletion_authorized', 'success', 'Deletion authorized; no data touched yet.');

    if (!resuming) {
      await sr.entities.User.update(user.id, { account_deletion_pending: true });
      await audit('account_deletion_pending', 'success', 'Access revoked; cleanup will run next.');
    }

    const runStep = async (name, fn) => {
      try {
        await fn();
      } catch (stepErr) {
        console.error('deleteAccount step failed', { step: name, diagnostic_type: diagnosticType(stepErr) });
        await audit('account_deletion_failed', 'failure', `Step "${name}" failed.`);
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

    try {
      await sr.entities.User.delete(user.id);
      await audit('account_deleted', 'success', 'Account deleted after data wipe.');
      return Response.json({ deleted: true });
    } catch (delErr) {
      console.error('deleteAccount user deletion failed', { diagnostic_type: diagnosticType(delErr) });
      await sr.entities.User.update(user.id, {
        onboarding: {},
        comm_prefs: {},
        subscription_tier: 'free',
        subscription_status: 'none',
        subscription_renews_at: null,
        trial_end: null,
        stripe_customer_id: '',
        account_deletion_pending: true,
        account_status: 'disabled',
      });
      await audit('account_anonymized', 'success', 'Account could not be deleted; custom data anonymized.');
      return Response.json({ anonymized: true, reason: 'Account anonymized.' });
    }
  } catch (error) {
    if (error instanceof Response) {
      return error.status === 400
        ? Response.json({ error: 'Invalid request.' }, { status: 400 })
        : error;
    }
    console.error('deleteAccount failed', { diagnostic_type: diagnosticType(error) });
    return Response.json({ error: SAFE_ERROR }, { status: 500 });
  }
}
