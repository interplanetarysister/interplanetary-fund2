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

    const now = new Date().toISOString();

    // Campaign identity is part of the canonical financial audit chain. A
    // user-facing delete request therefore archives the campaign instead of
    // hard-deleting it or its operational history. Draft status removes it
    // from public reads while retaining owner/admin recovery and every foreign
    // key used by donations, withdrawals, reservations, and provider records.
    await sr.entities.Campaign.update(campaign_id, {
      status: 'draft',
      outreach_paused: true,
      archived_at: now,
      archived_by_id: user.id,
    });

    // Stop external/agent side effects without detaching provenance.
    const connections = await sr.entities.PlatformConnection.filter({ created_by_id: campaign.created_by_id, campaign_id });
    for (const connection of connections) {
      await sr.entities.PlatformConnection.update(connection.id, {
        automation_mode: 'manual',
        agent_access: { ...(connection.agent_access || {}), automation_enabled: false },
      });
    }

    return Response.json({ archived: true, deleted: false, archived_at: now });
  } catch (error) {
    console.error('deleteCampaign error:', error?.message || error);
    return Response.json({ error: 'Unable to delete this campaign.' }, { status: 500 });
  }
}
