import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { OAUTH_ENV, verifyManualConnection } from '../../shared/connectionVerification.ts';

const SAFE_ATTENTION = 'This connection needs attention.';
const SAFE_UNAVAILABLE = 'Live provider verification is unavailable.';

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
      let providerVerified = false;
      if (envName) {
        const connectorId = Deno.env.get(envName) || '';
        if (!connectorId) throw new Error('oauth_not_configured');
        const oauth = await base44.asServiceRole.connectors.getCurrentAppUserConnection(connectorId);
        if (!oauth?.accessToken) throw new Error('oauth_reauthorization_required');
        // Token presence proves configuration only. Base44 exposes no supported
        // live provider probe here, so it must not grant verified/OBO authority.
        throw new Error('oauth_live_probe_unavailable');
      } else if (['bluesky', 'mastodon'].includes(connection.platform)) {
        await verifyManualConnection(connection);
        providerVerified = true;
      } else if (connection.platform === 'kofi') {
        providerVerified = connection.verification_status === 'verified'
          && connection.external_data_source === 'provider_verified';
        if (!providerVerified) throw new Error('kofi_webhook_required');
      } else {
        throw new Error('provider_probe_unavailable');
      }

      if (!providerVerified) throw new Error('provider_probe_unavailable');
      const updated = await base44.entities.PlatformConnection.update(connection.id, {
        status: 'connected',
        verification_status: 'verified',
        last_synced: now,
        last_error: '',
        history: [...(connection.history || []), { at: now, event: 'health_check', detail: 'Provider connection verified' }].slice(-30),
      });
      return Response.json({ working: true, provider_verified: true, connection: updated });
    } catch (error) {
      const reason = String(error?.message || '');
      const reauth = reason === 'oauth_reauthorization_required' || reason === 'oauth_not_configured';
      const message = reauth ? 'Provider authorization needs attention.' : SAFE_UNAVAILABLE;
      const updated = await base44.entities.PlatformConnection.update(connection.id, {
        status: 'error',
        verification_status: 'unverified',
        last_error: message,
        capability_status: envName ? 'reauthorization_required' : (connection.capability_status || 'unknown'),
        history: [...(connection.history || []), { at: now, event: 'health_check_failed', detail: message }].slice(-30),
      });
      return Response.json({ working: false, provider_verified: false, connection: updated, error: message });
    }
  } catch (error) {
    console.error('verifyPlatformConnection error:', error?.name || 'UnknownError');
    return Response.json({ error: SAFE_ATTENTION }, { status: 500 });
  }
}
