import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import { logAudit } from '../../shared/auditLog.ts';
import { emitIntegrationAlert, isUnhealthy, STATUS_LABEL } from '../../shared/integrationRegistry.ts';

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

function checkSecrets(platform) {
  const names = PLATFORM_SECRETS[platform] || [];
  const missing = names.filter((n) => !secrets.get(n));
  return { names, missing };
}

async function validateEntry(sr, e, now) {
  const checks = [];
  const flags = [];
  let status = e.status === 'REVOKED' ? 'REVOKED' : 'DISCONNECTED';
  let providerVerified = false;
  let lastFailure = '';
  const p = e.platform;

  if (PLATFORM_SECRETS[p]) {
    const { names, missing } = checkSecrets(p);
    checks.push({ check: 'secret_refs_present', ok: missing.length === 0, detail: missing.length ? `missing ${missing.join(', ')}` : `${names.length} reference(s) present` });
    if (missing.length) { status = 'MISCONFIGURED'; lastFailure = `Missing secret reference(s): ${missing.join(', ')}`; }
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
    // Platform-managed OAuth (e.g. the Google login provider) is maintained by
    // Base44, not an app connector — skip the live connector check so it isn't
    // false-flagged as REAUTH_REQUIRED.
    if (String(e.account_identifier || '').toLowerCase().includes('platform-managed')) {
      checks.push({ check: 'platform_managed', ok: true, detail: 'provider-managed; no app-side verification performed' });
    } else {
      try {
        const conn = await sr.connectors?.getConnection?.(p);
        if (conn && conn.accessToken) {
          checks.push({ check: 'oauth_authorized', ok: true, detail: 'provider connection verified' });
          status = 'ACTIVE';
          providerVerified = true;
        } else {
          checks.push({ check: 'oauth_authorized', ok: false, detail: 'no access token' });
          status = status === 'MISCONFIGURED' ? status : 'REAUTH_REQUIRED';
          if (!lastFailure) lastFailure = 'OAuth connector is not authorized.';
        }
      } catch (err) {
        checks.push({ check: 'oauth_authorized', ok: false, detail: err.message || 'connector check failed' });
        status = status === 'MISCONFIGURED' ? status : 'REAUTH_REQUIRED';
        if (!lastFailure) lastFailure = `OAuth check failed: ${err.message || 'unknown'}`;
      }
    }
  }

  if (e.auth_type === 'per_connection') {
    flags.push('decentralized_credentials');
    checks.push({ check: 'per_connection_storage', ok: true, detail: 'credentials stored on PlatformConnection records' });
  }

  // Legacy Convex is intentionally not health-gated in the authoritative
  // Base44 build. Old registry rows may remain for migration history, but they
  // must not generate configuration warnings or block normal platform health.
  if (p === 'convex') {
    checks.push({ check: 'legacy_backend', ok: true, detail: 'legacy backend ignored by Base44 health gate' });
    status = e.status || 'DISCONNECTED';
    lastFailure = '';
    providerVerified = false;
  }

  if (e.dependencies && e.dependencies.length) {
    checks.push({ check: 'dependencies_referenced', ok: true, detail: e.dependencies.join(', ') });
  }

  const alertTitle = isUnhealthy(status) ? `[${p}] ${STATUS_LABEL[status] || status}` : '';
  const alertBody = lastFailure || `Integration "${p}" requires attention: ${status}.`;
  return { status, flags, checks, lastFailure, alertTitle, alertBody, providerVerified };
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const sr = base44.asServiceRole;
    const entries = await sr.entities.PlatformAccessRegistry.list(undefined, 200);
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
        auth_failures: result.status === 'ACTIVE' ? 0 : (e.auth_failures || 0),
      };
      if (result.status === 'ACTIVE' && result.providerVerified) update.last_successful_verification = now;
      await sr.entities.PlatformAccessRegistry.update(e.id, update);

      if (before !== result.status) {
        await logAudit(base44, {
          action: 'integration_status_change',
          actor_user_id: user.id,
          target_type: 'PlatformAccessRegistry',
          target_id: e.id,
          detail: `${e.platform}: ${before} -> ${result.status}`,
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
    console.error('validateIntegrationHealth error:', error.message);
    return Response.json({ error: 'Integration health check could not complete.' }, { status: 500 });
  }
}