import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { campaign_id } = await req.json().catch(() => ({}));
    if (!campaign_id) return Response.json({ error: 'campaign_id is required' }, { status: 400 });

    const sr = base44.asServiceRole;
    const campaign = await sr.entities.Campaign.get(campaign_id).catch(() => null);
    if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });
    if (campaign.created_by_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    await sr.entities.AgentDelegation.deleteMany({ owner_user_id: campaign.created_by_id, campaign_id });
    await sr.entities.AgentActivity.deleteMany({ campaign_id });
    await sr.entities.CampaignUpdate.deleteMany({ campaign_id });
    await sr.entities.DistributedPost.deleteMany({ campaign_id });

    // Preserve financial records rather than silently deleting payment history.
    // Detach campaign-owned external connections so they cannot continue using
    // stale campaign context or automation after the campaign is gone.
    const connections = await sr.entities.PlatformConnection.filter({ created_by_id: campaign.created_by_id, campaign_id });
    for (const connection of connections) {
      await sr.entities.PlatformConnection.update(connection.id, {
        campaign_id: '',
        automation_mode: 'manual',
        agent_access: { ...(connection.agent_access || {}), automation_enabled: false },
      });
    }

    await sr.entities.Campaign.delete(campaign_id);
    return Response.json({ deleted: true });
  } catch (error) {
    console.error('deleteCampaign error:', error?.message || error);
    return Response.json({ error: 'Unable to delete this campaign.' }, { status: 500 });
  }
}
