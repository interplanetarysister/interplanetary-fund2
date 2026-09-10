import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Compatibility endpoint retained for existing UI callers. Runtime state now
// comes directly from Base44; no Convex/Vercel endpoint, token, or registry
// entry is required. A later cleanup can rename this endpoint without breaking
// existing deployed clients.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const db = base44.asServiceRole.entities;
    const now = new Date().toISOString();

    const [agents, campaigns, reports, treasury] = await Promise.all([
      db.Agent.list(undefined, 200).catch(() => []),
      db.Campaign.list('-created_date', 500).catch(() => []),
      db.ProtocolReport.list('-generated_at', 20).catch(() => []),
      db.TreasurySnapshot.list('-created_date', 1).catch(() => []),
    ]);

    // Keep the Ops Center's monitored-campaign cache aligned with the native
    // Campaign entity without inventing financial/provider state.
    const monitored = await db.MonitoredCampaign.list(undefined, 500).catch(() => []);
    for (const c of campaigns) {
      const data = {
        if_campaign_id: String(c.id), title: String(c.title || 'Untitled'), goal_amount: Number(c.goal_amount || 0),
        raised_amount: Number(c.raised_amount || 0), status: String(c.status || 'active'), outreach_enabled: Boolean(c.outreach_enabled),
        payment_active: false, story_present: Boolean(c.story && String(c.story).trim()), cover_image_present: Boolean(c.cover_image_url),
        ai_ideal_donors: String(c.ai_profile?.ideal_donors || ''), ai_interested_orgs: String(c.ai_profile?.interested_orgs || ''), last_synced: now,
      };
      const match = monitored.find((m) => String(m.if_campaign_id) === String(c.id));
      if (match) await db.MonitoredCampaign.update(match.id, data); else await db.MonitoredCampaign.create(data);
    }

    return Response.json({
      ok: true, source: 'base44', synced_at: now,
      counts: { agents: agents.length, campaigns: campaigns.length, reports: reports.length, treasury: treasury.length > 0 },
      note: 'Runtime state is served from Base44. Payment availability remains provider-verified and is not inferred by this sync.'
    });
  } catch (error) {
    console.error('Base44 mission sync error:', error?.message || error);
    return Response.json({ error: 'Unable to refresh Base44 mission state.' }, { status: 500 });
  }
}
