import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { logAudit } from '../../shared/auditLog.ts';
import { normalizeIntegrationStatus, safeIntegrationPlatform } from '../../shared/integrationStatusPolicy.js';

const ACTIONS = new Set(['upsert', 'authorize_agent', 'revoke_agent', 'reauthorize', 'revoke', 'change_credential_ref']);
const INTEGRATION_KINDS = new Set(['payment', 'auth', 'social', 'deployment', 'webhook', 'api', 'external_platform']);
const AUTH_TYPES = new Set(['oauth', 'api_key', 'webhook_secret', 'env_config', 'per_connection', 'none']);
const ENVIRONMENTS = new Set(['production', 'development', 'sandbox']);

const boundedString = (value, max = 300) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const boundedList = (value, maxItems = 40, maxLength = 128) => {
  if (!Array.isArray(value) || value.length > maxItems) return null;
  const result = value.map((item) => boundedString(item, maxLength));
  return result.every(Boolean) ? [...new Set(result)] : null;
};

// Admin-only management of the Platform Access Registry. Every mutation is
// audit-logged. Never accepts or stores secret values — only reference names.
// Actions: upsert, authorize_agent, revoke_agent, reauthorize, revoke,
// change_credential_ref. Admins only (403 otherwise) — this is the single
// place credential references, agent permissions, and integration status are
// changed, per least-privilege.

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const sr = base44.asServiceRole;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return Response.json({ error: 'Invalid request.' }, { status: 400 });
    }
    const action = boundedString(body.action, 40);
    const platform = safeIntegrationPlatform(body.platform);
    if (!ACTIONS.has(action) || platform === 'unknown') {
      return Response.json({ error: 'Invalid integration operation.' }, { status: 400 });
    }

    const existing = await sr.entities.PlatformAccessRegistry.filter({ platform });
    const entry = existing[0];
    if (!entry && action !== 'upsert') {
      return Response.json({ error: 'Registry entry not found.' }, { status: 404 });
    }

    const audit = (a) => logAudit(base44, { ...a, actor_user_id: user.id, target_type: 'PlatformAccessRegistry', target_id: entry ? entry.id : '' });

    if (action === 'upsert') {
      const secretRefs = body.secret_refs === undefined ? (entry?.secret_refs || []) : boundedList(body.secret_refs);
      const authorizedAgents = body.authorized_agents === undefined ? (entry?.authorized_agents || []) : boundedList(body.authorized_agents);
      const dependencies = body.dependencies === undefined ? (entry?.dependencies || []) : boundedList(body.dependencies);
      const invalidKind = body.integration_kind !== undefined && !INTEGRATION_KINDS.has(body.integration_kind);
      const invalidAuth = body.auth_type !== undefined && !AUTH_TYPES.has(body.auth_type);
      const invalidEnvironment = body.environment !== undefined && !ENVIRONMENTS.has(body.environment);
      if (!secretRefs || !authorizedAgents || !dependencies || invalidKind || invalidAuth || invalidEnvironment) {
        return Response.json({ error: 'Invalid integration metadata.' }, { status: 400 });
      }
      const integrationKind = INTEGRATION_KINDS.has(body.integration_kind) ? body.integration_kind : (entry?.integration_kind || 'api');
      const authType = AUTH_TYPES.has(body.auth_type) ? body.auth_type : (entry?.auth_type || 'none');
      const environment = ENVIRONMENTS.has(body.environment) ? body.environment : (entry?.environment || 'production');
      const data = {
        platform,
        purpose: boundedString(body.purpose ?? entry?.purpose, 500),
        integration_kind: integrationKind,
        account_identifier: boundedString(body.account_identifier ?? entry?.account_identifier, 200),
        auth_type: authType,
        secret_refs: secretRefs,
        environment,
        authorized_agents: authorizedAgents,
        dependencies,
        reauth_instructions: boundedString(body.reauth_instructions ?? entry?.reauth_instructions, 1000),
        admin_owner: boundedString(body.admin_owner ?? entry?.admin_owner ?? user.email, 200),
        status: entry ? normalizeIntegrationStatus(entry.status) : 'DISCONNECTED',
      };
      let saved;
      if (entry) { saved = await sr.entities.PlatformAccessRegistry.update(entry.id, data); }
      else { saved = await sr.entities.PlatformAccessRegistry.create(data); }
      await audit({ action: 'integration_upserted', detail: `upserted ${platform}`, metadata: { platform, auth_type: data.auth_type } });
      return Response.json({ ok: true, platform, status: normalizeIntegrationStatus(saved.status) });
    }

    if (action === 'authorize_agent' || action === 'revoke_agent') {
      const agent = boundedString(body.agent_name, 128);
      if (!agent) return Response.json({ error: 'agent_name required' }, { status: 400 });
      const list = boundedList(entry.authorized_agents || []);
      if (!list) return Response.json({ error: 'Stored integration metadata requires repair.' }, { status: 409 });
      const next = action === 'authorize_agent' ? (list.includes(agent) ? list : [...list, agent]) : list.filter((a) => a !== agent);
      if (next.length > 40) return Response.json({ error: 'Too many authorized agents.' }, { status: 400 });
      await sr.entities.PlatformAccessRegistry.update(entry.id, {
        authorized_agents: next,
        status: normalizeIntegrationStatus(entry.status),
      });
      await audit({ action: 'agent_permission_change', detail: `${action} ${agent} on ${platform}`, status: 'success', metadata: { platform, agent, action } });
      return Response.json({ ok: true, platform, authorized_agents: boundedList(next) || [] });
    }

    if (action === 'reauthorize') {
      const currentStatus = normalizeIntegrationStatus(entry.status);
      const nextStatus = currentStatus === 'MISCONFIGURED' ? 'MISCONFIGURED' : 'REAUTH_REQUIRED';
      const saved = await sr.entities.PlatformAccessRegistry.update(entry.id, {
        status: nextStatus,
        last_failure: nextStatus === 'MISCONFIGURED'
          ? 'Required provider configuration is missing.'
          : 'Provider verification required before activation.',
      });
      await audit({ action: 'reauthorization_requested', detail: `reauthorization requested for ${platform}`, metadata: { platform } });
      return Response.json({ ok: true, platform, status: normalizeIntegrationStatus(saved.status), verification_required: true });
    }

    if (action === 'revoke') {
      await sr.entities.PlatformAccessRegistry.update(entry.id, { status: 'REVOKED', last_failure: 'Integration access is revoked.' });
      await audit({ action: 'revocation', detail: `revoked ${platform}`, metadata: { platform } });
      return Response.json({ ok: true, platform, status: 'REVOKED' });
    }

    if (action === 'change_credential_ref') {
      const refs = boundedList(body.secret_refs);
      if (!refs) return Response.json({ error: 'Invalid integration metadata.' }, { status: 400 });
      await sr.entities.PlatformAccessRegistry.update(entry.id, {
        secret_refs: refs,
        status: normalizeIntegrationStatus(entry.status),
      });
      await audit({ action: 'credential_reference_change', detail: `updated secret references for ${platform}`, metadata: { platform, secret_ref_count: refs.length } });
      return Response.json({ ok: true, platform, secret_ref_count: refs.length, status: normalizeIntegrationStatus(entry.status) });
    }

    return Response.json({ error: 'Invalid integration operation.' }, { status: 400 });
  } catch (error) {
    console.error('managePlatformAccess error:', error?.name || 'UnknownError');
    return Response.json({ error: 'Could not update the integration registry.' }, { status: 500 });
  }
}
