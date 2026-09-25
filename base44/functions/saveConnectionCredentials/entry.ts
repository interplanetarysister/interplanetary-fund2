import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { logAudit } from '../../shared/auditLog.ts';
import { mergeSecrets, redactCredentials, SECRET_FIELDS } from '../../shared/integrationRegistry.ts';
import { hasAiPublishingConsent } from '../../shared/socialPublish.ts';

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
      campaign_id, automation_mode, external_total, external_currency, external_donor_count, credentials,
      browser_read_consent,
    } = body;
    if (!platform) return Response.json({ error: 'platform is required' }, { status: 400 });

    const reportedTotal = Number(external_total ?? 0);
    const reportedDonors = Number(external_donor_count ?? 0);
    if (!Number.isFinite(reportedTotal) || reportedTotal < 0) {
      return Response.json({ error: 'external_total must be a non-negative number' }, { status: 400 });
    }
    if (!Number.isInteger(reportedDonors) || reportedDonors < 0) {
      return Response.json({ error: 'external_donor_count must be a non-negative integer' }, { status: 400 });
    }

    let existing = null;
    if (connection_id) {
      existing = await base44.entities.PlatformConnection.get(connection_id).catch(() => null);
      if (!existing) return Response.json({ error: 'Connection not found' }, { status: 404 });
      if (existing.created_by_id !== user.id && user.role !== 'admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const effectiveKind = kind || existing?.kind || 'crowdfunding';
    if (typeof browser_read_consent === 'boolean' && existing && existing.created_by_id !== user.id) {
      return Response.json({ error: 'Only the connection owner can change browser access consent.' }, { status: 403 });
    }
    const effectiveCurrency = effectiveKind === 'crowdfunding'
      ? String(external_currency || existing?.external_currency || '').trim().toUpperCase()
      : undefined;
    if (effectiveCurrency && !/^[A-Z]{3}$/.test(effectiveCurrency)) {
      return Response.json({ error: 'external_currency must be a three-letter ISO currency code' }, { status: 400 });
    }

    const effectiveAutomationMode = automation_mode || existing?.automation_mode || 'manual';
    const consentOwner = existing && existing.created_by_id !== user.id
      ? await base44.asServiceRole.entities.User.get(existing.created_by_id).catch(() => null)
      : user;
    if (effectiveAutomationMode !== 'manual' && !hasAiPublishingConsent(consentOwner)) {
      return Response.json({ error: 'AI preparation and publishing authorization is required before an AI-assisted mode can be enabled.' }, { status: 403 });
    }

    const effectiveCampaignId = campaign_id || existing?.campaign_id || undefined;
    if (effectiveCampaignId) {
      const campaign = await base44.entities.Campaign.get(effectiveCampaignId).catch(() => null);
      if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });
      const connectionOwnerId = existing?.created_by_id || user.id;
      if (campaign.created_by_id !== connectionOwnerId) {
        return Response.json({ error: 'A connection and its campaign must have the same owner.' }, { status: 403 });
      }
    }

    const mergedCreds = existing ? mergeSecrets(existing.credentials, credentials) : (credentials || {});
    const now = new Date().toISOString();
    const data: any = {
      platform,
      kind: effectiveKind,
      display_name: display_name ?? existing?.display_name ?? '',
      external_url: external_url ?? existing?.external_url ?? '',
      campaign_id: effectiveCampaignId,
      automation_mode: effectiveAutomationMode,
      credentials: mergedCreds,
      external_total: reportedTotal,
      external_currency: effectiveCurrency,
      external_donor_count: reportedDonors,
      status: 'disconnected',
      verification_status: 'unverified',
      external_data_source: 'owner_reported',
      last_error: '',
      history: [...(existing?.history || []), { at: now, event: existing ? 'configuration_updated' : 'configured', detail: existing ? 'Connection settings updated; provider verification required' : `Configured ${platform}; provider verification required` }].slice(-30),
    };

    if (effectiveKind === 'crowdfunding' && typeof browser_read_consent === 'boolean') {
      const currentConsent = existing?.obo_consent || {};
      const previous = (currentConsent.granted_capabilities || []).filter((item) => item !== 'GET_METRICS');
      const grantedCapabilities = browser_read_consent ? [...previous, 'GET_METRICS'] : previous;
      data.obo_consent = {
        ...currentConsent,
        granted: browser_read_consent || (currentConsent.granted === true && previous.length > 0),
        granted_at: browser_read_consent ? now : currentConsent.granted_at,
        permission_version: browser_read_consent ? '2026-09-browser-read-v1' : currentConsent.permission_version,
        granted_capabilities: grantedCapabilities,
        requested_capabilities: browser_read_consent
          ? [...new Set([...(currentConsent.requested_capabilities || []), 'GET_METRICS'])]
          : (currentConsent.requested_capabilities || []).filter((item) => item !== 'GET_METRICS'),
      };
      data.agent_access = {
        ...(existing?.agent_access || {}),
        shared_with_agents: browser_read_consent || (existing?.agent_access?.shared_with_agents === true && previous.length > 0),
        automation_enabled: browser_read_consent || (existing?.agent_access?.automation_enabled === true && previous.length > 0),
      };
    }

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
