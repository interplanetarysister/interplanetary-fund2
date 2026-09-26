import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import { logAudit } from '../../shared/auditLog.ts';
import { emitIntegrationAlert, isUnhealthy, STATUS_LABEL } from '../../shared/integrationRegistry.ts';
import {
  mergeIntegrationStatus,
  normalizeIntegrationStatus,
  safeIntegrationFailure,
  safeIntegrationPlatform,
} from '../../shared/integrationStatusPolicy.js';

const MAX_ENTRIES = 200;
const PLATFORM_SECRETS = {
  stripe: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
  paypal: ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_MODE'],
};

function checkSecrets(platform) {
  const names = PLATFORM_SECRETS[platform] || [];
  const missing = names.filter((name) => !secrets.get(name));
  return { configured: names.length > 0 && missing.length === 0, missing: missing.length > 0 };
}

function safeFlags(values) {
  return [...new Set(values)].filter((value) => typeof value === 'string').slice(0, 20);
}

async function validateEntry(sr, entry) {
  const platform = safeIntegrationPlatform(entry?.platform);
  const currentStatus = normalizeIntegrationStatus(entry?.status);
  let status = mergeIntegrationStatus(currentStatus, 'DISCONNECTED');
  let providerVerified = false;
  const flags = [];
  const checks = [];

  if (currentStatus === 'REVOKED') {
    return {
      platform,
      status: 'REVOKED',
      providerVerified,
      flags,
      checks: [{ check: 'revoked', ok: false }],
      lastFailure: safeIntegrationFailure('REVOKED'),
    };
  }

  if (PLATFORM_SECRETS[platform]) {
    const configuration = checkSecrets(platform);
    checks.push({ check: 'provider_configuration', ok: configuration.configured });
    if (configuration.missing) status = mergeIntegrationStatus(status, 'MISCONFIGURED');
    if (platform === 'paypal') {
      const mode = String(secrets.get('PAYPAL_MODE') || '').toLowerCase();
      if (mode.includes('sandbox') && entry?.environment === 'production') {
        flags.push('dev_creds_in_prod');
        status = mergeIntegrationStatus(status, 'MISCONFIGURED');
      }
    }
  }

  if (entry?.auth_type === 'oauth') {
    if (String(entry?.account_identifier || '').toLowerCase().includes('platform-managed')) {
      checks.push({ check: 'provider_managed', ok: false });
      status = mergeIntegrationStatus(status, 'DISCONNECTED');
    } else {
      try {
        const connection = await sr.connectors?.getConnection?.(platform);
        const configured = Boolean(connection?.accessToken);
        checks.push({ check: 'oauth_configuration', ok: configured });
        status = mergeIntegrationStatus(status, configured ? 'DISCONNECTED' : 'REAUTH_REQUIRED');
      } catch {
        checks.push({ check: 'oauth_configuration', ok: false });
        status = mergeIntegrationStatus(status, 'REAUTH_REQUIRED');
      }
    }
  }

  if (entry?.auth_type === 'per_connection') {
    flags.push('decentralized_credentials');
    checks.push({ check: 'per_connection_storage', ok: false });
    status = mergeIntegrationStatus(status, 'DISCONNECTED');
  }

  if (platform === 'convex') {
    checks.push({ check: 'historical_backend', ok: false });
    status = mergeIntegrationStatus(currentStatus, 'DISCONNECTED');
    providerVerified = false;
  }

  status = mergeIntegrationStatus(currentStatus, status, { providerVerified });
  return {
    platform,
    status,
    providerVerified,
    flags: safeFlags(flags),
    checks: checks.slice(0, 20).map((check) => ({ check: String(check.check).slice(0, 64), ok: check.ok === true })),
    lastFailure: safeIntegrationFailure(status),
  };
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const sr = base44.asServiceRole;
    const listed = await sr.entities.PlatformAccessRegistry.list(undefined, MAX_ENTRIES);
    if (!Array.isArray(listed) || listed.length > MAX_ENTRIES) {
      return Response.json({ error: 'Integration registry response was invalid.' }, { status: 502 });
    }

    const now = new Date().toISOString();
    const report = [];

    for (const entry of listed) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry) || !entry.id) {
        throw new Error('InvalidRegistryEntry');
      }

      const before = normalizeIntegrationStatus(entry.status);
      const result = await validateEntry(sr, entry);
      const update = {
        last_verified: now,
        status: result.status,
        cleanup_flags: result.flags,
        last_failure: result.lastFailure,
        auth_failures: result.status === 'ACTIVE' && result.providerVerified
          ? 0
          : Math.max(0, Number.isFinite(entry.auth_failures) ? entry.auth_failures : 0),
      };
      if (result.status === 'ACTIVE' && result.providerVerified) {
        update.last_successful_verification = now;
      }

      await sr.entities.PlatformAccessRegistry.update(entry.id, update);

      if (before !== result.status || entry.status !== before) {
        await logAudit(base44, {
          action: 'integration_status_change',
          actor_user_id: user.id,
          target_type: 'PlatformAccessRegistry',
          target_id: entry.id,
          detail: `${result.platform}: ${before} -> ${result.status}`,
          status: 'success',
          metadata: { platform: result.platform, from: before, to: result.status, flags: result.flags },
        });
      }

      const legacyConvex = result.platform === 'convex';
      if (!legacyConvex && isUnhealthy(result.status)) {
        const label = STATUS_LABEL[result.status] || STATUS_LABEL.DISCONNECTED;
        await emitIntegrationAlert(
          sr,
          { ...entry, platform: result.platform, status: result.status },
          `[${result.platform}] ${label}`,
          result.lastFailure,
        );
      }

      report.push({
        platform: result.platform,
        status: result.status,
        flags: result.flags,
        checks: result.checks,
      });
    }

    return Response.json({ ok: true, checked: report.length, at: now, report });
  } catch (error) {
    console.error('validateIntegrationHealth error:', error?.name || 'UnknownError');
    return Response.json({ error: 'Integration health check could not complete.' }, { status: 500 });
  }
}

