import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const OAUTH_ENV: Record<string, string> = {
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

async function verifyManual(connection: any) {
  const c = connection.credentials || {};
  if (connection.platform === 'bluesky') {
    if (!c.bluesky_handle || !c.bluesky_app_password) throw new Error('Connection details are incomplete.');
    const res = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: c.bluesky_handle, password: c.bluesky_app_password }),
    });
    if (!res.ok) throw new Error('Bluesky could not verify this connection.');
    return;
  }
  if (connection.platform === 'mastodon') {
    const host = String(c.mastodon_instance || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!host || !c.mastodon_access_token) throw new Error('Connection details are incomplete.');
    const res = await fetch(`https://${host}/api/v1/accounts/verify_credentials`, {
      headers: { Authorization: `Bearer ${c.mastodon_access_token}` },
    });
    if (!res.ok) throw new Error('Mastodon could not verify this connection.');
    return;
  }
  if (connection.platform === 'kofi') {
    if (!c.kofi_verification_token) throw new Error('Ko-fi setup is incomplete.');
    // Ko-fi verifies the token on a real webhook event; configuration alone is not
    // provider verification and must not be shown as Working.
    throw new Error('Waiting for Ko-fi to verify the connection with a webhook event.');
  }
  // Link-only external campaigns are intentionally owner-reported, not provider verified.
  throw new Error('This connection is linked for tracking but cannot be provider-verified.');
}

export default async function(req) {
  const base44 = createClientFromRequest(req);
  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { connection_id } = await req.json().catch(() => ({}));
    const connection = connection_id
      ? await base44.entities.PlatformConnection.get(connection_id).catch(() => null)
      : null;
    if (!connection || connection.created_by_id !== user.id) {
      return Response.json({ error: 'Connection not found.' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const envName = OAUTH_ENV[connection.platform];
    try {
      if (envName) {
        const connectorId = Deno.env.get(envName) || '';
        if (!connectorId) throw new Error('Provider sign-in is not configured yet.');
        const oauth = await base44.asServiceRole.connectors.getCurrentAppUserConnection(connectorId);
        if (!oauth?.accessToken) throw new Error('Provider authorization needs to be renewed.');
      } else {
        await verifyManual(connection);
      }
      const updated = await base44.entities.PlatformConnection.update(connection.id, {
        status: 'connected', verification_status: 'verified', last_synced: now, last_error: '',
        history: [...(connection.history || []), { at: now, event: 'health_check', detail: 'Provider connection verified' }].slice(-30),
      });
      return Response.json({ working: true, connection: updated });
    } catch (error) {
      const message = error?.message || 'This connection needs attention.';
      const updated = await base44.entities.PlatformConnection.update(connection.id, {
        status: 'error', verification_status: 'unverified', last_error: message,
        history: [...(connection.history || []), { at: now, event: 'health_check_failed', detail: message }].slice(-30),
      });
      return Response.json({ working: false, connection: updated, error: message });
    }
  } catch (error) {
    console.error('verifyPlatformConnection error:', error?.message || error);
    return Response.json({ error: 'Unable to check this connection.' }, { status: 500 });
  }
}
