import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { OAUTH_ENV } from '../../shared/connectionVerification.ts';
import { validateManagedResume } from '../../shared/managedConnectionContinuation.ts';
import { hasManagedConnections } from '../../shared/subscriptionEntitlements.ts';

const COMMON_IF_CAPABILITIES = [
  'read_account', 'read_resources', 'read_campaign', 'manage_campaign',
  'create_post', 'edit_post', 'delete_own_post', 'upload_media',
  'read_interactions', 'comment', 'reply_comment', 'read_messages', 'reply_message',
  'discover', 'follow', 'join', 'read_analytics',
  'read_donations', 'read_payments', 'read_transactions', 'read_balance',
  'subscribe_events', 'reconcile_external_funds', 'settlement_status', 'transfer_or_payout',
];

const CONFIG: Record<string, { kind: string; requestedCapabilities: string[] }> = {
  gmail: { kind: 'app', requestedCapabilities: COMMON_IF_CAPABILITIES },
  googledrive: { kind: 'app', requestedCapabilities: COMMON_IF_CAPABILITIES },
  googlecalendar: { kind: 'app', requestedCapabilities: COMMON_IF_CAPABILITIES },
  google_contacts: { kind: 'app', requestedCapabilities: COMMON_IF_CAPABILITIES },
  google_photos: { kind: 'app', requestedCapabilities: COMMON_IF_CAPABILITIES },
  googlesheets: { kind: 'app', requestedCapabilities: COMMON_IF_CAPABILITIES },
  googledocs: { kind: 'app', requestedCapabilities: COMMON_IF_CAPABILITIES },
  googleforms: { kind: 'app', requestedCapabilities: COMMON_IF_CAPABILITIES },
  googletasks: { kind: 'app', requestedCapabilities: COMMON_IF_CAPABILITIES },
  slack: { kind: 'app', requestedCapabilities: COMMON_IF_CAPABILITIES },
  notion: { kind: 'app', requestedCapabilities: COMMON_IF_CAPABILITIES },
  outlook: { kind: 'app', requestedCapabilities: COMMON_IF_CAPABILITIES },
  microsoft_teams: { kind: 'app', requestedCapabilities: COMMON_IF_CAPABILITIES },
  one_drive: { kind: 'app', requestedCapabilities: COMMON_IF_CAPABILITIES },
  dropbox: { kind: 'app', requestedCapabilities: COMMON_IF_CAPABILITIES },
  github: { kind: 'app', requestedCapabilities: COMMON_IF_CAPABILITIES },
  gitlab: { kind: 'app', requestedCapabilities: COMMON_IF_CAPABILITIES },

  // Request the complete foreseeable IF capability envelope once. These are
  // desired capabilities only; provider-reported scopes remain the sole source
  // for what is actually granted and usable.
  linkedin: { kind: 'social', requestedCapabilities: COMMON_IF_CAPABILITIES },
  facebook: { kind: 'social', requestedCapabilities: COMMON_IF_CAPABILITIES },
  instagram: { kind: 'social', requestedCapabilities: COMMON_IF_CAPABILITIES },
  discord: { kind: 'social', requestedCapabilities: COMMON_IF_CAPABILITIES },
  tiktok: { kind: 'social', requestedCapabilities: COMMON_IF_CAPABILITIES },
  threads: { kind: 'social', requestedCapabilities: COMMON_IF_CAPABILITIES },
  x: { kind: 'social', requestedCapabilities: COMMON_IF_CAPABILITIES },
  pinterest: { kind: 'social', requestedCapabilities: COMMON_IF_CAPABILITIES },
  reddit: { kind: 'social', requestedCapabilities: COMMON_IF_CAPABILITIES },
  youtube: { kind: 'social', requestedCapabilities: COMMON_IF_CAPABILITIES },
  patreon: { kind: 'crowdfunding', requestedCapabilities: COMMON_IF_CAPABILITIES },
  eventbrite: { kind: 'crowdfunding', requestedCapabilities: COMMON_IF_CAPABILITIES },
  gumroad: { kind: 'crowdfunding', requestedCapabilities: COMMON_IF_CAPABILITIES },
};

