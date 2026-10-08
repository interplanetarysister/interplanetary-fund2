import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { OAUTH_ENV } from '../../shared/connectionVerification.ts';

// Explicit second step: completed OAuth login -> optional AI delegation.
// The provider still owns the credential; we store no login/password/token.
const CONSENT_VERSION = '2026-10-unified-obo-v1';

export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Sign in to finish your connection.' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const connectionId = String(body.connection_id || '').trim();
    const allowAi = body.allow_ai;
    if (!connectionId || typeof allowAi !== 'boolean')
      return Response.json({ error: 'A connection and AI permission choice are required.' }, { status: 400 });

    // User-scoped lookup first, preventing a caller from granting OBO for
    // someone else's connection through privileged SDK reads.
    const connection = await base44.entities.PlatformConnection.get(connectionId).catch(() => null);
    if (!connection || connection.created_by_id !== user.id)
      return Response.json({ error: 'Connection not found.' }, { status: 404 });
    const sr = base44.asServiceRole;
    const full = await sr.entities.PlatformConnection.get(connectionId).catch(() => null);
    if (!full || full.created_by_id !== user.id || full.platform !== connection.platform)
      return Response.json({ error: 'Connection not found.' }, { status: 404 });

    const env = OAUTH_ENV[full.platform];
    const connectorId = env ? (Deno.env.get(env) || '') : '';
    if (!connectorId) return Response.json({ error: 'Provider authorization is not configured.' }, { status: 409 });
    const oauth = await sr.connectors.getCurrentAppUserConnection(connectorId).catch(() => null);
    if (!oauth?.accessToken)
      return Response.json({ error: 'Finish the provider sign-in before choosing AI permissions.' }, { status: 409 });

    const now = new Date().toISOString();
    if (allowAi && user.ai_obo_consent?.granted !== true) {
      // This is the user's explicit unified authorization decision. It does not
      // auto-enable older per-connection grants or bypass provider scopes.
      const shared = { granted: true, decided_at: now, permission_version: CONSENT_VERSION };
      await base44.auth.updateMe({
        ai_obo_consent: shared,
        ai_publishing_consent: { granted: true, decided_at: now },
        ai_connection_consent: { granted: true, decided_at: now },
      });
    }

    const permissions = full.obo_consent || {};
    const providerCaps = Array.isArray(permissions.provider_capabilities)
      ? permissions.provider_capabilities : [];
    const updated = await sr.entities.PlatformConnection.update(full.id, {
      // The initial authorization never promises the ability to publish or
      // message. Actual supported capability checks happen in each action.
      obo_consent: {
        ...permissions,
        granted: allowAi,
        granted_at: allowAi ? now : null,
        permission_version: CONSENT_VERSION,
        granted_capabilities: allowAi ? providerCaps : [],
      },
      automation_mode: allowAi ? 'auto' : 'manual',
      agent_access: {
        ...(full.agent_access || {}),
        shared_with_agents: allowAi,
        // External agent work is gated until live provider verification.
        automation_enabled: false,
      },
      status: 'disconnected',
      verification_status: 'unverified',
      last_error: 'Checking live provider access.',
      history: [...(full.history || []), {
        at: now, event: 'oauth_ai_permission_decided',
        detail: allowAi ? 'User explicitly approved AI delegation; live provider check required'
          : 'User declined AI delegation; manual connection verification required',
      }].slice(-30),
    });

    return Response.json({
      ok: true, connection_id: updated.id, platform: updated.platform,
      ai_authorized: allowAi, verification_required: true,
    });
  } catch (error) {
    console.error('completeOAuthConnection failed:', error instanceof Error ? error.name : 'UnknownError');
    return Response.json({ error: 'Could not finish platform permissions safely.' }, { status: 500 });
  }
}
