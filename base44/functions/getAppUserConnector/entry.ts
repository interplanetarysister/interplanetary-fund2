import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { OAUTH_ENV } from '../../shared/connectionVerification.ts';


export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { platform } = await req.json().catch(() => ({}));
    const envName = OAUTH_ENV[String(platform || '').toLowerCase()];
    if (!envName) return Response.json({ configured: false, supported: false });

    const connectorId = Deno.env.get(envName) || '';
    return Response.json({
      configured: !!connectorId,
      supported: true,
      // Base44's documented backend connector API does not expose a supported
      // per-user OAuth launch method. Do not disclose the internal connector id
      // merely to bootstrap a client-side redirect.
      launch_available: false,
      reason: connectorId ? 'secure_oauth_launch_unavailable' : 'connector_not_configured',
    });
  } catch (error) {
    console.error('getAppUserConnector error:', error?.message || error);
    return Response.json({ error: 'Unable to prepare this connection.' }, { status: 500 });
  }
}
