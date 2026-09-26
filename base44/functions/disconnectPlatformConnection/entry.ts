import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const ENV_BY_PLATFORM: Record<string, string> = {
  gmail: 'APP_USER_CONNECTOR_GMAIL_ID',
  googledrive: 'APP_USER_CONNECTOR_GOOGLEDRIVE_ID',
  googlecalendar: 'APP_USER_CONNECTOR_GOOGLECALENDAR_ID',
  google_contacts: 'APP_USER_CONNECTOR_GOOGLE_CONTACTS_ID',
  google_photos: 'APP_USER_CONNECTOR_GOOGLE_PHOTOS_ID',
  googlesheets: 'APP_USER_CONNECTOR_GOOGLESHEETS_ID',
  googledocs: 'APP_USER_CONNECTOR_GOOGLEDOCS_ID',
  googleforms: 'APP_USER_CONNECTOR_GOOGLEFORMS_ID',
  googletasks: 'APP_USER_CONNECTOR_GOOGLETASKS_ID',
  slack: 'APP_USER_CONNECTOR_SLACK_ID',
  notion: 'APP_USER_CONNECTOR_NOTION_ID',
  outlook: 'APP_USER_CONNECTOR_OUTLOOK_ID',
  microsoft_teams: 'APP_USER_CONNECTOR_MICROSOFT_TEAMS_ID',
  one_drive: 'APP_USER_CONNECTOR_ONE_DRIVE_ID',
  dropbox: 'APP_USER_CONNECTOR_DROPBOX_ID',
  github: 'APP_USER_CONNECTOR_GITHUB_ID',
  gitlab: 'APP_USER_CONNECTOR_GITLAB_ID',

  linkedin: 'APP_USER_CONNECTOR_LINKEDIN_ID',
  facebook: 'APP_USER_CONNECTOR_FACEBOOK_PAGES_ID',
  instagram: 'APP_USER_CONNECTOR_INSTAGRAM_ID',
  discord: 'APP_USER_CONNECTOR_DISCORD_ID',
  tiktok: 'APP_USER_CONNECTOR_TIKTOK_ID',
  threads: 'APP_USER_CONNECTOR_THREADS_ID',
  x: 'APP_USER_CONNECTOR_X_ID',
  pinterest: 'APP_USER_CONNECTOR_PINTEREST_ID',
  reddit: 'APP_USER_CONNECTOR_REDDIT_ID',
  youtube: 'APP_USER_CONNECTOR_YOUTUBE_ID',
  patreon: 'APP_USER_CONNECTOR_PATREON_ID',
};

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { connection_id, platform } = await req.json().catch(() => ({}));
    const key = String(platform || '').toLowerCase();
    const connection = connection_id
      ? await base44.entities.PlatformConnection.get(connection_id).catch(() => null)
      : (await base44.entities.PlatformConnection.filter({ created_by_id: user.id, platform: key }))[0] || null;
    if (!connection || connection.created_by_id !== user.id) {
      return Response.json({ error: 'Connection not found.' }, { status: 404 });
    }

    // Remove agent/OBO authority first. Every side-effect path re-checks these
    // fields, so revocation takes effect before provider disconnect is attempted.
    await base44.entities.PlatformConnection.update(connection.id, {
      status: 'disconnected',
      verification_status: 'unverified',
      capability_status: 'unknown',
      automation_mode: 'manual',
      obo_consent: {
        ...(connection.obo_consent || {}),
        granted: false,
        granted_capabilities: [],
        provider_capabilities: [],
      },
      agent_access: {
        ...(connection.agent_access || {}),
        shared_with_agents: false,
        automation_enabled: false,
      },
      last_error: '',
    });

    const envName = ENV_BY_PLATFORM[key || connection.platform];
    const connectorId = envName ? (Deno.env.get(envName) || '') : '';
    let providerDisconnected = false;
    if (connectorId) {
      // SDK versions/providers differ. Use a supported disconnect method when
      // exposed; local authority remains revoked even when provider-side
      // revocation must be completed by the provider.
      const connectors: any = base44.asServiceRole.connectors;
      try {
        if (typeof connectors?.disconnectAppUser === 'function') {
          await connectors.disconnectAppUser(connectorId);
          providerDisconnected = true;
        } else if (typeof connectors?.disconnectCurrentAppUserConnection === 'function') {
          await connectors.disconnectCurrentAppUserConnection(connectorId);
          providerDisconnected = true;
        }
      } catch (error) {
        console.error('Provider disconnect failed after local revocation:', error?.message || error);
      }
    }

    await base44.entities.PlatformConnection.delete(connection.id);
    return Response.json({ disconnected: true, provider_disconnected: providerDisconnected });
  } catch (error) {
    console.error('disconnectPlatformConnection error:', error?.message || error);
    return Response.json({ error: 'Unable to disconnect this platform.' }, { status: 500 });
  }
}
