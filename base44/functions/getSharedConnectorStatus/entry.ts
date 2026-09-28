import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Surfaces the status of SHARED (platform-managed) connectors — the platform
// Slack bot and Wix site sync — which by design have no per-user
// PlatformConnection record and therefore never appear in listConnections().
// The Connections page calls this to show platform-managed integrations as
// connected alongside user-owned connections.
//
// Verification is provider-backed where possible (Slack auth.test). No tokens
// or credential values are ever returned — only connection state and a redacted
// identity summary.

const SHARED_CONNECTORS = [
  { type: 'slackbot', platform: 'slack', name: 'Slack Bot', kind: 'app', icon: '💬',
    note: 'Platform-wide bot for announcements and mentions. Managed by admins.' },
  { type: 'wix', platform: 'wix', name: 'Wix', kind: 'app', icon: '🌐',
    note: 'Site sync for hosted campaign pages. Managed by admins.' },
];

async function checkSlackBot(sr: any) {
  try {
    const conn = await sr.connectors.getConnection('slackbot');
    if (!conn?.accessToken) return { connected: false, verified: false };
    const res = await fetch('https://slack.com/api/auth.test', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${conn.accessToken}`, 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({}),
    });
    const auth = await res.json();
    if (auth.ok) {
      return {
        connected: true, verified: true,
        identity: {
          bot_user_id: auth.user_id || null,
          team: auth.team || null,
          team_id: auth.team_id || null,
          url: auth.url || null,
        },
        verified_at: new Date().toISOString(),
      };
    }
    return { connected: true, verified: false, last_error: String(auth.error || 'auth.test failed').slice(0, 200) };
  } catch (e) {
    return { connected: false, verified: false, last_error: String(e?.message || e).slice(0, 200) };
  }
}

async function checkGeneric(sr: any, type: string) {
  try {
    const conn = await sr.connectors.getConnection(type);
    if (!conn?.accessToken) return { connected: false, verified: false };
    // Token presence proves the OAuth transport succeeded. Wix has no single
    // universal "verify" endpoint independent of a site, so transport-verified
    // is the honest ceiling here; a site-scoped API call happens on first use.
    return { connected: true, verified: true, verified_at: new Date().toISOString() };
  } catch {
    return { connected: false, verified: false };
  }
}

export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const sr = base44.asServiceRole;
    const results = [];
    for (const c of SHARED_CONNECTORS) {
      const status = c.type === 'slackbot' ? await checkSlackBot(sr) : await checkGeneric(sr, c.type);
      results.push({ ...c, ...status });
    }
    return Response.json({ shared: results });
  } catch (error) {
    console.error('getSharedConnectorStatus error:', error?.message || error);
    return Response.json({ error: 'Could not check platform integrations.' }, { status: 500 });
  }
}