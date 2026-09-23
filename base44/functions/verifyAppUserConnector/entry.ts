import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const ENV_BY_PLATFORM: Record<string, string> = {
  linkedin: 'APP_USER_CONNECTOR_LINKEDIN_ID',
  facebook: 'APP_USER_CONNECTOR_FACEBOOK_PAGES_ID',
  instagram: 'APP_USER_CONNECTOR_INSTAGRAM_ID',
  discord: 'APP_USER_CONNECTOR_DISCORD_ID',
  tiktok: 'APP_USER_CONNECTOR_TIKTOK_ID',
};

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { platform } = await req.json().catch(() => ({}));
    const key = String(platform || '').toLowerCase();
    const envName = ENV_BY_PLATFORM[key];
    const connectorId = envName ? (Deno.env.get(envName) || '') : '';
    if (!envName || !connectorId) {
      return Response.json({ connected: false, configured: false });
    }

    try {
      const connection = await base44.asServiceRole.connectors.getCurrentAppUserConnection(connectorId);
      return Response.json({
        connected: !!connection?.accessToken,
        configured: true,
      });
    } catch {
      return Response.json({ connected: false, configured: true });
    }
  } catch (error) {
    console.error('verifyAppUserConnector error:', error?.message || error);
    return Response.json({ error: 'Unable to verify this connection.' }, { status: 500 });
  }
}
