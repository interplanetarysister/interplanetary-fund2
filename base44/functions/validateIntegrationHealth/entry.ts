import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import { logAudit } from '../../shared/auditLog.ts';
import { emitIntegrationAlert, isUnhealthy, STATUS_LABEL, resolveConvex } from '../../shared/integrationRegistry.ts';

// Admin-triggered health validator. Reads every PlatformAccessRegistry entry,
// validates what can safely be checked WITHOUT exposing secrets, updates each
// entry's status/last_verified/flags, emits deduped admin alerts for unhealthy
// integrations, and audit-logs status changes. No destructive tests, no fake
// transactions. Not scheduled — run on demand from the admin dashboard so it
// only fires when there is cause.

const PLATFORM_SECRETS = {
  stripe: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
  paypal: ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_MODE'],
};

const SAFE_FAILURE = 'Integration health check could not complete.';
const SAFE_ROW_FAILURE = 'Integration registry response was unavailable.';

function safeThrownKind(value) {
  try {
    if (value === null) return 'nullish';
    if (value === undefined) return 'nullish';
    const type = typeof value;
    if (type === 'object') return 'object';
    if (type === 'function') return 'function';
    return type;
  } catch {
    return 'unknown';
  }
}

function safeFailure(kind, value) {
  return `${kind}:${safeThrownKind(value)}`;
}

function isValidRegistryEntry(value) {
  return !!value && typeof value === 'object' && typeof value.id === 'string' && typeof value.platform === 'string';
}

function classifyProbePayload(payload) {
  if (!payload || typeof payload !== 'object') return 'ambiguous';
  if (payload.status === 'success') return 'success';
  if (payload.status === 'error') return 'error';
  return 'ambiguous';
}

function checkSecrets(platform) {
  const names = PLATFORM_SECRETS[platform] || [];
  const missing = names.filter((n) => !secrets.get(n));
  return { names, missing };
}

async function validateEntry(sr, e, now) {
  const checks = [];
  const flags = [];
  let status = 'ACTIVE';
  let lastFailure = '';
  const p = e.platform;

  if (PLATFORM_SECRETS[p]) {
    const { names, missing } = checkSecrets(p);
    checks.push({ check: 'secret_refs_present', ok: missing.length === 0, detail: missing.length ? `missing ${missing.length} configured reference(s)` : `${names.length} reference(s) present` });
    if (missing.length) { status = 'MISCONFIGURED'; lastFailure = `Missing ${missing.length} required secret reference(s).`; }
    if (p === 'paypal') {
      const mode = (secrets.get('PAYPAL_MODE') || '').toLowerCase();
      if (mode.includes('sandbox') && e.environment === 'production') {
        flags.push('dev_creds_in_prod');
        status = 'MISCONFIGURED';
        if (!lastFailure) lastFailure = 'Sandbox credentials referenced by a production registry entry.';
      }
    }
  }

  if (e.auth_type === 'oauth') {
    if (String(e.account_identifier || '').toLowerCase().includes('platform-managed')) {
      checks.push({ check: 'platform_managed', ok: true, detail: 'platform-managed login provider' });
    } else {
      try {
        const conn = await sr.connectors?.getConnection?.(p);
        if (conn && conn.accessToken) {
          checks.push({ check: 'oauth_authorized', ok: true, detail: 'access token present' });
        } else {
          checks.push({ check: 'oauth_authorized', ok: false, detail: 'no access token' });
          status = status === 'ACTIVE' ? 'REAUTH_REQUIRED' : status;
          if (!lastFailure) lastFailure = 'OAuth connector is not authorized.';
        }
      } catch (err) {
        checks.push({ check: 'oauth_authorized', ok: false, detail: safeFailure('oauth_check_failed', err) });
        status = status === 'ACTIVE' ? 'REAUTH_REQUIRED' : status;
        if (!lastFailure) lastFailure = 'OAuth connector check failed.';
      }
    }
  }

  if (e.auth_type === 'per_connection') {
    flags.push('decentralized_credentials');
    checks.push({ check: 'per_connection_storage', ok: true, detail: 'credentials stored on PlatformConnection records' });
  }

  if (p === 'convex') {
    const resolved = resolveConvex(secrets.get('CONVEX_QUERY_URL'));
    const cToken = secrets.get('CONVEX_AUTH_TOKEN');
    checks.push({ check: 'centralized_endpoint', ok: !!resolved.url, detail: resolved.url ? 'endpoint configured' : 'CONVEX_QUERY_URL is invalid or unavailable' });
    if (!resolved.url) {
      flags.push('bypasses_central_access');
      status = 'MISCONFIGURED';
      if (!lastFailure) lastFailure = 'Centralized Convex endpoint is not configured or is malformed.';
    } else {
      checks.push({ check: 'convex_auth', ok: !!cToken, detail: cToken ? 'auth token configured' : 'no auth token configured' });
      try {
        const probeHeaders = { 'Content-Type': 'application/json' };
        if (cToken) probeHeaders['Authorization'] = `Bearer ${cToken}`;
        const probeRes = await fetch(resolved.url, {
          method: 'POST', headers: probeHeaders,
          body: JSON.stringify({ path: 'agents:getAgents', args: {}, format: 'json' }),
        });
        const pj = await probeRes.json().catch(() => null);
        const probeStatus = classifyProbePayload(pj);
        if (probeRes.status === 401) {
          checks.push({ check: 'convex_auth_probe', ok: false, detail: 'authentication rejected' });
          status = 'REAUTH_REQUIRED';
          if (!lastFailure) lastFailure = 'Convex rejected the configured auth token.';
        } else if (!probeRes.ok || probeStatus !== 'success') {
          checks.push({ check: 'convex_auth_probe', ok: false, detail: probeStatus === 'error' ? 'deployment returned an error' : 'deployment response was ambiguous' });
          status = status === 'ACTIVE' ? 'DISCONNECTED' : status;
          if (!lastFailure) lastFailure = 'Convex probe did not return explicit success evidence.';
        } else {
          checks.push({ check: 'convex_auth_probe', ok: true, detail: 'endpoint returned explicit success evidence' });
        }
      } catch (err) {
        checks.push({ check: 'convex_auth_probe', ok: false, detail: safeFailure('convex_probe_failed', err) });
        status = status === 'ACTIVE' ? 'DISCONNECTED' : status;
        if (!lastFailure) lastFailure = 'Convex probe failed.';
      }
    }
  }

  if (e.dependencies && Array.isArray(e.dependencies) && e.dependencies.length) {
    checks.push({ check: 'dependencies_referenced', ok: true, detail: `${e.dependencies.length} dependency reference(s)` });
  }

  const alertTitle = isUnhealthy(status) ? `[${p}] ${STATUS_LABEL[status] || status}` : '';
  const alertBody = lastFailure || `Integration requires attention: ${status}.`;
  return { status, flags, checks, lastFailure, alertTitle, alertBody };
}

