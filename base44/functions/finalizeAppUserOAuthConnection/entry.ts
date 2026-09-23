import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const CONFIG: Record<string, { env: string; kind: string; capabilities: string[] }> = {
  linkedin: { env: 'APP_USER_CONNECTOR_LINKEDIN_ID', kind: 'social', capabilities: ['read','write','post','comment','message','follow','join'] },
  facebook: { env: 'APP_USER_CONNECTOR_FACEBOOK_PAGES_ID', kind: 'social', capabilities: ['read','write','post','comment','message','follow','join'] },
  instagram: { env: 'APP_USER_CONNECTOR_INSTAGRAM_ID', kind: 'social', capabilities: ['read','write','post','comment','message','follow'] },
  discord: { env: 'APP_USER_CONNECTOR_DISCORD_ID', kind: 'social', capabilities: ['read','write','post','comment','message','join'] },
  tiktok: { env: 'APP_USER_CONNECTOR_TIKTOK_ID', kind: 'social', capabilities: ['read','write','post','comment','message','follow'] },
};

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { platform } = await req.json().catch(() => ({}));
    const key = String(platform || '').toLowerCase();
    const cfg = CONFIG[key];
    const connectorId = cfg ? (Deno.env.get(cfg.env) || '') : '';
    if (!cfg || !connectorId) return Response.json({ configured: false, connected: false });

    try {
      const oauth = await base44.asServiceRole.connectors.getCurrentAppUserConnection(connectorId);
      if (!oauth?.accessToken) return Response.json({ configured: true, connected: false });
    } catch {
      return Response.json({ configured: true, connected: false });
    }

    const existing = (await base44.entities.PlatformConnection.filter({ created_by_id: user.id, platform: key }))[0] || null;
    const now = new Date().toISOString();
    const data = {
      platform: key,
      kind: cfg.kind,
      display_name: existing?.display_name || key,
      external_url: existing?.external_url || '',
      automation_mode: existing?.automation_mode || 'manual',
      obo_consent: {
        granted: true,
        granted_at: now,
        permission_version: '2026-09-shared-agent-v1',
        requested_capabilities: cfg.capabilities,
        granted_capabilities: cfg.capabilities,
        provider_capabilities: cfg.capabilities,
      },
      agent_access: {
        shared_with_agents: true,
        automation_enabled: existing?.agent_access?.automation_enabled || existing?.automation_mode === 'auto',
      },
      status: 'connected',
      verification_status: 'verified',
      external_data_source: 'provider_verified',
      last_synced: now,
      last_error: '',
      history: [...(existing?.history || []), { at: now, event: 'oauth_connected', detail: 'Provider OAuth connection verified; applicable OBO capabilities shared with the user’s agent team' }].slice(-30),
    };
    const saved = existing
      ? await base44.entities.PlatformConnection.update(existing.id, data)
      : await base44.entities.PlatformConnection.create(data);
    return Response.json({ configured: true, connected: true, connection: saved });
  } catch (error) {
    console.error('finalizeAppUserOAuthConnection error:', error?.message || error);
    return Response.json({ error: 'Unable to finish this connection.' }, { status: 500 });
  }
}
