import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { buildOAuthAuthorizationState } from '../../shared/appUserConnectorPolicy.js';
import { redactPlatformConnection } from '../../shared/credentialRedaction.js';
import { OAUTH_ENV } from '../../shared/connectionVerification.ts';

const APP_PLATFORMS = new Set([
  'gmail', 'googledrive', 'googlecalendar', 'google_contacts', 'google_photos',
  'googlesheets', 'googledocs', 'googleforms', 'googletasks', 'slack', 'notion',
  'outlook', 'microsoft_teams', 'one_drive', 'dropbox', 'github', 'gitlab',
]);
const CROWDFUNDING_PLATFORMS = new Set(['patreon', 'eventbrite']);
const CONFIG: Record<string, { kind: string }> = Object.fromEntries(
  Object.keys(OAUTH_ENV).map((platform) => [
    platform,
    { kind: APP_PLATFORMS.has(platform) ? 'app' : CROWDFUNDING_PLATFORMS.has(platform) ? 'crowdfunding' : 'social' },
  ]),
);

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { platform, shared_agent_consent } = await req.json().catch(() => ({}));
    const key = String(platform || '').toLowerCase();
    const cfg = CONFIG[key];
    const sharedAgentConsent = shared_agent_consent === true;
    const envName = OAUTH_ENV[key];
    const connectorId = cfg && envName ? (Deno.env.get(envName) || '') : '';
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
    const data = buildOAuthAuthorizationState({
      platform: key,
      kind: cfg.kind,
      oauth,
      sharedAgentConsent,
      existing,
    });
    const saved = existing
      ? await sr.entities.PlatformConnection.update(existing.id, data)
      : await sr.entities.PlatformConnection.create({ ...data, created_by_id: user.id });
    return Response.json({ configured: true, authorization_present: true, connected: false, provider_verified: false, verification_required: true, connection: redactPlatformConnection(saved) });
  } catch (error) {
    console.error('finalizeAppUserOAuthConnection error:', error?.message || error);
    return Response.json({ error: 'Unable to finish this connection.' }, { status: 500 });
  }
}