function providerCapabilities(oauth: any): string[] {
  // Base44 connector responses vary by provider. Only persist capabilities when
  // the provider/connector explicitly reports them. Access-token presence proves
  // connection transport, not every desired permission.
  const raw = oauth?.capabilities || oauth?.grantedCapabilities || oauth?.scopes || oauth?.scope;
  const values = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(/[ ,]+/)
      : [];
  return [...new Set(values.map((v) => String(v).trim()).filter(Boolean))];
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { platform, delegation_id, consent_version, request_key, requested_action } = await req.json().catch(() => ({}));
    const key = String(platform || '').toLowerCase();
    const cfg = CONFIG[key];
    // Canonical IFund-wide OBO is the sole authorization decision. Provider
    // OAuth can still connect while IFund help is off, but delegated agent access
    // remains disabled until setUnifiedOboConsent records an explicit grant.
    const sharedAgentConsent = user.ai_obo_consent?.granted === true;
    const currentConsentVersion = String(user.ai_obo_consent?.permission_version || '').trim();
    let resumeDelegation: any = null;
    if (delegation_id) {
      resumeDelegation = await base44.entities.AgentDelegation.get(String(delegation_id));
      if (!hasManagedConnections(user)) {
        await base44.entities.AgentDelegation.update(resumeDelegation.id, {
          status: 'waiting_user',
          updated_at: new Date().toISOString(),
          result_summary: 'Managed Connections requires an active eligible subscription before this setup can resume.',
          continuation_state: {
            ...(resumeDelegation.continuation_state || {}),
            pending_step: 'resume_after_subscription',
            external_requirement: 'Restore an eligible subscription to resume Managed Connections.',
          },
        });
        return Response.json({ error: 'Managed Connections requires an active eligible subscription.' }, { status: 403 });
      }
      const resumeError = validateManagedResume({
        delegation: resumeDelegation,
        ownerUserId: user.id,
        consentGranted: sharedAgentConsent,
        consentVersion: currentConsentVersion,
        requestKey: String(request_key || ''),
        platform: key,
        action: String(requested_action || ''),
      });
      if (resumeError || String(consent_version || '') !== currentConsentVersion) {
        return Response.json({ error: 'This managed connection request cannot be resumed with the current owner and authorization.' }, { status: 403 });
      }
    }
    const envName = OAUTH_ENV[key];
    const connectorId = cfg && envName ? (Deno.env.get(envName) || '') : '';
    if (!cfg || !connectorId) return Response.json({ configured: false, connected: false });

    let oauth: any;
    try {
      oauth = await base44.asServiceRole.connectors.getCurrentAppUserConnection(connectorId);
      if (!oauth?.accessToken) return Response.json({ configured: true, connected: false });
    } catch {
      return Response.json({ configured: true, connected: false });
    }

    const existingRows = await base44.entities.PlatformConnection.filter({ created_by_id: user.id, platform: key });
    const resumeCampaignId = String(resumeDelegation?.campaign_id || '');
    if (resumeCampaignId) {
      const resumeCampaign = await base44.entities.Campaign.get(resumeCampaignId).catch(() => null);
      if (!resumeCampaign || resumeCampaign.created_by_id !== user.id) {
        return Response.json({ error: 'The campaign selected for this managed connection is no longer available.' }, { status: 409 });
      }
      if ((existingRows || []).some((row: any) => row?.campaign_id && row.campaign_id !== resumeCampaignId)) {
        return Response.json({ error: 'This provider connection is already linked to a different campaign.' }, { status: 409 });
      }
    }
    const existing = (existingRows || []).find((row: any) =>
      !resumeCampaignId || row?.campaign_id === resumeCampaignId || !row?.campaign_id
    ) || null;
    const now = new Date().toISOString();
    const confirmed = providerCapabilities(oauth);
    const data = {
      platform: key,
      kind: cfg.kind,
      display_name: existing?.display_name || key,
      external_url: existing?.external_url || '',
      campaign_id: resumeCampaignId || existing?.campaign_id || undefined,
      automation_mode: sharedAgentConsent ? (existing?.automation_mode || 'auto') : 'manual',
      obo_consent: {
        granted: sharedAgentConsent,
        granted_at: sharedAgentConsent ? now : null,
        permission_version: currentConsentVersion || '2026-10-unified-obo-v1',
        requested_capabilities: cfg.requestedCapabilities,
        // Never copy desired capabilities into granted/provider capabilities.
        // Unknown remains unknown until the connector/provider reports it.
        granted_capabilities: sharedAgentConsent ? confirmed : [],
        provider_capabilities: confirmed,
      },
      agent_access: {
        shared_with_agents: sharedAgentConsent,
        automation_enabled: sharedAgentConsent && (existing?.automation_mode || 'auto') === 'auto',
      },
      // OAuth token presence proves authorization material exists. A harmless
      // provider call must still succeed before the connection is shown as working.
      status: 'disconnected',
      verification_status: 'unverified',
      capability_status: confirmed.length ? 'confirmed' : 'unknown',
      external_data_source: existing?.external_data_source || 'owner_reported',
      last_error: 'Provider authorization saved; live verification is still required.',
      history: [...(existing?.history || []), {
        at: now,
        event: 'oauth_authorized',
        detail: confirmed.length
          ? `Provider authorization saved; ${confirmed.length} provider-reported capabilities recorded; live verification required`
          : 'Provider authorization saved; detailed provider capabilities were not reported and remain unknown; live verification required',
      }].slice(-30),
    };
    const saved = existing
      ? await base44.entities.PlatformConnection.update(existing.id, data)
      : await base44.entities.PlatformConnection.create(data);
    if (resumeDelegation) {
      await base44.entities.AgentDelegation.update(resumeDelegation.id, {
        status: 'waiting_external',
        updated_at: now,
        result_summary: 'Provider authorization returned and the resulting connection is awaiting live verification.',
        continuation_state: {
          ...(resumeDelegation.continuation_state || {}),
          pending_step: 'verify_created_connection',
          completed_steps: [
            ...new Set([...(resumeDelegation.continuation_state?.completed_steps || []), 'provider_authorized', 'connection_bound']),
          ],
          external_requirement: 'A live provider verification must succeed before account setup is complete.',
          return_route: '/connections',
          continuation_ref: saved.id,
          platform: key,
          requested_action: String(requested_action || ''),
          request_key: String(request_key || ''),
        },
      });
    }
    return Response.json({
      configured: true,
      authorization_present: true,
      connected: false,
      provider_verified: false,
      verification_required: true,
      managed_resume: Boolean(resumeDelegation),
      delegation_id: resumeDelegation?.id || null,
      connection: saved,
    });
  } catch (error) {
    console.error('finalizeAppUserOAuthConnection error:', error?.message || error);
    return Response.json({ error: 'Unable to finish this connection.' }, { status: 500 });
  }
}
