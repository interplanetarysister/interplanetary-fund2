import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { logAudit } from '../../shared/auditLog.ts';

const ALLOWED = ['title','summary','story','category','goal_amount','cover_image_url','end_date','location'];
const clean = (v, n=12000) => typeof v === 'string' ? v.trim().slice(0,n) : v;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const connection = await base44.entities.PlatformConnection.get(body.connection_id).catch(() => null);
    if (!connection || connection.created_by_id !== user.id || connection.kind !== 'crowdfunding') return Response.json({ error: 'Connected fundraising account not found.' }, { status: 404 });
    const incoming = body.campaign && typeof body.campaign === 'object' ? body.campaign : {};
    const payload:any = { status: 'draft' };
    for (const key of ALLOWED) if (incoming[key] !== undefined && incoming[key] !== null) payload[key] = clean(incoming[key], key === 'story' ? 30000 : 4000);
    payload.title = clean(payload.title || connection.display_name || ('Imported ' + connection.platform + ' campaign'), 200);
    payload.goal_amount = Number(payload.goal_amount || 1);
    if (!(payload.goal_amount > 0)) payload.goal_amount = 1;
    if (!['medical','emergency','education','community','animals','business','memorial','disaster_relief','creative','other'].includes(payload.category)) payload.category = 'other';

    const sr = base44.asServiceRole;
    const existingImports = await sr.entities.ExternalCampaignImport.filter({ owner_user_id: user.id, connection_id: connection.id }, '-updated_date', 1).catch(() => []);
    if (existingImports[0]?.campaign_id) return Response.json({ ok: true, duplicate: true, campaign_id: existingImports[0].campaign_id, import_record: existingImports[0] });

    const campaign = await base44.entities.Campaign.create(payload);
    const provenance:any = {};
    for (const key of ALLOWED) if (payload[key] !== undefined) provenance[key] = { source: connection.platform, connection_id: connection.id, imported_at: new Date().toISOString(), source_value: payload[key] };
    const imported = await base44.entities.ExternalCampaignImport.create({
      owner_user_id: user.id, connection_id: connection.id, platform: connection.platform,
      external_campaign_id: String(body.external_campaign_id || ''), external_url: connection.external_url || '',
      campaign_id: campaign.id, sync_enabled: body.sync_enabled !== false,
      last_imported_at: new Date().toISOString(), field_provenance: provenance, locally_locked_fields: [], status: 'imported'
    });
    // Converge: concurrent import calls for the same owner+connection may each
    // pass the duplicate check and create a campaign + import record. Keep the
    // earliest import as canonical, link the connection to it, and delete the
    // duplicate campaign + import so the invariant holds: one owner + one
    // connection → one imported campaign.
    const allImports = await sr.entities.ExternalCampaignImport.filter({ owner_user_id: user.id, connection_id: connection.id }, 'created_date', 10).catch(() => []);
    if (allImports.length > 1) {
      const ordered = [...allImports].sort((a, b) => {
        const at = new Date(a.created_date || 0).getTime();
        const bt = new Date(b.created_date || 0).getTime();
        if (at !== bt) return at - bt;
        return String(a.id || '').localeCompare(String(b.id || ''));
      });
      const canonical = ordered[0];
      // Re-link the connection to the canonical campaign BEFORE any destructive
      // cleanup, so the connection never points to a deleted record.
      await sr.entities.PlatformConnection.update(connection.id, { campaign_id: canonical.campaign_id });

      for (const dup of ordered.slice(1)) {
        // Do NOT assume a duplicate campaign is safe to delete merely because
        // its import lost the race. Check for dependent entities first —
        // donations, financial operations, posts, updates, connections,
        // withdrawals, follows. If any exist, preserve the campaign and just
        // re-point the import record to the canonical campaign.
        if (dup.campaign_id && dup.campaign_id !== canonical.campaign_id) {
          const [donations, finOps, posts, updates, conns, withdrawals, follows] = await Promise.all([
            sr.entities.Donation.filter({ campaign_id: dup.campaign_id }, '-created_date', 1).catch(() => []),
            sr.entities.FinancialOperation.filter({ campaign_id: dup.campaign_id }, '-created_date', 1).catch(() => []),
            sr.entities.SocialPost.filter({ campaign_id: dup.campaign_id }, '-created_date', 1).catch(() => []),
            sr.entities.CampaignUpdate.filter({ campaign_id: dup.campaign_id }, '-created_date', 1).catch(() => []),
            sr.entities.PlatformConnection.filter({ campaign_id: dup.campaign_id }, '-created_date', 1).catch(() => []),
            sr.entities.Withdrawal.filter({ campaign_id: dup.campaign_id }, '-created_date', 1).catch(() => []),
            sr.entities.FollowedCampaign.filter({ campaign_id: dup.campaign_id }, '-created_date', 1).catch(() => []),
          ]);
          const hasDeps = (donations?.length || 0) + (finOps?.length || 0) + (posts?.length || 0) +
            (updates?.length || 0) + (conns?.length || 0) + (withdrawals?.length || 0) + (follows?.length || 0) > 0;
          if (hasDeps) {
            // Preserve the campaign — it has user/financial content. Mark it
            // as a duplicate but do not destroy it.
            await sr.entities.Campaign.update(dup.campaign_id, { status: 'completed' }).catch(() => {});
          } else {
            await sr.entities.Campaign.delete(dup.campaign_id).catch(() => {});
          }
        }
        await sr.entities.ExternalCampaignImport.delete(dup.id).catch(() => {});
      }
      await sr.entities.ExternalCampaignImport.update(canonical.id, { last_imported_at: new Date().toISOString() }).catch(() => {});
      const canonicalCampaign = canonical.campaign_id ? await base44.entities.Campaign.get(canonical.campaign_id).catch(() => null) : null;
      await logAudit(base44, { action: 'external_campaign_imported', actor_user_id: user.id, target_type: 'Campaign', target_id: canonical.campaign_id, detail: 'Created IFund draft from connected external fundraiser; converged concurrent import to one canonical record.', status: 'success', metadata: { platform: connection.platform, connection_id: connection.id, import_id: canonical.id } });
      return Response.json({ ok: true, duplicate: true, campaign: canonicalCampaign, import_record: canonical });
    }
    await sr.entities.PlatformConnection.update(connection.id, { campaign_id: campaign.id });
    await logAudit(base44, { action: 'external_campaign_imported', actor_user_id: user.id, target_type: 'Campaign', target_id: campaign.id, detail: 'Created IFund draft from connected external fundraiser.', status: 'success', metadata: { platform: connection.platform, connection_id: connection.id, import_id: imported.id } });
    return Response.json({ ok: true, campaign, import_record: imported });
  } catch (error) {
    console.error('importExternalCampaign failed:', error?.message || error);
    return Response.json({ error: 'External campaign could not be imported.' }, { status: 500 });
  }
}