import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const COMMON_IF_CAPABILITIES = [
  'read_account', 'read_resources', 'read_campaign', 'manage_campaign',
  'create_post', 'edit_post', 'delete_own_post', 'upload_media',
  'read_interactions', 'comment', 'reply_comment', 'read_messages', 'reply_message',
  'discover', 'follow', 'join', 'read_analytics',
  'read_donations', 'read_payments', 'read_transactions', 'read_balance',
  'subscribe_events', 'reconcile_external_funds', 'settlement_status', 'transfer_or_payout',
];

const CONFIG: Record<string, { env: string; kind: string; requestedCapabilities: string[] }> = {
  // Request the complete foreseeable IF capability envelope once. These are
  // desired capabilities only; provider-reported scopes remain the sole source
  // for what is actually granted and usable.
  linkedin: { env: 'APP_USER_CONNECTOR_LINKEDIN_ID', kind: 'social', requestedCapabilities: COMMON_IF_CAPABILITIES },
  facebook: { env: 'APP_USER_CONNECTOR_FACEBOOK_PAGES_ID', kind: 'social', requestedCapabilities: COMMON_IF_CAPABILITIES },
  instagram: { env: 'APP_USER_CONNECTOR_INSTAGRAM_ID', kind: 'social', requestedCapabilities: COMMON_IF_CAPABILITIES },
  discord: { env: 'APP_USER_CONNECTOR_DISCORD_ID', kind: 'social', requestedCapabilities: COMMON_IF_CAPABILITIES },
  tiktok: { env: 'APP_USER_CONNECTOR_TIKTOK_ID', kind: 'social', requestedCapabilities: COMMON_IF_CAPABILITIES },
  threads: { env: 'APP_USER_CONNECTOR_THREADS_ID', kind: 'social', requestedCapabilities: COMMON_IF_CAPABILITIES },
  x: { env: 'APP_USER_CONNECTOR_X_ID', kind: 'social', requestedCapabilities: COMMON_IF_CAPABILITIES },
  pinterest: { env: 'APP_USER_CONNECTOR_PINTEREST_ID', kind: 'social', requestedCapabilities: COMMON_IF_CAPABILITIES },
  reddit: { env: 'APP_USER_CONNECTOR_REDDIT_ID', kind: 'social', requestedCapabilities: COMMON_IF_CAPABILITIES },
  youtube: { env: 'APP_USER_CONNECTOR_YOUTUBE_ID', kind: 'social', requestedCapabilities: COMMON_IF_CAPABILITIES },
  patreon: { env: 'APP_USER_CONNECTOR_PATREON_ID', kind: 'crowdfunding', requestedCapabilities: COMMON_IF_CAPABILITIES },
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

    const { platform, shared_agent_consent } = await req.json().catch(() => ({}));
    const key = String(platform || '').toLowerCase();
    const cfg = CONFIG[key];
    const sharedAgentConsent = shared_agent_consent === true;
    const connectorId = cfg ? (Deno.env.get(cfg.env) || '') : '';
    if (!cfg || !connectorId) return Response.json({ configured: false, connected: false });

    let oauth: any;
    try {
      oauth = await base44.asServiceRole.connectors.getCurrentAppUserConnection(connectorId);
      if (!oauth?.accessToken) return Response.json({ configured: true, connected: false });
    } catch {
      return Response.json({ configured: true, connected: false });
    }

    const existing = (await base44.entities.PlatformConnection.filter({ created_by_id: user.id, platform: key }))[0] || null;
    const now = new Date().toISOString();
    const confirmed = providerCapabilities(oauth);
    const data = {
      platform: key,
      kind: cfg.kind,
      display_name: existing?.display_name || key,
      external_url: existing?.external_url || '',
      automation_mode: existing?.automation_mode || 'manual',
      obo_consent: {
        granted: sharedAgentConsent,
        granted_at: sharedAgentConsent ? now : null,
        permission_version: '2026-09-comprehensive-platform-v1',
        requested_capabilities: cfg.requestedCapabilities,
        // Never copy desired capabilities into granted/provider capabilities.
        // Unknown remains unknown until the connector/provider reports it.
        granted_capabilities: sharedAgentConsent ? confirmed : [],
        provider_capabilities: confirmed,
      },
      agent_access: {
        shared_with_agents: sharedAgentConsent,
        automation_enabled: sharedAgentConsent && (existing?.agent_access?.automation_enabled || existing?.automation_mode === 'auto'),
      },
      status: 'connected',
      verification_status: 'verified',
      // OAuth verifies the account connection, not crowdfunding totals/provenance.
      external_data_source: existing?.external_data_source || 'owner_reported',
      last_synced: now,
      last_error: '',
      history: [...(existing?.history || []), {
        at: now,
        event: 'oauth_connected',
        detail: confirmed.length
          ? `Provider OAuth verified; ${confirmed.length} provider-reported capabilities recorded`
          : 'Provider OAuth verified; detailed provider capabilities were not reported and remain unknown',
      }].slice(-30),
    };
    const saved = existing
      ? await base44.entities.PlatformConnection.update(existing.id, data)
      : await base44.entities.PlatformConnection.create(data);
    return Response.json({ configured: true, connected: true, connection: saved });
  } catch (error) {
    console.error('finalizeAppUserOAuthConnection error:', error?.message || error);
    return Response.json({ error: 'Unable to finish this connection.' }, { status: 500 });
  }
}
