import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { browserRunDecision } from '../../shared/browserConnectionPolicy.js';

const SAFE_UNAVAILABLE = 'External browser checks are unavailable until their network and usage controls are verified.';

// Read-only browser observations are intentionally fail-closed. Base44 does
// not currently expose a repository-verifiable atomic quota reservation plus
// DNS-resolution pinning/private-egress denial boundary. Starting a paid
// Browserbase job without those controls would permit duplicate charges and
// SSRF/rebinding risk. This function preserves the authenticated capability
// boundary while refusing to spend or make an external request.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    if (body?.action !== 'GET_METRICS' || typeof body?.connection_id !== 'string' || !body.connection_id) {
      return Response.json({ error: 'A connection and supported read action are required.' }, { status: 400 });
    }

    const connection = await base44.entities.PlatformConnection.get(body.connection_id).catch(() => null);
    if (!connection || connection.created_by_id !== user.id) {
      return Response.json({ error: 'Connection not found.' }, { status: 404 });
    }
    const campaign = connection.campaign_id
      ? await base44.entities.Campaign.get(connection.campaign_id).catch(() => null)
      : null;

    const decision = browserRunDecision({
      user,
      connection,
      campaign,
      action: body.action,
      atomicReservationAvailable: false,
      dnsPinningAvailable: false,
      privateEgressDenialProven: false,
    });
    if (decision.reason === 'authorization_required') {
      return Response.json({ error: 'Browser access is not authorized for this connection.' }, { status: 403 });
    }

    return Response.json({
      error: SAFE_UNAVAILABLE,
      code: 'browser_execution_deferred',
      external_only: true,
      provider_verified: false,
      financial_data_created: false,
    }, { status: 503 });
  } catch (error) {
    console.error('runBrowserConnection denied:', error?.name || 'UnknownError');
    return Response.json({ error: SAFE_UNAVAILABLE }, { status: 503 });
  }
}
