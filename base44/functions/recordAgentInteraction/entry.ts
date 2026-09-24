import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const requestedAgent = String(body.canonicalAgentId || body.agentName || '').trim();
    if (!requestedAgent) return Response.json({ error: 'Agent is required.' }, { status: 400 });
    const summary = String(body.summary || '').slice(0, 2000);
    const outcome = body.outcome ? String(body.outcome).slice(0, 2000) : '';
    const campaignId = body.campaignId ? String(body.campaignId) : '';
    let campaignTitle = '';
    if (campaignId) {
      const campaign = await sr.entities.Campaign.get(campaignId).catch(() => null);
      if (!campaign) return Response.json({ error: 'Campaign not found.' }, { status: 404 });
      if (campaign.created_by_id !== user.id && user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
      campaignTitle = String(campaign.title || '');
    }
    const record = await sr.entities.AgentActivity.create({
      campaign_id: campaignId || ('user:' + user.id),
      campaign_title: campaignTitle,
      owner_user_id: user.id,
      category: 'other',
      action: String(body.action || 'conversation').slice(0, 500),
      reason: summary || 'Agent interaction',
      result: outcome,
      expected_impact: '',
      recommended_next_actions: [],
      artifact_type: 'none',
      status: body.approved === true ? 'approved' : 'pending',
      description: JSON.stringify({ agent_id: requestedAgent, source: String(body.source || 'base44_agent_chat').slice(0, 100), approved: typeof body.approved === 'boolean' ? body.approved : null }),
    });
    return Response.json({ ok: true, result: { id: record.id, stored_in: 'base44' } });
  } catch (error) {
    console.error('recordAgentInteraction error:', error?.message || error);
    return Response.json({ error: 'Unable to record the agent interaction.' }, { status: 500 });
  }
}