import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Convex is authoritative for persistent agent memory and outcomes.
const CONVEX_MUTATION_URL = 'https://rosy-butterfly-2.convex.cloud/api/mutation';
const ALLOWED_KEYS = new Set([
  'canonicalAgentId',
  'source',
  'action',
  'summary',
  'outcome',
  'campaignId',
  'approved',
]);

function boundedText(value, max, fallback = '') {
  return typeof value === 'string' ? value.trim().slice(0, max) : fallback;
}

function safeDiagnostic(value) {
  try {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    const type = typeof value;
    if (type !== 'object' && type !== 'function') return type;
    return 'object';
  } catch {
    return 'unknown';
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export default async function(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', Allow: 'POST' },
    });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    if (!isPlainObject(body)) {
      return Response.json({ error: 'Invalid request body.' }, { status: 400 });
    }
    for (const key of Object.keys(body)) {
      if (!ALLOWED_KEYS.has(key)) {
        return Response.json({ error: 'Invalid request body.' }, { status: 400 });
      }
    }

    const canonicalAgentId = boundedText(body.canonicalAgentId, 128);
    const source = boundedText(body.source, 64, 'base44_agent_chat');
    const action = boundedText(body.action, 128, 'conversation');
    const summary = boundedText(body.summary, 2000);
    const outcome = body.outcome === undefined ? undefined : boundedText(body.outcome, 1000);
    const campaignId = body.campaignId === undefined ? undefined : boundedText(body.campaignId, 128);
    if (!canonicalAgentId || !summary || !source || !action) {
      return Response.json({ error: 'Invalid request body.' }, { status: 400 });
    }
    if (body.approved !== undefined && typeof body.approved !== 'boolean') {
      return Response.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const payload = {
      path: 'agentBridge:recordInteraction',
      args: {
        canonicalAgentId,
        source,
        action,
        summary,
        outcome,
        campaignId,
        userId: boundedText(user.id, 128),
        approved: typeof body.approved === 'boolean' ? body.approved : undefined,
      },
      format: 'json',
    };

    const res = await fetch(CONVEX_MUTATION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !isPlainObject(json) || json.status === 'error') {
      console.error('recordAgentInteraction Convex failure:', safeDiagnostic(json));
      return Response.json({ error: 'Unable to record the agent interaction.' }, { status: 502 });
    }
    if (json.status !== 'success' || !Object.prototype.hasOwnProperty.call(json, 'value')) {
      console.error('recordAgentInteraction Convex malformed response:', safeDiagnostic(json));
      return Response.json({ error: 'Unable to record the agent interaction.' }, { status: 502 });
    }
    return Response.json({ ok: true, result: json.value });
  } catch (error) {
    console.error('recordAgentInteraction failure:', safeDiagnostic(error));
    return Response.json({ error: 'Unable to record the agent interaction.' }, { status: 500 });
  }
}