export default async function(req) {
  try {
    if (req?.method && req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: { Allow: 'POST' } });
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const sr = base44.asServiceRole;
    const rawEntries = await sr.entities.PlatformAccessRegistry.list(undefined, 200);
    if (!Array.isArray(rawEntries)) return Response.json({ error: SAFE_ROW_FAILURE }, { status: 503 });
    const entries = rawEntries.filter(isValidRegistryEntry);
    if (entries.length !== rawEntries.length) return Response.json({ error: SAFE_ROW_FAILURE }, { status: 503 });
    const now = new Date().toISOString();
    const report = [];

    for (const e of entries) {
      const before = e.status;
      const result = await validateEntry(sr, e, now);

      const update = {
        last_verified: now,
        status: result.status,
        cleanup_flags: result.flags,
        last_failure: result.lastFailure || '',
        auth_failures: result.status === 'ACTIVE' ? 0 : (Number.isFinite(e.auth_failures) ? e.auth_failures : 0),
      };
      if (result.status === 'ACTIVE') update.last_successful_verification = now;
      await sr.entities.PlatformAccessRegistry.update(e.id, update);

      if (before !== result.status) {
        await logAudit(base44, {
          action: 'integration_status_change',
          actor_user_id: user.id,
          target_type: 'PlatformAccessRegistry',
          target_id: e.id,
          detail: `${e.platform}: ${before || 'unknown'} -> ${result.status}`,
          status: 'success',
          metadata: { platform: e.platform, from: before, to: result.status, flags: result.flags },
        });
      }

      if (isUnhealthy(result.status)) {
        await emitIntegrationAlert(sr, { ...e, status: result.status }, result.alertTitle, result.alertBody);
      }

      report.push({ platform: e.platform, status: result.status, flags: result.flags, checks: result.checks });
    }

    return Response.json({ ok: true, checked: entries.length, at: now, report });
  } catch (error) {
    console.error('validateIntegrationHealth failed', safeFailure('outer_failure', error));
    return Response.json({ error: SAFE_FAILURE }, { status: 500 });
  }
}