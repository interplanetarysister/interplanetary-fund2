import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { OAUTH_ENV } from '../../shared/connectionVerification.ts';
import { BROWSER_RUN_POLICY } from '../../shared/browserConnectionPolicy.js';
import { deriveConnectionLifecycle, operationalOboGrants } from '../../shared/connectionLifecyclePolicy.js';
import { recipeTransportOrder } from '../../shared/platformConnectionRecipePolicy.js';

// Inline minimal recipe registry (matches the established pattern in
// resolvePlatformConnectionRecipe, which also inlines its own copy — the shared
// base44/lib/platformConnectionRecipes.ts is not importable from functions).
// This is non-secret linkage knowledge only: preferred transport + connector type.
const STATIC_RECIPES: Record<string, Record<string, { preferred_transport: string; connector_type?: string; shared?: boolean; worker_key?: string }>> = {
  linkedin: { connect: { preferred_transport: 'oauth', connector_type: 'linkedin' } },
  facebook: { connect: { preferred_transport: 'oauth', connector_type: 'facebook_pages' } },
  instagram: { connect: { preferred_transport: 'oauth', connector_type: 'instagram' } },
  discord: { connect: { preferred_transport: 'oauth', connector_type: 'discord' } },
  tiktok: { connect: { preferred_transport: 'oauth', connector_type: 'tiktok' } },
  patreon: { connect: { preferred_transport: 'oauth', connector_type: 'patreon' } },
  eventbrite: { connect: { preferred_transport: 'oauth', connector_type: 'eventbrite' } },
  kofi: { connect: { preferred_transport: 'webhook', worker_key: 'kofiWebhook' } },
  buymeacoffee: { connect: { preferred_transport: 'token', worker_key: 'buyMeACoffeeApi' } },
  bluesky: { connect: { preferred_transport: 'token', worker_key: 'blueskyDirect' } },
  mastodon: { connect: { preferred_transport: 'token', worker_key: 'mastodonDirect' } },
  gofundme: { read_metrics: { preferred_transport: 'public_browser', worker_key: 'runBrowserConnection' } },
  kickstarter: { read_metrics: { preferred_transport: 'public_browser', worker_key: 'runBrowserConnection' } },
  indiegogo: { read_metrics: { preferred_transport: 'public_browser', worker_key: 'runBrowserConnection' } },
  fundrazr: { read_metrics: { preferred_transport: 'public_browser', worker_key: 'runBrowserConnection' } },
  givesendgo: { read_metrics: { preferred_transport: 'public_browser', worker_key: 'runBrowserConnection' } },
  spotfund: { read_metrics: { preferred_transport: 'public_browser', worker_key: 'runBrowserConnection' } },
  // SHARED (platform-managed) connector — builder's Wix site.
  wix: { connect: { preferred_transport: 'oauth', connector_type: 'wix', shared: true } },
};
function staticRecipe(platform: string, operation = 'connect') {
  return STATIC_RECIPES[platform]?.[operation] || null;
}
function orderedTransports(recipe: any) {
  return recipeTransportOrder(recipe);
}

// The canonical connection resolver consumed by every IFund connection surface.
//
// It reconciles, per platform per user:
//   authenticated user → ownership mode (APP_USER vs SHARED)
//   → PlatformConnection record (if any) → Base44 connector state
//   → provider identity → granted capabilities → transport health
//   → PlatformConnectionRecipe → AuthorizationGrant/OBO → lifecycle state.
//
// It does NOT duplicate the per-connection provider test (verifyPlatformConnection),
// the SHARED status list (getSharedConnectorStatus), or the credential list
// (listConnections). It composes them into ONE lifecycle answer so the frontend,
// admin diagnostics, and agents all ask the same question and get the same state.
//
// VERIFIED here means a real provider-backed call succeeded in this resolver OR the
// connection already carries provider-verified provenance. Transport-verified means
// the OAuth transport returned a token but no provider capability was exercised.
// Configuration, recipes, saved credentials, or public URLs are NOT sufficient.

