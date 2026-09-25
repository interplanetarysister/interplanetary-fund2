export const OAUTH_ENV: Record<string, string> = {
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

function publicHttpsHost(value: unknown) {
  const raw = String(value || '').trim();
  const url = new URL(raw.includes('://') ? raw : `https://${raw}`);
  if (url.protocol !== 'https:' || url.username || url.password || url.port) {
    throw new Error('Mastodon instance must be a public HTTPS hostname.');
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  const privateIpv4 = ipv4 && (
    Number(ipv4[1]) === 10
    || Number(ipv4[1]) === 127
    || (Number(ipv4[1]) === 169 && Number(ipv4[2]) === 254)
    || (Number(ipv4[1]) === 172 && Number(ipv4[2]) >= 16 && Number(ipv4[2]) <= 31)
    || (Number(ipv4[1]) === 192 && Number(ipv4[2]) === 168)
  );
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')
      || host === '::1' || host.startsWith('fc') || host.startsWith('fd')
      || host.startsWith('fe80:') || privateIpv4) {
    throw new Error('Mastodon instance must be a public HTTPS hostname.');
  }
  return host;
}

export async function verifyManualConnection(connection: any) {
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
    if (!c.mastodon_access_token) throw new Error('Connection details are incomplete.');
    const host = publicHttpsHost(c.mastodon_instance);
    const res = await fetch(`https://${host}/api/v1/accounts/verify_credentials`, {
      headers: { Authorization: `Bearer ${c.mastodon_access_token}` },
      redirect: 'error',
    });
    if (!res.ok) throw new Error('Mastodon could not verify this connection.');
    return;
  }
  throw new Error('This connection cannot be provider-verified by direct credentials.');
}
