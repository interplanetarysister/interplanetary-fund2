import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Base44-native interaction persistence. Existing callers keep the same
// endpoint while the obsolete Convex bridge is removed.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const summary = String(body.summary || '').trim().slice(0, 2000);
    if (!summary) return Response.json({ error: 'Interaction summary is required.' }, { status: 400 });

    const campaignId = body.campaignId ? String(body.campaignId) : '';
    let campaign = null;
    if (campaignId) campaign = await base44.asServiceRole.entities.Campaign.get(campaignId).catch(() => null);
    if (campaign && campaign.created_by_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'You are not authorized to record activity for this campaign.' }, { status: 403 });
    }

    const activity = await base44.asServiceRole.entities.AgentActivity.create({
      campaign_id: campaignId,
      campaign_title: campaign?.title || '',
      owner_user_id: campaign?.created_by_id || user.id,
      category: 'other',
      action: `${String(body.canonicalAgentId || 'agent')}: ${String(body.action || 'conversation')}`.slice(0, 500),
      reason: summary,
      result: body.outcome ? String(body.outcome).slice(0, 2000) : '',
      status: body.approved === true ? 'approved' : body.approved === false ? 'rejected' : 'applied',
      artifact_type: 'none',
    });

    return Response.json({ ok: true, result: { id: activity.id, source: 'base44' } });
  } catch (error) {
    console.error('recordAgentInteraction error:', error?.message || error);
    return Response.json({ error: 'Unable to record the agent interaction.' }, { status: 500 });
  }
}
