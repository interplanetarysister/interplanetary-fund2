import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { writeVaultSecrets, readVaultSecrets, maskedHint } from '../../shared/userCredentialVault.ts';
import { appendHealthEvent } from '../../shared/connectionHealthHistory.ts';

// Member-authenticated Givebutter verification. The member's own API key is
// sent to Givebutter only. It is never logged, echoed, or written to the
// connection record: it lives in the encrypted credential vault, and the
// connection keeps a vault reference plus a masked hint.
const REJECTED = 'Givebutter rejected this API key.';
const FORBIDDEN = 'This Givebutter key does not have permission for campaigns.';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const guard = await assertActiveAccount(base44);
    if (!guard.ok) return Response.json({ ok: false, reason: guard.error }, { status: guard.status });
    const user = guard.user;
    const sr = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));

    let connection = body?.connection_id
      ? await sr.entities.PlatformConnection.get(body.connection_id).catch(() => null)
      : null;
    if (connection && (connection.created_by_id !== user.id || connection.platform !== 'givebutter'))
      connection = null;
    if (!connection)
      connection = (await sr.entities.PlatformConnection
        .filter({ created_by_id: user.id, platform: 'givebutter' }, '-updated_date', 1).catch(() => []))[0] || null;
    if (body?.connection_id && !connection)
      return Response.json({ ok: false, reason: 'Givebutter connection not found.' }, { status: 404 });

    // Prefer the key the member just pasted; otherwise reuse the vaulted one.
    let key = String(body?.api_key || '').trim();
    if (!key) {
      const stored = await readVaultSecrets(sr, user.id, 'givebutter');
      key = String(stored.givebutter_api_key || '').trim();
    }
    if (!key) return Response.json({ ok: false, reason: 'Add your Givebutter API key first.' }, { status: 400 });

    if (!connection) {
      connection = await sr.entities.PlatformConnection.create({
        created_by_id: user.id,
        platform: 'givebutter',
        kind: 'crowdfunding',
        display_name: 'Givebutter',
        status: 'needs_setup',
        verification_status: 'unverified',
        history: [],
      });
    }

    // Vault first: if secure storage is unavailable the key is discarded, never
    // persisted on the connection.
    let vaultRef = '';
    try {
      vaultRef = await writeVaultSecrets(sr, user.id, 'givebutter', { givebutter_api_key: key });
    } catch {
      return Response.json({
        ok: false,
        reason: 'Secure credential storage is not configured yet, so the key was not saved.',
      }, { status: 503 });
    }
    const now = new Date().toISOString();
    if (vaultRef) {
      await sr.entities.PlatformConnection.update(connection.id, {
        credentials: {
          ...(connection.credentials || {}),
          givebutter_api_key: '',
          vault_ref: vaultRef,
          secret_hints: {
            ...((connection.credentials || {}).secret_hints || {}),
            givebutter_api_key: maskedHint(key),
          },
        },
      });
    }

    const response = await fetch('https://api.givebutter.com/v1/campaigns', {
      method: 'GET',
      headers: { Authorization: 'Bearer ' + key, Accept: 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });

    if (response.status === 401) {
      await recordFailure(sr, connection, REJECTED, now);
      return Response.json({ ok: false, reason: REJECTED }, { status: 401 });
    }
    if (response.status === 403) {
      await recordFailure(sr, connection, FORBIDDEN, now);
      return Response.json({ ok: false, reason: FORBIDDEN }, { status: 403 });
    }
    if (!response.ok)
      return Response.json({ ok: false, reason: 'Givebutter did not return campaign data.' }, { status: 502 });

    const payload = await response.json().catch(() => null);
    if (!payload) return Response.json({ ok: false, reason: 'Givebutter returned an unreadable response.' }, { status: 502 });
    const campaigns = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];
    const totalRaised = Math.round(campaigns.reduce((sum, campaign) => {
      const value = Number(campaign?.total_raised ?? campaign?.amount_raised ?? campaign?.raised ?? 0);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0) * 100) / 100;
    const accountName = String(
      payload?.account_name || payload?.organization_name || payload?.organization?.name ||
      campaigns.find((campaign) => campaign?.account_name)?.account_name || ''
    ).slice(0, 120);

    const updated = await sr.entities.PlatformConnection.update(connection.id, {
      status: 'connected',
      verification_status: 'verified',
      capability_status: 'confirmed',
      last_synced: now,
      last_error: '',
      external_data_source: 'provider_verified',
      history: appendHealthEvent(connection.history, 'health_check', 'Givebutter API key verified', now),
    });

    return Response.json({
      ok: true,
      provider: 'givebutter',
      campaign_count: campaigns.length,
      total_raised: totalRaised,
      account_name: accountName,
      connection: { id: updated.id, status: updated.status, verification_status: updated.verification_status },
    });
  } catch (error) {
    console.error('verifyGivebutterConnection:', error instanceof Error ? error.name : 'UnknownError');
    return Response.json({ ok: false, reason: 'Givebutter verification could not be completed.' }, { status: 500 });
  }
}

async function recordFailure(sr, connection, reason, now) {
  await sr.entities.PlatformConnection.update(connection.id, {
    status: 'needs_setup',
    verification_status: 'unverified',
    capability_status: 'unknown',
    last_error: '',
    history: appendHealthEvent(connection.history, 'health_check_failed', reason, now),
  }).catch(() => {});
}