import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { OAUTH_ENV, verifyManualConnection } from '../../shared/connectionVerification.ts';
import { redactCredentials } from '../../shared/integrationRegistry.ts';

const SAFE_ATTENTION = 'This connection needs attention.';
const SAFE_UNAVAILABLE = 'Live provider verification is unavailable.';

function publicConnection(row) {
  const { credentials, credentials_meta } = redactCredentials(row?.credentials);
  return { ...row, credentials, credentials_meta };
}

export default async function(req) {
  const base44 = createClientFromRequest(req);
  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { connection_id } = await req.json().catch(() => ({}));
    const ownerVisible = connection_id
      ? await base44.entities.PlatformConnection.get(connection_id).catch(() => null)
      : null;
    if (!ownerVisible || ownerVisible.created_by_id !== user.id) {
      return Response.json({ error: 'Connection not found.' }, { status: 404 });
    }
    // Owner-mode reads intentionally hide secret fields. Fetch the complete row
    // only after ownership is proven, then redact it again before any response.
    const sr = base44.asServiceRole;
    const connection = await sr.entities.PlatformConnection.get(connection_id).catch(() => null);
    if (!connection || connection.created_by_id !== user.id) {
      return Response.json({ error: 'Connection not found.' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const envName = OAUTH_ENV[connection.platform];
    try {
      let providerVerified = false;
      if (envName) {
        const connectorId = Deno.env.get(envName) || '';
        if (!connectorId) throw new Error('oauth_not_configured');
        const oauth = await sr.connectors.getCurrentAppUserConnection(connectorId);
        if (!oauth?.accessToken) throw new Error('oauth_reauthorization_required');
        // A stored token proves an authorization transport exists; it does not
        // prove the provider call this connection claims to perform still works.
        // Fail closed until a provider-specific harmless live probe is available.
        throw new Error('oauth_live_probe_unavailable');
      } else if (['bluesky', 'mastodon'].includes(connection.platform)) {
        await verifyManualConnection(connection);
        providerVerified = true;
      } else if (connection.platform === 'kofi') {
        providerVerified = connection.verification_status === 'verified'
          && connection.external_data_source === 'provider_verified';
        if (!providerVerified) throw new Error('kofi_webhook_required');
      } else {
        // A pasted/public campaign URL is tracking configuration, not proof that
        // the provider authenticated the owner or granted operational authority.
        throw new Error('provider_probe_unavailable');
      }

      if (!providerVerified) throw new Error('provider_probe_unavailable');
      const updated = await sr.entities.PlatformConnection.update(connection.id, {
        status: 'connected', verification_status: 'verified', last_synced: now, last_error: '',
        history: [...(connection.history || []), { at: now, event: 'health_check', detail: 'Provider connection verified' }].slice(-30),
      });
      return Response.json({ working: true, provider_verified: true, connection: publicConnection(updated) });
    } catch (error) {
      const reason = String(error?.message || '');
      const reauth = reason === 'oauth_reauthorization_required' || reason === 'oauth_not_configured';
      const message = reauth ? 'Provider authorization needs attention.' : SAFE_UNAVAILABLE;
      const updated = await sr.entities.PlatformConnection.update(connection.id, {
        status: 'error', verification_status: 'unverified', last_error: message,
        capability_status: reauth ? 'reauthorization_required' : 'unknown',
        history: [...(connection.history || []), { at: now, event: 'health_check_failed', detail: message }].slice(-30),
      });
      return Response.json({ working: false, provider_verified: false, connection: publicConnection(updated), error: message });
    }
  } catch (error) {
    console.error('verifyPlatformConnection error:', error?.name || 'UnknownError');
    return Response.json({ error: SAFE_ATTENTION }, { status: 500 });
  }
}