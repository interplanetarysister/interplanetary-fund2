import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { connectorPolicy, providerCapabilities } from '../../shared/appUserConnectorPolicy.js';
import { redactPlatformConnection } from '../../shared/credentialRedaction.js';

const CONFIG: Record<string, { env: string; kind: string }> = {
  gmail: { env: 'APP_USER_CONNECTOR_GMAIL_ID', kind: 'app' },
  googledrive: { env: 'APP_USER_CONNECTOR_GOOGLEDRIVE_ID', kind: 'app' },
  googlecalendar: { env: 'APP_USER_CONNECTOR_GOOGLECALENDAR_ID', kind: 'app' },
  google_contacts: { env: 'APP_USER_CONNECTOR_GOOGLE_CONTACTS_ID', kind: 'app' },
  google_photos: { env: 'APP_USER_CONNECTOR_GOOGLE_PHOTOS_ID', kind: 'app' },
  googlesheets: { env: 'APP_USER_CONNECTOR_GOOGLESHEETS_ID', kind: 'app' },
  googledocs: { env: 'APP_USER_CONNECTOR_GOOGLEDOCS_ID', kind: 'app' },
  googleforms: { env: 'APP_USER_CONNECTOR_GOOGLEFORMS_ID', kind: 'app' },
  googletasks: { env: 'APP_USER_CONNECTOR_GOOGLETASKS_ID', kind: 'app' },
  slack: { env: 'APP_USER_CONNECTOR_SLACK_ID', kind: 'app' },
  notion: { env: 'APP_USER_CONNECTOR_NOTION_ID', kind: 'app' },
  outlook: { env: 'APP_USER_CONNECTOR_OUTLOOK_ID', kind: 'app' },
  microsoft_teams: { env: 'APP_USER_CONNECTOR_MICROSOFT_TEAMS_ID', kind: 'app' },
  one_drive: { env: 'APP_USER_CONNECTOR_ONE_DRIVE_ID', kind: 'app' },
  dropbox: { env: 'APP_USER_CONNECTOR_DROPBOX_ID', kind: 'app' },
  github: { env: 'APP_USER_CONNECTOR_GITHUB_ID', kind: 'app' },
  gitlab: { env: 'APP_USER_CONNECTOR_GITLAB_ID', kind: 'app' },
  linkedin: { env: 'APP_USER_CONNECTOR_LINKEDIN_ID', kind: 'social' },
  facebook: { env: 'APP_USER_CONNECTOR_FACEBOOK_PAGES_ID', kind: 'social' },
  instagram: { env: 'APP_USER_CONNECTOR_INSTAGRAM_ID', kind: 'social' },
  discord: { env: 'APP_USER_CONNECTOR_DISCORD_ID', kind: 'social' },
  tiktok: { env: 'APP_USER_CONNECTOR_TIKTOK_ID', kind: 'social' },
  threads: { env: 'APP_USER_CONNECTOR_THREADS_ID', kind: 'social' },
  x: { env: 'APP_USER_CONNECTOR_X_ID', kind: 'social' },
  pinterest: { env: 'APP_USER_CONNECTOR_PINTEREST_ID', kind: 'social' },
  reddit: { env: 'APP_USER_CONNECTOR_REDDIT_ID', kind: 'social' },
  youtube: { env: 'APP_USER_CONNECTOR_YOUTUBE_ID', kind: 'social' },
  patreon: { env: 'APP_USER_CONNECTOR_PATREON_ID', kind: 'crowdfunding' },
};

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

    const sr = base44.asServiceRole;
    const ownerVisible = (await base44.entities.PlatformConnection.filter({ created_by_id: user.id, platform: key }))[0] || null;
    const existing = ownerVisible
      ? await sr.entities.PlatformConnection.get(ownerVisible.id).catch(() => null)
      : null;
    const now = new Date().toISOString();
    const confirmed = providerCapabilities(oauth);
    const requestedCapabilities = connectorPolicy(key).requestedCapabilities;
    const confirmedRequested = requestedCapabilities.filter((capability) => confirmed.includes(capability));
    const data = {
      platform: key,
      kind: cfg.kind,
      display_name: existing?.display_name || key,
      external_url: existing?.external_url || '',
      automation_mode: 'manual',
      obo_consent: {
        granted: sharedAgentConsent,
        granted_at: sharedAgentConsent ? now : null,
        permission_version: '2026-09-comprehensive-platform-v1',
        requested_capabilities: requestedCapabilities,
        // Never copy desired capabilities into granted/provider capabilities.
        // Unknown remains unknown until the connector/provider reports it.
        granted_capabilities: sharedAgentConsent ? confirmedRequested : [],
        provider_capabilities: confirmed,
      },
      agent_access: {
        shared_with_agents: sharedAgentConsent,
        automation_enabled: false,
      },
      status: 'disconnected',
      verification_status: 'unverified',
      capability_status: confirmed.length ? 'confirmed' : 'unknown',
      // OAuth authorization does not verify provider reachability or crowdfunding provenance.
      external_data_source: existing?.external_data_source || 'owner_reported',
      last_error: 'Provider authorization saved; live verification is still required.',
      history: [...(existing?.history || []), {
        at: now,
        event: 'oauth_authorized',
        detail: confirmed.length
          ? `Provider authorization saved; ${confirmed.length} provider-reported capabilities recorded; live verification required`
          : 'Provider authorization saved; detailed provider capabilities remain unknown; live verification required',
      }].slice(-30),
    };
    const saved = existing
      ? await sr.entities.PlatformConnection.update(existing.id, data)
      : await sr.entities.PlatformConnection.create({ ...data, created_by_id: user.id });
    return Response.json({ configured: true, authorization_present: true, connected: false, provider_verified: false, verification_required: true, connection: redactPlatformConnection(saved) });
  } catch (error) {
    console.error('finalizeAppUserOAuthConnection error:', error?.message || error);
    return Response.json({ error: 'Unable to finish this connection.' }, { status: 500 });
  }
}
