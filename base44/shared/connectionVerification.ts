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
    const host = String(c.mastodon_instance || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!host || !c.mastodon_access_token) throw new Error('Connection details are incomplete.');
    const res = await fetch(`https://${host}/api/v1/accounts/verify_credentials`, {
      headers: { Authorization: `Bearer ${c.mastodon_access_token}` },
    });
    if (!res.ok) throw new Error('Mastodon could not verify this connection.');
    return;
  }
  throw new Error('This connection cannot be provider-verified by direct credentials.');
}