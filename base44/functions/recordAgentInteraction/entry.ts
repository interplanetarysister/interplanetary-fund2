import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveConvex } from '../../shared/integrationRegistry.ts';

// Convex is authoritative for persistent agent memory and outcomes. Resolve its
// endpoint from protected Base44 configuration instead of a hardcoded host.

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const requestedAgent = String(body.canonicalAgentId || body.agentName || '');
    if (requestedAgent === 'builder_agent' && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const payload = {
      path: 'agentBridge:recordInteraction',
      args: {
        canonicalAgentId: requestedAgent,
        source: String(body.source || 'base44_agent_chat'),
        action: String(body.action || 'conversation'),
        summary: String(body.summary || '').slice(0, 2000),
        outcome: body.outcome ? String(body.outcome) : undefined,
        campaignId: body.campaignId ? String(body.campaignId) : undefined,
        userId: String(user.id || ''),
        approved: typeof body.approved === 'boolean' ? body.approved : undefined,
      },
      format: 'json',
    };

    const resolved = resolveConvex(Deno.env.get('CONVEX_QUERY_URL'));
    if (!resolved.url) return Response.json({ error: 'Agent memory backend is not configured.' }, { status: 503 });
    const mutationUrl = resolved.url.replace(/\/api\/query$/, '/api/mutation');

    const res = await fetch(mutationUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.status === 'error') {
      console.error('recordAgentInteraction Convex error:', json.errorMessage || `Convex ${res.status}`);
      return Response.json({ error: 'Unable to record the agent interaction.' }, { status: 502 });
    }
    return Response.json({ ok: true, result: json.status === 'success' ? json.value : json });
  } catch (error) {
    console.error('recordAgentInteraction error:', error.message);
    return Response.json({ error: 'Unable to record the agent interaction.' }, { status: 500 });
  }
}