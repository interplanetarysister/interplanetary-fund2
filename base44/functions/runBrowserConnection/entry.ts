import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Owner-scoped, read-only bridge to a separately hosted Python browser worker.
// The worker observes external pages; it does not create donations, funds, or
// provider-verified connection state. Never expose its signing key to clients.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const connectionId = String(body.connection_id || '');
    if (!connectionId || body.action !== 'GET_METRICS') {
      return Response.json({ error: 'A connection and supported read action are required.' }, { status: 400 });
    }
    const connection = await base44.entities.PlatformConnection.get(connectionId).catch(() => null);
    if (!connection || connection.created_by_id !== user.id) {
      return Response.json({ error: 'Connection not found.' }, { status: 404 });
    }
    if (connection.kind !== 'crowdfunding' || !connection.external_url || !connection.campaign_id) {
      return Response.json({ error: 'Link this connection to your campaign and external page first.' }, { status: 400 });
    }
    const campaign = await base44.entities.Campaign.get(connection.campaign_id).catch(() => null);
    if (!campaign || campaign.created_by_id !== user.id) {
      return Response.json({ error: 'Campaign ownership could not be verified.' }, { status: 403 });
    }
    // All browser reads require explicit owner consent. The endpoint cannot
    // infer from the request whether an agent supplied the caller's token.
    if (!(connection.obo_consent?.granted === true &&
      connection.agent_access?.shared_with_agents === true &&
      (connection.obo_consent?.granted_capabilities || []).includes('GET_METRICS'))) {
      return Response.json({ error: 'Browser access is not authorized for this connection.' }, { status: 403 });
    }

    const endpoint = Deno.env.get('BROWSER_WORKER_URL') || '';
    const secret = Deno.env.get('BROWSER_WORKER_SIGNING_KEY') || '';
    if (!endpoint.startsWith('https://') || !secret || secret.length < 32) {
      return Response.json({ error: 'Browser connection service is not configured.' }, { status: 503 });
    }
    const payload = JSON.stringify({
      owner_id: user.id,
      platform: connection.platform,
      resource_id: connection.id,
      url: connection.external_url,
      action: 'GET_METRICS',
    });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`));
    const signature = Array.from(new Uint8Array(signed), (b) => b.toString(16).padStart(2, '0')).join('');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    let response;
    try {
      response = await fetch(`${endpoint.replace(/\/$/, '')}/observe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-IF-Timestamp': timestamp, 'X-IF-Signature': signature },
        body: payload,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) return Response.json({ error: 'Browser connection needs attention.' }, { status: 502 });
    const observation = await response.json();
    if (observation.status !== 'observed' || observation.external_only !== true ||
        observation.platform !== connection.platform || observation.resource_id !== connection.id ||
        !observation.data || typeof observation.data !== 'object') {
      return Response.json({ error: 'Browser observation could not be verified.' }, { status: 502 });
    }
    return Response.json({ status: 'observed', external_only: true, source: 'browser',
      observed_at: observation.observed_at, data: observation.data });
  } catch (error) {
    console.error('runBrowserConnection failed:', error?.message || 'unknown error');
    return Response.json({ error: 'Browser connection needs attention.' }, { status: 502 });
  }
}
