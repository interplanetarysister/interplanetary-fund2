import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { logAudit } from '../../shared/auditLog.ts';
import { mergeSecrets, redactCredentials, SECRET_FIELDS } from '../../shared/integrationRegistry.ts';

// Creates or updates a PlatformConnection, merging credential edits so secret
// values (Ko-fi token, Bluesky app password, Mastodon access token) are only
// overwritten when a new non-empty value is provided — otherwise the stored
// value is preserved. The frontend therefore never needs to round-trip raw
// secrets. The response returns redacted credentials + a credentials_meta map.
// Every save is audit-logged; logs record WHICH secret was rotated, never the
// value.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const {
      connection_id, platform, kind, display_name, external_url,
      campaign_id, automation_mode, external_total, external_donor_count, credentials,
    } = body;
    if (!platform) return Response.json({ error: 'platform is required' }, { status: 400 });

    let existing = null;
    if (connection_id) {
      existing = await base44.entities.PlatformConnection.get(connection_id).catch(() => null);
      if (!existing) return Response.json({ error: 'Connection not found' }, { status: 404 });
      if (existing.created_by_id !== user.id && user.role !== 'admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const mergedCreds = existing ? mergeSecrets(existing.credentials, credentials) : (credentials || {});
    const now = new Date().toISOString();
    const data = {
      platform,
      kind: kind || existing?.kind || 'crowdfunding',
      display_name: display_name ?? existing?.display_name ?? '',
      external_url: external_url ?? existing?.external_url ?? '',
      campaign_id: campaign_id || existing?.campaign_id || undefined,
      automation_mode: automation_mode || existing?.automation_mode || 'manual',
      credentials: mergedCreds,
      external_total: Number(external_total) || 0,
      external_donor_count: Number(external_donor_count) || 0,
      status: 'connected',
      last_synced: now,
      last_error: '',
      history: [...(existing?.history || []), { at: now, event: existing ? 'synced' : 'connected', detail: existing ? 'Details updated' : `Connected ${platform}` }].slice(-30),
    };

    let saved;
    if (existing) saved = await base44.entities.PlatformConnection.update(existing.id, data);
    else saved = await base44.entities.PlatformConnection.create(data);

    const rotated = SECRET_FIELDS.filter((f) => credentials && credentials[f]);
    await logAudit(base44, {
      action: existing ? 'connection_credentials_updated' : 'connection_created',
      actor_user_id: user.id,
      target_type: 'PlatformConnection',
      target_id: saved.id,
      detail: `${platform}: ${existing ? 'updated' : 'created'}${rotated.length ? `; secrets rotated: ${rotated.join(',')}` : ''}`,
      status: 'success',
      metadata: { platform, secrets_rotated: rotated },
    });

    const { credentials: redactedCreds, credentials_meta } = redactCredentials(saved.credentials);
    return Response.json({ connection: { ...saved, credentials: redactedCreds, credentials_meta } });
  } catch (error) {
    console.error('saveConnectionCredentials error:', error.message);
    return Response.json({ error: 'Could not save connection.' }, { status: 500 });
  }
}