const CROWDFUNDING_OBSERVATION_PLATFORMS = new Set([
  'gofundme', 'kickstarter', 'indiegogo', 'fundrazr', 'givesendgo', 'spotfund', 'custom',
]);

// Provider-backed verification for SHARED connectors. Reuses the same calls the
// dedicated getSharedConnectorStatus function makes, so the resolver and the
// shared-status list never disagree.
async function verifyShared(sr: any, connectorType: string) {
  try {
    const conn = await sr.connectors.getConnection(connectorType);
    if (!conn?.accessToken) return { connected: false, verified: false, identity: null, capabilities: [] };
    if (connectorType === 'slackbot') {
      const res = await fetch('https://slack.com/api/auth.test', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${conn.accessToken}`, 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({}),
      });
      const auth = await res.json();
      if (auth.ok) return { connected: true, verified: true, identity: { team: auth.team || null, bot_user_id: auth.user_id || null }, capabilities: ['read_identity', 'post_messages'] };
      return { connected: true, verified: false, identity: null, capabilities: [], last_error: String(auth.error || 'auth.test failed').slice(0, 200) };
    }
    if (connectorType === 'wix') {
      const res = await fetch('https://www.wixapis.com/site-properties/v4/properties', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${conn.accessToken}` },
      });
      if (!res.ok) return { connected: true, verified: false, identity: null, capabilities: [], last_error: `site-properties ${res.status}` };
      const body = await res.json().catch(() => ({}));
      return {
        connected: true, verified: true,
        identity: { site: body?.properties?.siteDisplayName || null, currency: body?.properties?.paymentCurrency || null, language: body?.properties?.language || null },
        // Webhooks are platform-managed for the SHARED connector; not yet exercised
        // into a sync pipeline, so 'receive_webhooks' stays out of verified caps.
        capabilities: ['read_site_data', 'manage_content'],
      };
    }
    return { connected: true, verified: true, identity: null, capabilities: [] };
  } catch (e) {
    return { connected: false, verified: false, identity: null, capabilities: [], last_error: String(e?.message || e).slice(0, 200) };
  }
}

// Transport-verified check for APP_USER OAuth connectors. Token presence proves
// the OAuth transport; it does NOT prove any specific capability. Deep
// capability testing is verifyPlatformConnection's job — the resolver only reports
// what the transport itself guarantees, so a stale-but-issued token is not谎d as
// a working capability.
async function appUserOAuthTransport(sr: any, platform: string) {
  const envName = OAUTH_ENV[platform];
  if (!envName) return { configured: false, transport_ok: false };
  const connectorId = Deno.env.get(envName) || '';
  if (!connectorId) return { configured: false, transport_ok: false };
  try {
    const oauth = await sr.connectors.getCurrentAppUserConnection(connectorId);
    if (!oauth?.accessToken) return { configured: true, transport_ok: false };
    return { configured: true, transport_ok: true, capabilities: oauth?.capabilities || oauth?.scopes || [] };
  } catch {
    return { configured: true, transport_ok: false };
  }
}

