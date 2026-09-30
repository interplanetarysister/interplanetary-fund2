import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { logAudit } from '../../shared/auditLog.ts';
import { assertActiveAccount } from '../../shared/accountGuard.ts';

const actionSet = new Set(['deny', 'freeze', 'unfreeze']);
const reasonRequired = new Set(['deny', 'freeze']);

const text = (value, max = 500) => {
  const valueText = typeof value === 'string' ? value.trim() : '';
  return valueText.length > 0 && valueText.length <= max ? valueText : '';
};

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const guard = await assertActiveAccount(base44);
    if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });
    const user = guard.user;
    if (user.role !== 'admin') return Response.json({ error: 'Admin only.' }, { status: 403 });

    const body = await req.json();
    const action = text(body.action, 32);
    const targetId = text(body.target_id, 128);
    const reason = text(body.reason);
    if (!actionSet.has(action)) return Response.json({ error: 'Unsupported fraud-control action.' }, { status: 400 });
    if (!targetId) return Response.json({ error: 'A target identifier is required.' }, { status: 400 });
    if (reasonRequired.has(action) && !reason) return Response.json({ error: 'A reason is required.' }, { status: 400 });

    if (action === 'deny') {
      const withdrawal = await sr.entities.Withdrawal.get(targetId);
      if (!withdrawal) return Response.json({ error: 'Withdrawal not found.' }, { status: 404 });
      if (withdrawal.status !== 'under_review') return Response.json({ error: 'Only held withdrawals can be denied.' }, { status: 409 });
      await sr.entities.Withdrawal.update(targetId, { status: 'failed', review_note: reason });
      await logAudit(base44, { action: 'withdrawal_denied', target_type: 'withdrawal', target_id: targetId, detail: reason, status: 'success', metadata: { actor: user.id } });
      return Response.json({ ok: true, action, status: 'failed', target_id: targetId });
    }

    const campaign = await sr.entities.Campaign.get(targetId);
    if (!campaign) return Response.json({ error: 'Campaign not found.' }, { status: 404 });

    if (action === 'freeze') {
      if (campaign.status === 'paused') return Response.json({ ok: true, action, status: 'paused', target_id: targetId, duplicate: true });
      await sr.entities.Campaign.update(targetId, { status: 'paused', review_note: reason });
      await logAudit(base44, { action: 'campaign_frozen', target_type: 'campaign', target_id: targetId, detail: reason, status: 'success', metadata: { actor: user.id } });
      return Response.json({ ok: true, action, status: 'paused', target_id: targetId });
    }

    if (campaign.status !== 'paused') return Response.json({ error: 'Only paused campaigns can be restored.' }, { status: 409 });
    await sr.entities.Campaign.update(targetId, { status: 'active', review_note: '' });
    await logAudit(base44, { action: 'campaign_unfrozen', target_type: 'campaign', target_id: targetId, detail: 'Campaign restored to active.', status: 'success', metadata: { actor: user.id } });
    return Response.json({ ok: true, action, status: 'active', target_id: targetId });
  } catch {
    return Response.json({ error: 'The requested fraud-control action could not be completed. Please retry.' }, { status: 500 });
  }
}
