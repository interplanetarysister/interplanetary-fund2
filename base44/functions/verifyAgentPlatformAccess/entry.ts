import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { logAudit } from '../../shared/auditLog.ts';
import { assertOboGrant } from '../../shared/integrationRegistry.ts';
import { normalizeIntegrationStatus, safeIntegrationPlatform } from '../../shared/integrationStatusPolicy.js';

// Agent-access gatekeeper. Before an agent (or a backend function acting on an
// agent's behalf) uses an external platform, it calls this to: locate the
// registry entry, verify the environment, confirm the agent is authorized, and
// confirm the integration is healthy. On success it returns the secret
// REFERENCE NAMES (never values) the caller must then load through the
// protected secret mechanism. Every call is audit-logged. Caller-controlled
// service-role assertions are not accepted; absent a Base44 user identity, the
// request fails closed.

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const user = await base44.auth.me().catch(() => null);
    if (!user?.id) return Response.json({ authorized: false, reason: 'authentication required' }, { status: 401 });

    const body = await req.json().catch(() => null);
    const agentName = typeof body?.agent_name === 'string' ? body.agent_name.trim().slice(0, 128) : '';
    const platform = safeIntegrationPlatform(body?.platform);
    const task = typeof body?.task === 'string' ? body.task.trim().slice(0, 128) : 'access';
    const oboUserId = typeof body?.obo_user_id === 'string' ? body.obo_user_id.trim().slice(0, 128) : '';
    if (!agentName || platform === 'unknown') {
      return Response.json({ error: 'agent_name and platform are required' }, { status: 400 });
    }
    if (user.role !== 'admin' && (!oboUserId || oboUserId !== user.id)) {
      return Response.json({ authorized: false, reason: 'owner authorization required' }, { status: 403 });
    }

    const entries = await sr.entities.PlatformAccessRegistry.filter({ platform });
    const entry = entries[0];

    let authorized = false;
    let reason = 'no registry entry for platform';

    if (entry) {
      const authorizedAgents = Array.isArray(entry.authorized_agents) ? entry.authorized_agents : [];
      const status = normalizeIntegrationStatus(entry.status);
      if (!authorizedAgents.includes(agentName)) {
        reason = `agent "${agentName}" is not authorized for "${platform}"`;
      } else if (status !== 'ACTIVE') {
        authorized = false;
        reason = `integration status is ${status}`;
      } else if (entry.environment && entry.environment !== 'production') {
        authorized = false;
        reason = `environment is ${entry.environment}, not production`;
      } else {
        authorized = true;
        reason = 'authorized';
      }
    }

    // OBO: a saved platform credential is NOT authorization to act for a user.
    // When the caller specifies an on-behalf-of user, require an explicit, active
    // AuthorizationGrant for (agent, user, platform) — integrated with the
    // existing registry/gatekeeper, not a parallel auth system.
    if (authorized && oboUserId) {
      const grant = await assertOboGrant(sr, agentName, oboUserId, platform);
      if (!grant.ok) {
        authorized = false;
        reason = grant.reason;
      }
    }

    await logAudit(base44, {
      action: 'agent_integration_access',
      actor_user_id: user.id,
      target_type: 'PlatformAccessRegistry',
      target_id: entry ? entry.id : '',
      detail: `agent=${agentName} platform=${platform} task=${task} authorized=${authorized} (${reason})`,
      status: authorized ? 'success' : 'failure',
      metadata: { agent_name: agentName, platform, task, authorized, reason },
    });

    // Never return secret values — only the reference names the caller must
    // load through the protected secret mechanism, and only when authorized.
    return Response.json({
      authorized,
      status: entry ? normalizeIntegrationStatus(entry.status) : null,
      environment: entry ? entry.environment : null,
      secret_refs: authorized ? (entry.secret_refs || []) : [],
      reason,
    });
  } catch (error) {
    console.error('verifyAgentPlatformAccess error:', error?.name || 'UnknownError');
    return Response.json({ authorized: false, reason: 'verification failed' }, { status: 500 });
  }
}