function recoveryHint(lifecycle: string, recipe: any, oauth: any, platform: string): string {
  switch (lifecycle) {
    case 'NOT_CONNECTED':
      if (recipe?.preferred_transport === 'oauth' && !oauth?.configured) return 'Register the workspace connector, then start OAuth.';
      if (recipe?.preferred_transport === 'oauth') return 'Start OAuth to connect this account.';
      if (recipe?.preferred_transport === 'public_browser') return 'Link the external campaign URL and grant browser observation consent.';
      if (recipe?.preferred_transport === 'token') return 'Enter the platform connection credentials.';
      if (recipe?.preferred_transport === 'webhook') return 'Follow the webhook setup steps.';
      return 'Connect this platform to begin.';
    case 'AUTHORIZATION_REQUIRED': return 'Finish authorization to complete the connection.';
    case 'RECONNECT_REQUIRED': return 'Reconnect to restore access.';
    case 'DEGRADED': return 'Connection is partially working — verify capabilities.';
    case 'CONNECTING': return 'Waiting for the first verified event from the provider.';
    case 'BLOCKED': return 'An external requirement is blocking this connection.';
    default: return '';
  }
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { platform, connection_id } = await req.json().catch(() => ({}));
    const key = String(platform || '').toLowerCase();
    if (!key) return Response.json({ error: 'Platform is required.' }, { status: 400 });

    const operation = CROWDFUNDING_OBSERVATION_PLATFORMS.has(key) ? 'read_metrics' : 'connect';
    const recipe = staticRecipe(key, operation);
    const transports = orderedTransports(recipe);
    const sr = base44.asServiceRole;

    let shared: any = null;
    let oauth: any = null;
    let connection: any | null = null;

    if (recipe?.shared) {
      shared = await verifyShared(sr, recipe.connector_type || key);
    } else {
      oauth = recipe?.preferred_transport === 'oauth' ? await appUserOAuthTransport(sr, key) : null;
      if (connection_id) {
        connection = await base44.entities.PlatformConnection.get(connection_id).catch(() => null);
        if (connection && connection.created_by_id !== user.id) connection = null;
      } else {
        const list = await base44.entities.PlatformConnection.filter({ created_by_id: user.id, platform: key }, '-updated_date', 1);
        connection = list[0] || null;
      }
    }

    // OBO authority: active AuthorizationGrants for this user + platform.
    let grants: any[] = [];
    if (!recipe?.shared && connection) {
      try {
        grants = await base44.entities.AuthorizationGrant.filter({ user_id: user.id, platform: key, status: 'active' }, undefined, 50);
      } catch { grants = []; }
    }

    const lifecycle = deriveConnectionLifecycle({
      connection,
      shared,
      oauth,
      recipe,
      browserRunEnabled: BROWSER_RUN_POLICY.enabled,
    });
    const authorizedGrants = operationalOboGrants({ connection, grants, lifecycle });

    // Capabilities: only what is genuinely verified. Never inferred from config.
    const capabilities_verified: string[] = [];
    if (recipe?.shared && shared?.verified) capabilities_verified.push(...(shared.capabilities || []));
    if (!recipe?.shared && lifecycle === 'CONNECTED') {
      if (oauth?.transport_ok) capabilities_verified.push('oauth_transport_verified');
      if (connection?.verification_status === 'verified') {
        if (recipe?.preferred_transport === 'token') capabilities_verified.push('provider_verified');
        if (recipe?.preferred_transport === 'webhook' && connection.external_data_source === 'provider_verified') capabilities_verified.push('receive_donation_webhooks');
      }
      if (recipe?.preferred_transport === 'public_browser' && BROWSER_RUN_POLICY.enabled) {
        capabilities_verified.push('observe_external_metrics');
      }
    }

    return Response.json({
      platform: key,
      ownership_mode: recipe?.shared ? 'SHARED' : 'APP_USER',
      lifecycle,
      transport: recipe?.preferred_transport || null,
      fallback_transports: (transports || []).filter((t: string) => t !== recipe?.preferred_transport),
      identity: shared?.identity || (connection ? { display_name: connection.display_name || null, external_url: connection.external_url || null } : null),
      capabilities_verified,
      obo: recipe?.shared ? null : { authorized: authorizedGrants.length > 0, grant_count: authorizedGrants.length },
      last_verified: shared?.verified ? shared?.verified_at : connection?.last_synced || null,
      last_error: shared?.last_error || connection?.last_error || null,
      recovery_hint: recoveryHint(lifecycle, recipe, oauth, key),
      // Sanitized: no tokens, no credentials, no raw provider responses.
    });
  } catch (error) {
    console.error('resolveConnectionStatus error:', error?.message || error);
    return Response.json({ error: 'Could not resolve this connection.' }, { status: 500 });
  }
}
