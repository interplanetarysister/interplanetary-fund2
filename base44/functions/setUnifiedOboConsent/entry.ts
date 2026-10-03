import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const VERSION = '2026-10-unified-obo-v1';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { granted } = await req.json().catch(() => ({}));
    if (typeof granted !== 'boolean') {
      return Response.json({ error: 'granted must be boolean' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const canonical = { granted, decided_at: now, permission_version: VERSION };

    // Keep legacy user fields synchronized while all callers migrate to the
    // canonical IFund-wide authorization.
    await base44.auth.updateMe({
      ai_obo_consent: canonical,
      ai_publishing_consent: { granted, decided_at: now },
      ai_connection_consent: { granted, decided_at: now },
    });

    let connections;
    try {
      connections = await base44.entities.PlatformConnection.filter({ created_by_id: user.id });
    } catch (error) {
      // The canonical user decision is already durable. Report that truth and
      // a retryable partial propagation state instead of claiming it failed.
      console.warn('setUnifiedOboConsent connection propagation read failed:', error?.name || 'UnknownError');
      return Response.json({
        ok: false,
        partial: true,
        consent: canonical,
        connections: [],
        failed_connection_count: null,
        connection_sync_error: true,
      }, { status: 207 });
    }
    const results = [];
    for (const connection of connections || []) {
      const currentObo = connection.obo_consent || {};
      const currentAgent = connection.agent_access || {};
      const patch = {
        obo_consent: {
          ...currentObo,
          granted,
          granted_at: granted ? now : null,
          permission_version: VERSION,
          // Revocation removes IFund's action authorization but does not invent
          // or erase provider-reported capabilities.
          // Owner-wide AI authorization may activate only capabilities the
          // provider actually reported for this connection. Never revive a
          // stale locally requested/granted list as provider evidence.
          granted_capabilities: granted
            ? (Array.isArray(currentObo.provider_capabilities)
              ? currentObo.provider_capabilities
              : [])
            : [],
        },
        agent_access: {
          ...currentAgent,
          shared_with_agents: granted,
          // OBO authorization and automation preference are independent. A
          // grant restores agent access but does not silently convert a user's
          // Ask/Draft/Manual preference into autonomous execution.
          automation_enabled: granted && (connection.automation_mode || 'manual') === 'auto',
        },
        automation_mode: connection.automation_mode || 'manual',
      };
      try {
        await base44.entities.PlatformConnection.update(connection.id, patch);
        results.push({ id: connection.id, updated: true });
      } catch {
        results.push({ id: connection.id, updated: false });
      }
    }

    const failed = results.filter((result) => result.updated !== true);
    const delegationResults = [];
    let delegationSyncError = false;
    try {
      const delegations = await base44.entities.AgentDelegation.filter({ owner_user_id: user.id });
      const activeStatuses = new Set(['assigned', 'in_progress', 'waiting_user', 'waiting_external', 'needs_review']);
      for (const delegation of delegations || []) {
        if (!activeStatuses.has(delegation.status)) continue;
        const patch: any = { consent_version: granted ? VERSION : null };
        if (!granted && ['assigned', 'in_progress'].includes(delegation.status)) {
          patch.status = 'waiting_user';
          patch.continuation_state = {
            ...(delegation.continuation_state || {}),
            pending_step: delegation.continuation_state?.pending_step || 'resume_after_reauthorization',
            external_requirement: 'OBO consent was revoked. Re-authorize AI to resume.',
          };
        }
        try {
          await base44.entities.AgentDelegation.update(delegation.id, patch);
          delegationResults.push({ id: delegation.id, updated: true });
        } catch {
          delegationResults.push({ id: delegation.id, updated: false });
        }
      }
    } catch (error) {
      delegationSyncError = true;
      console.warn('setUnifiedOboConsent delegation propagation read failed:', error?.name || 'UnknownError');
    }

    const failedDelegations = delegationResults.filter((result) => result.updated !== true);
    const partial = failed.length > 0 || failedDelegations.length > 0 || delegationSyncError;
    return Response.json({
      ok: !partial,
      partial,
      consent: canonical,
      connections: results,
      failed_connection_count: failed.length,
      delegations: delegationResults,
      failed_delegation_count: delegationSyncError ? null : failedDelegations.length,
      delegation_sync_error: delegationSyncError,
    }, { status: partial ? 207 : 200 });
  } catch (error) {
    console.error('setUnifiedOboConsent error:', error?.message || error);
    return Response.json({ error: 'Unable to update AI authorization.' }, { status: 500 });
  }
}
