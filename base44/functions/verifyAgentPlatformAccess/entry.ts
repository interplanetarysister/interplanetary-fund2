import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { logAudit } from '../../shared/auditLog.ts';
import { assertOboGrant } from '../../shared/integrationRegistry.ts';

const MAX_TEXT = 200;
const MAX_ID = 200;

function jsonError(error, status) {
  return Response.json({ error }, { status });
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function boundedText(value, fallback = '', max = MAX_TEXT) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  return normalized ? normalized.slice(0, max) : fallback;
}

function normalizeId(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > MAX_ID || /[\u0000-\u001F\u007F]/.test(normalized)) return null;
  return normalized;
}

function diagnosticType(value) {
  const tag = Object.prototype.toString.call(value);
  if (tag === '[object Error]') return 'error';
  if (tag === '[object String]') return 'string';
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  return tag.slice(8, -1).toLowerCase() || 'unknown';
}

export default async function(req) {
  if (req?.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed.' }), {
      status: 405,
      headers: { 'content-type': 'application/json', allow: 'POST' },
    });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid request body.', 400);
  }
  if (!isObject(body)) return jsonError('Invalid request body.', 400);

  const agentName = normalizeId(body.agent_name);
  const platform = normalizeId(body.platform);
  const task = boundedText(body.task, 'access');
  const oboUserId = body.obo_user_id == null ? null : normalizeId(body.obo_user_id);
  const allowedKeys = new Set(['agent_name', 'platform', 'task', 'obo_user_id']);
  if (Object.keys(body).some((key) => !allowedKeys.has(key))) return jsonError('Invalid request body.', 400);
  if (!agentName || !platform || (body.obo_user_id != null && !oboUserId)) {
    return jsonError('agent_name and platform are required', 400);
  }

  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    let user = null;
    try { user = await base44.auth.me(); } catch (_) { /* service-to-service call: no user context */ }

    const entries = await sr.entities.PlatformAccessRegistry.filter({ platform });
    const entry = entries[0];

    let authorized = false;
    let reason = 'no registry entry for platform';

    if (entry) {
      const authorizedAgents = Array.isArray(entry.authorized_agents) ? entry.authorized_agents : [];
      const status = entry.status || 'ACTIVE';
      if (!authorizedAgents.includes(agentName)) {
        reason = 'agent is not authorized for platform';
      } else if (status !== 'ACTIVE') {
        reason = 'integration is inactive';
      } else if (entry.environment && entry.environment !== 'production') {
        reason = 'integration environment is not production';
      } else {
        authorized = true;
        reason = 'authorized';
      }
    }

    if (authorized && oboUserId) {
      const grant = await assertOboGrant(sr, agentName, oboUserId, platform);
      if (!grant.ok) {
        authorized = false;
        reason = boundedText(grant.reason, 'on-behalf-of authorization denied');
      }
    }

    await logAudit(base44, {
      action: 'agent_integration_access',
      actor_user_id: (user && user.id) || agentName,
      target_type: 'PlatformAccessRegistry',
      target_id: entry ? boundedText(entry.id, '', MAX_ID) : '',
      detail: `agent=${agentName} platform=${platform} task=${task} authorized=${authorized}`,
      status: authorized ? 'success' : 'failure',
      metadata: { agent_name: agentName, platform, task, authorized },
    });

    return Response.json({
      authorized,
      status: entry ? entry.status : null,
      environment: entry ? entry.environment : null,
      secret_refs: authorized && Array.isArray(entry.secret_refs) ? entry.secret_refs : [],
      reason,
    });
  } catch (error) {
    console.error('verifyAgentPlatformAccess failed', { diagnostic_type: diagnosticType(error) });
    return Response.json({ authorized: false, reason: 'verification failed' }, { status: 500 });
  }
}