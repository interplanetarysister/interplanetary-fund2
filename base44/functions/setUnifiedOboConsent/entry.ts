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

    const connections = await base44.entities.PlatformConnection.filter({ created_by_id: user.id });
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
          granted_capabilities: granted
            ? (currentObo.provider_capabilities || currentObo.granted_capabilities || [])
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

    return Response.json({ ok: true, consent: canonical, connections: results });
  } catch (error) {
    console.error('setUnifiedOboConsent error:', error?.message || error);
    return Response.json({ error: 'Unable to update AI authorization.' }, { status: 500 });
  }
}
