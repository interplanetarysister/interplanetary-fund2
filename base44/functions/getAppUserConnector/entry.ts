import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const ENV_BY_PLATFORM: Record<string, string> = {
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
