import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { hasUnifiedOboConsent } from '../../shared/integrationRegistry.ts';
import { logAudit } from '../../shared/auditLog.ts';

const ALLOWED = ['title','summary','story','category','goal_amount','cover_image_url','end_date','location'];
const clean = (v, n=12000) => typeof v === 'string' ? v.trim().slice(0,n) : v;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasUnifiedOboConsent(user)) return Response.json({ error: 'AI/OBO authorization is required to import from a connected account.' }, { status: 403 });
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
    await sr.entities.PlatformConnection.update(connection.id, { campaign_id: campaign.id });
    await logAudit(base44, { action: 'external_campaign_imported', actor_user_id: user.id, target_type: 'Campaign', target_id: campaign.id, detail: 'Created IFund draft from connected external fundraiser.', status: 'success', metadata: { platform: connection.platform, connection_id: connection.id, import_id: imported.id } });
    return Response.json({ ok: true, campaign, import_record: imported });
  } catch (error) {
    console.error('importExternalCampaign failed:', error?.message || error);
    return Response.json({ error: 'External campaign could not be imported.' }, { status: 500 });
  }
}