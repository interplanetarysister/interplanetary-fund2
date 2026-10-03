import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { OAUTH_ENV } from '../../shared/connectionVerification.ts';

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
    // IFund-wide OBO authorization is canonical. The explicit connection-flow
    // value remains supported, and legacy grants are honored during migration.
    const canonicalDecided = typeof user.ai_obo_consent?.granted === 'boolean';
    const inheritedConsent = canonicalDecided
      ? user.ai_obo_consent.granted === true
      : (user.ai_publishing_consent?.granted === true || user.ai_connection_consent?.granted === true);
    // An explicit canonical revocation wins over every legacy field. A positive
    // connection-flow choice can establish authorization only before the
    // canonical decision exists; subsequent changes go through setUnifiedOboConsent.
    const sharedAgentConsent = canonicalDecided ? inheritedConsent : (shared_agent_consent === true || inheritedConsent);
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

    const existing = (await base44.entities.PlatformConnection.filter({ created_by_id: user.id, platform: key }))[0] || null;
    const now = new Date().toISOString();
    const confirmed = providerCapabilities(oauth);
    const data = {
      platform: key,
      kind: cfg.kind,
      display_name: existing?.display_name || key,
      external_url: existing?.external_url || '',
      automation_mode: sharedAgentConsent ? (existing?.automation_mode || 'auto') : 'manual',
      obo_consent: {
        granted: sharedAgentConsent,
        granted_at: sharedAgentConsent ? now : null,
        permission_version: '2026-10-unified-obo-v1',
        requested_capabilities: cfg.requestedCapabilities,
        // Never copy desired capabilities into granted/provider capabilities.
        // Unknown remains unknown until the connector/provider reports it.
        granted_capabilities: sharedAgentConsent ? confirmed : [],
        provider_capabilities: confirmed,
      },
      agent_access: {
        shared_with_agents: sharedAgentConsent,
        automation_enabled: sharedAgentConsent && (existing ? (existing.agent_access?.automation_enabled || existing.automation_mode === 'auto') : true),
      },
      status: 'connected',
      verification_status: 'verified',
      capability_status: confirmed.length ? 'confirmed' : 'unknown',
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
