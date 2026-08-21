import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Convex is authoritative for persistent agent memory and outcomes.
const CONVEX_MUTATION_URL = 'https://rosy-butterfly-2.convex.cloud/api/mutation';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const payload = {
      path: 'agentBridge:recordInteraction',
      args: {
        canonicalAgentId: String(body.canonicalAgentId || ''),
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

    const res = await fetch(CONVEX_MUTATION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.status === 'error') {
      return Response.json({ error: json.errorMessage || `Convex ${res.status}` }, { status: 502 });
    }
    return Response.json({ ok: true, result: json.status === 'success' ? json.value : json });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
