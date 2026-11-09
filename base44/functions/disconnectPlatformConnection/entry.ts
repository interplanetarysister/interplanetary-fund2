import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { OAUTH_ENV } from '../../shared/connectionVerification.ts';


export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const activeAccount = await assertActiveAccount(base44);
    if (!activeAccount.ok) return Response.json({ error: activeAccount.error }, { status: activeAccount.status });
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { connection_id, platform } = await req.json().catch(() => ({}));
    const key = String(platform || '').toLowerCase();
    const sr = base44.asServiceRole;
    // Resolve an exact record when an id is supplied so a duplicate can be
    // removed by itself. Ownership is proven before any elevated write.
    const connection = connection_id
      ? await sr.entities.PlatformConnection.get(connection_id).catch(() => null)
      : (await sr.entities.PlatformConnection.filter({ created_by_id: user.id, platform: key }, '-updated_date', 1))[0] || null;
    if (!connection || connection.created_by_id !== user.id) {
      return Response.json({ error: 'Connection not found.' }, { status: 404 });
    }

    // Remove agent/OBO authority first. Every side-effect path re-checks these
    // fields, so revocation takes effect before provider disconnect is attempted.
    await sr.entities.PlatformConnection.update(connection.id, {
      status: 'disconnected',
      verification_status: 'unverified',
      capability_status: 'unknown',
      automation_mode: 'manual',
      obo_consent: {
        ...(connection.obo_consent || {}),
        granted: false,
        granted_capabilities: [],
        provider_capabilities: [],
      },
      agent_access: {
        ...(connection.agent_access || {}),
        shared_with_agents: false,
        automation_enabled: false,
      },
      last_error: '',
    });

    const envName = OAUTH_ENV[key || connection.platform];
    const connectorId = envName ? (Deno.env.get(envName) || '') : '';
    let providerDisconnected = false;
    if (connectorId) {
      // SDK versions/providers differ. Use a supported disconnect method when
      // exposed; local authority remains revoked even when provider-side
      // revocation must be completed by the provider.
      const connectors: any = base44.asServiceRole.connectors;
      try {
        if (typeof connectors?.disconnectAppUser === 'function') {
          await connectors.disconnectAppUser(connectorId);
          providerDisconnected = true;
        } else if (typeof connectors?.disconnectCurrentAppUserConnection === 'function') {
          await connectors.disconnectCurrentAppUserConnection(connectorId);
          providerDisconnected = true;
        }
      } catch (error) {
        console.error('Provider disconnect failed after local revocation:', error?.message || error);
      }
    }

    // Service-role delete after the ownership check above. A user-token delete
    // can be refused by record rules, which silently left duplicate gofundme,
    // mastodon, custom and threads rows undeletable.
    await sr.entities.PlatformConnection.delete(connection.id);

    // If that was the member's last connection for this platform, revoke the
    // vaulted provider credentials too instead of leaving them behind.
    const remaining = await sr.entities.PlatformConnection
      .filter({ created_by_id: user.id, platform: connection.platform }).catch(() => []);
    if (Array.isArray(remaining) && remaining.length === 0) {
      const vaultRows = await sr.entities.UserCredentialVault
        .filter({ user_id: user.id, platform: connection.platform }).catch(() => []);
      for (const row of Array.isArray(vaultRows) ? vaultRows : []) {
        await sr.entities.UserCredentialVault.delete(row.id).catch(() => {});
      }
    }
    return Response.json({
      disconnected: true,
      provider_disconnected: providerDisconnected,
      removed_connection_id: connection.id,
      remaining_for_platform: Array.isArray(remaining) ? remaining.length : 0,
    });
  } catch (error) {
    console.error('disconnectPlatformConnection error:', error?.message || error);
    return Response.json({ error: 'Unable to disconnect this platform.' }, { status: 500 });
  }
}