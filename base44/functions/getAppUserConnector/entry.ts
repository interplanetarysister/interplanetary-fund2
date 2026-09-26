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

    const { platform } = await req.json().catch(() => ({}));
    const envName = ENV_BY_PLATFORM[String(platform || '').toLowerCase()];
    if (!envName) return Response.json({ configured: false, supported: false });

    const connectorId = Deno.env.get(envName) || '';
    return Response.json({
      configured: !!connectorId,
      supported: true,
      connector_id: connectorId || undefined,
    });
  } catch (error) {
    console.error('getAppUserConnector error:', error?.message || error);
    return Response.json({ error: 'Unable to prepare this connection.' }, { status: 500 });
  }
}
