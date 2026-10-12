import { isFeatureEnabled, featureUnavailable } from '../../shared/featureFlagGate.ts';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { logAudit } from '../../shared/auditLog.ts';
import { beginExternalSyncRequest, crowdfundingConnectionEligibility, failExternalSyncRequest, finishExternalSyncRequest, validExternalSyncRequestId } from '../../shared/externalSyncRequest.ts';
import { discoverPublicCampaignSnapshot } from './publicCampaignSnapshot.ts';

const ALLOWED = ['title','summary','story','category','goal_amount','cover_image_url','end_date','location'];

export default async function(req) {
  let base44; let sr; let run; let claimKey; let user; let requestId = '';
  try {
    base44 = createClientFromRequest(req);
    const activeAccount = await assertActiveAccount(base44);
    if (!activeAccount.ok) return Response.json({ error: activeAccount.error }, { status: activeAccount.status });
    if (!(await isFeatureEnabled(base44, 'external_campaign_import'))) return featureUnavailable('External campaign import');
    user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    requestId = String(body.request_id || '').trim();
    if (!validExternalSyncRequestId(requestId)) return Response.json({ error: 'A valid request_id is required for an explicit import.' }, { status: 400 });
    sr = base44.asServiceRole;
    const connection = await sr.entities.PlatformConnection.get(body.connection_id);
    const eligibility = crowdfundingConnectionEligibility(connection, user.id);
    if (!eligibility.ok) return Response.json({ error: 'Connected, verified fundraiser authorization is required.' }, { status: 409 });
    const existingImports = await sr.entities.ExternalCampaignImport.filter({ owner_user_id: user.id, connection_id: connection.id }, 'created_date', 2);
    if (existingImports[0]?.campaign_id) {
      const campaign = await sr.entities.Campaign.get(existingImports[0].campaign_id);
      return Response.json({ ok: true, duplicate: true, request_id: requestId, campaign_id: campaign.id, campaign, import_record: existingImports[0] });
    }
    const incoming = body.campaign && typeof body.campaign === 'object' ? body.campaign : {};
    const ownerGoal = Number(incoming.goal_amount);
    if (!(Number.isFinite(ownerGoal) && ownerGoal > 0)) return Response.json({ error: 'Enter a campaign goal before importing this fundraiser.' }, { status: 400 });
    const fingerprint = JSON.stringify({ connection_id: connection.id, goal_amount: ownerGoal });
    const request = await beginExternalSyncRequest(sr, { jobType: 'campaign_import', actorUserId: user.id, requestId, fingerprint, scope: 'user' });
    if (request.disposition === 'completed') return Response.json({ ...(request.run.result_payload || {}), deduplicated: true });
    if (request.disposition === 'in_progress') return Response.json({ ok: false, request_id: requestId, status: 'in_progress', deduplicated: true }, { status: 202 });
    run = request.run; claimKey = request.claimKey;
    const snapshot = await discoverPublicCampaignSnapshot(connection);
    const payload:any = { status: 'draft', ...snapshot.campaign, goal_amount: ownerGoal };
    const campaign = await base44.entities.Campaign.create(payload);
    const provenance:any = {};
    const importedAt = new Date().toISOString();
    for (const key of ALLOWED) {
      if (payload[key] === undefined) continue;
      provenance[key] = { source: key === 'goal_amount' ? 'owner_supplied' : key === 'category' ? 'system_default' : snapshot.source, connection_id: connection.id, imported_at: importedAt, source_value: payload[key] };
    }
    const imported = await base44.entities.ExternalCampaignImport.create({ owner_user_id: user.id, connection_id: connection.id, platform: connection.platform, external_campaign_id: String(body.external_campaign_id || ''), external_url: snapshot.source_url, campaign_id: campaign.id, sync_enabled: false, last_imported_at: importedAt, field_provenance: provenance, locally_locked_fields: [], status: 'imported' });
    await sr.entities.PlatformConnection.update(connection.id, { campaign_id: campaign.id });
    const result = { ok: true, request_id: requestId, campaign_id: campaign.id, campaign, import_record: imported };
    await finishExternalSyncRequest(sr, run, claimKey, { overall_status: 'success', campaign_id: campaign.id, result_payload: result, description: 'Explicit external campaign import completed.' });
    await logAudit(base44, { action: 'external_campaign_imported', actor_user_id: user.id, target_type: 'Campaign', target_id: campaign.id, detail: 'Created IFund draft from one explicit connected external fundraiser request.', status: 'success', metadata: { request_id: requestId, request_origin: 'explicit_authenticated_action', platform: connection.platform, connection_id: connection.id, import_id: imported.id } });
    return Response.json(result);
  } catch (error) {
    console.error('importExternalCampaign failed:', error?.name || 'UnknownError');
    if (sr && run && claimKey) await failExternalSyncRequest(sr, run, claimKey, 'Explicit external campaign import failed.').catch(() => {});
    if (base44 && user?.id) await logAudit(base44, { action: 'external_campaign_import_failed', actor_user_id: user.id, target_type: 'SyncRun', target_id: run?.id || requestId, detail: 'Explicit external campaign import failed safely.', status: 'failure', metadata: { request_id: requestId || null, reason: error?.code || 'provider_error' } }).catch(() => {});
    return Response.json({ error: error?.message || 'External campaign could not be imported.' }, { status: error?.status || 500 });
  }
}
