export const OAUTH_ENV: Record<string, string> = {
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
  facebook_pages: 'APP_USER_CONNECTOR_FACEBOOK_PAGES_ID',
  instagram: 'APP_USER_CONNECTOR_INSTAGRAM_ID',
  discord: 'APP_USER_CONNECTOR_DISCORD_ID',
  tiktok: 'APP_USER_CONNECTOR_TIKTOK_ID',
  eventbrite: 'APP_USER_CONNECTOR_EVENTBRITE_ID',
  gumroad: 'APP_USER_CONNECTOR_GUMROAD_ID',
};

// Platforms that connect via a pasted URL and owner-reported totals. No provider
// API exists to verify against — the URL itself is the connection evidence.
// These are distinct from OAuth platforms (OAUTH_ENV), manual-credential
// platforms (bluesky/mastodon), and webhook platforms (kofi).
const MANUAL_VERIFICATION_PLATFORMS = new Set(['bluesky', 'mastodon']);
const WEBHOOK_VERIFICATION_PLATFORMS = new Set(['kofi']);
const PUBLIC_LINK_HOSTS: Record<string, Set<string>> = {
  gofundme: new Set(['gofundme.com', 'www.gofundme.com']),
  kickstarter: new Set(['kickstarter.com', 'www.kickstarter.com']),
  indiegogo: new Set(['indiegogo.com', 'www.indiegogo.com']),
  fundrazr: new Set(['fundrazr.com', 'www.fundrazr.com']),
  givesendgo: new Set(['givesendgo.com', 'www.givesendgo.com']),
  spotfund: new Set(['spotfund.com', 'www.spotfund.com']),
  buymeacoffee: new Set(['buymeacoffee.com', 'www.buymeacoffee.com']),
};

export function isLinkBasedPlatform(platform: string): boolean {
  return PUBLIC_LINK_HOSTS[String(platform || '').toLowerCase()] instanceof Set;
}

export async function verifyPublicCampaignConnection(connection: any) {
  const key = String(connection?.platform || '').toLowerCase();
  const allowed = PUBLIC_LINK_HOSTS[key];
  if (!allowed) throw new Error('Public-page verification is not available for this platform.');
  let current = new URL(String(connection?.external_url || ''));
  if (
    current.protocol !== 'https:' ||
    current.username ||
    current.password ||
    (current.port && current.port !== '443') ||
    !allowed.has(current.hostname.toLowerCase())
  ) {
    throw new Error('The linked campaign URL is not an approved provider URL.');
  }

  for (let hop = 0; hop < 3; hop++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    let response;
    try {
      response = await fetch(current.href, {
        method: 'GET',
        redirect: 'manual',
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'User-Agent': 'InterplanetaryFund-ConnectionCheck/1.0',
          Range: 'bytes=0-4095',
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (response.status >= 200 && response.status < 300) return;
    if (response.status < 300 || response.status >= 400) {
      throw new Error(`Provider page check failed (${response.status}).`);
    }

    const location = response.headers.get('location');
    if (!location) throw new Error('Provider page redirected without a destination.');
    current = new URL(location, current);
    if (
      current.protocol !== 'https:' ||
      current.username ||
      current.password ||
      (current.port && current.port !== '443') ||
      !allowed.has(current.hostname.toLowerCase())
    ) {
      throw new Error('Provider page redirected outside the approved provider domain.');
    }
  }
  throw new Error('Provider page redirected too many times.');
}

async function providerProbe(url: string, token: string, options: any = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(options.headers || {}),
      },
      ...(options.body !== undefined ? { body: options.body } : {}),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(`Provider verification failed (${response.status}).`);
    if (typeof options.validate === 'function' && !options.validate(data)) {
      throw new Error('Provider verification response was not valid.');
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

export async function verifyOAuthConnection(platform: string, oauth: any) {
  const key = String(platform || '').toLowerCase();
  const token = String(oauth?.accessToken || '').trim();
  if (!token) throw new Error('Provider authorization needs to be renewed.');

  if (key === 'github') return providerProbe('https://api.github.com/user', token, {
    headers: { 'User-Agent': 'InterplanetaryFund' },
  });
  if (key === 'gitlab') return providerProbe('https://gitlab.com/api/v4/user', token);
  if (key === 'slack') return providerProbe('https://slack.com/api/auth.test', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: '',
    validate: (data: any) => data?.ok === true,
  });
  if (key === 'notion') return providerProbe('https://api.notion.com/v1/users/me', token, {
    headers: { 'Notion-Version': '2022-06-28' },
  });
  if (key === 'dropbox') return providerProbe('https://api.dropboxapi.com/2/users/get_current_account', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: 'null',
  });
  if (['outlook', 'microsoft_teams', 'one_drive'].includes(key)) {
    return providerProbe('https://graph.microsoft.com/v1.0/me?$select=id,displayName', token);
  }
  if (key === 'gmail') return providerProbe('https://gmail.googleapis.com/gmail/v1/users/me/profile', token);
  if (key === 'googledrive') return providerProbe('https://www.googleapis.com/drive/v3/about?fields=user', token);
  if (key === 'googlecalendar') return providerProbe('https://www.googleapis.com/calendar/v3/users/me/settings?maxResults=1', token);
  if (key === 'google_contacts') return providerProbe('https://people.googleapis.com/v1/people/me?personFields=names', token);
  if (key === 'googletasks') return providerProbe('https://tasks.googleapis.com/tasks/v1/users/@me/lists?maxResults=1', token);

  if (key === 'linkedin') return providerProbe('https://api.linkedin.com/v2/userinfo', token);
  if (key === 'facebook') return providerProbe('https://graph.facebook.com/me?fields=id,name', token);
  if (key === 'instagram') {
    try {
      return await providerProbe('https://graph.instagram.com/me?fields=id,username', token);
    } catch (_) {
      return providerProbe('https://graph.facebook.com/me?fields=id,name', token);
    }
  }
  if (key === 'discord') return providerProbe('https://discord.com/api/v10/users/@me', token);
  if (key === 'tiktok') return providerProbe('https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name', token, {
    validate: (data: any) => data?.error?.code === 'ok' && !!data?.data?.user?.open_id,
  });
  if (key === 'threads') return providerProbe('https://graph.threads.net/v1.0/me?fields=id,username', token);
  if (key === 'x') return providerProbe('https://api.x.com/2/users/me?user.fields=id,name,username', token);
  if (key === 'pinterest') return providerProbe('https://api.pinterest.com/v5/user_account', token);
  if (key === 'reddit') return providerProbe('https://oauth.reddit.com/api/v1/me', token, {
    headers: { 'User-Agent': 'InterplanetaryFund/1.0' },
  });
  if (key === 'youtube') return providerProbe('https://www.googleapis.com/youtube/v3/channels?part=id&mine=true', token);
  if (key === 'patreon') return providerProbe('https://www.patreon.com/api/oauth2/v2/identity', token);
  if (key === 'eventbrite') return providerProbe('https://www.eventbriteapi.com/v3/users/me/', token);

  throw new Error('Live provider verification is not implemented for this connector.');
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
    // The instance hostname is owner supplied. Until Base44 provides a
    // DNS-pinned, redirect-safe outbound transport for arbitrary Mastodon
    // instances, do not issue a server-side request to that hostname.
    // This preserves the connection record without creating an SSRF path or
    // falsely claiming provider verification.
    if (!c.mastodon_instance || !c.mastodon_access_token) throw new Error('Connection details are incomplete.');
    throw new Error('Live Mastodon verification is unavailable in this runtime.');
  }
  throw new Error('This connection cannot be provider-verified by direct credentials.');
}