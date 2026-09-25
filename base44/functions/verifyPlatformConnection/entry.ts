import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { OAUTH_ENV, verifyManualConnection } from '../../shared/connectionVerification.ts';

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
      } else if (['bluesky', 'mastodon'].includes(connection.platform)) {
        await verifyManualConnection(connection);
      } else if (connection.platform === 'kofi') {
        if (connection.verification_status !== 'verified' || connection.external_data_source !== 'provider_verified') {
          throw new Error('Waiting for Ko-fi to verify the connection with a webhook event.');
        }
      } else {
        throw new Error('This platform is linked for tracking; provider verification is not available.');
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
        capability_status: envName ? 'reauthorization_required' : (connection.capability_status || 'unknown'),
        history: [...(connection.history || []), { at: now, event: 'health_check_failed', detail: message }].slice(-30),
      });
      return Response.json({ working: false, connection: updated, error: message });
    }
  } catch (error) {
    console.error('verifyPlatformConnection error:', error?.message || error);
    return Response.json({ error: 'Unable to check this connection.' }, { status: 500 });
  }
}
