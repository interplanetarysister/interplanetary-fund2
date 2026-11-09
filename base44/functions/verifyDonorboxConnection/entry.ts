import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { writeVaultSecrets, readVaultSecrets, maskedHint } from '../../shared/userCredentialVault.ts';
import { appendHealthEvent } from '../../shared/connectionHealthHistory.ts';

// Member-authenticated Donorbox verification. Basic auth uses the member's own
// Donorbox login email and API key. Neither value is logged, echoed, or written
// to the connection: both live in the encrypted vault; the connection keeps a
// vault reference and a masked hint for the key.
const REJECTED = 'Donorbox rejected this email and API key. Donorbox requires API access to be enabled under Account, API & Zapier Integration (a paid add-on).';

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
    if (connection && (connection.created_by_id !== user.id || connection.platform !== 'donorbox'))
      connection = null;
    if (!connection)
      connection = (await sr.entities.PlatformConnection
        .filter({ created_by_id: user.id, platform: 'donorbox' }, '-updated_date', 1).catch(() => []))[0] || null;
    if (body?.connection_id && !connection)
      return Response.json({ ok: false, reason: 'Donorbox connection not found.' }, { status: 404 });

    const stored = await readVaultSecrets(sr, user.id, 'donorbox');
    let email = String(body?.email || connection?.credentials?.account_identifier || stored.donorbox_email || '').trim();
    let key = String(body?.api_key || stored.donorbox_api_key || '').trim();
    if (!email || !key)
      return Response.json({ ok: false, reason: 'Add your Donorbox login email and API key first.' }, { status: 400 });

    if (!connection) {
      connection = await sr.entities.PlatformConnection.create({
        created_by_id: user.id,
        platform: 'donorbox',
        kind: 'crowdfunding',
        display_name: 'Donorbox',
        status: 'needs_setup',
        verification_status: 'unverified',
        history: [],
      });
    }

    let vaultRef = '';
    try {
      vaultRef = await writeVaultSecrets(sr, user.id, 'donorbox', { donorbox_email: email, donorbox_api_key: key });
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
          donorbox_api_key: '',
          account_identifier: email.slice(0, 254),
          vault_ref: vaultRef,
          secret_hints: {
            ...((connection.credentials || {}).secret_hints || {}),
            donorbox_api_key: maskedHint(key),
          },
        },
      });
    }

    const response = await fetch('https://donorbox.org/api/v1/campaigns', {
      method: 'GET',
      headers: { Authorization: 'Basic ' + btoa(email + ':' + key), Accept: 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });

    if (response.status === 401) {
      await recordFailure(sr, connection, REJECTED, now);
      return Response.json({ ok: false, reason: REJECTED }, { status: 401 });
    }
    if (response.status === 403) {
      await recordFailure(sr, connection, REJECTED, now);
      return Response.json({ ok: false, reason: REJECTED }, { status: 403 });
    }
    if (!response.ok)
      return Response.json({ ok: false, reason: 'Donorbox did not return campaign data.' }, { status: 502 });

    const payload = await response.json().catch(() => null);
    if (!payload) return Response.json({ ok: false, reason: 'Donorbox returned an unreadable response.' }, { status: 502 });
    const campaigns = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];
    const totalRaised = Math.round(campaigns.reduce((sum, campaign) => {
      const value = Number(campaign?.total_raised ?? campaign?.amount_raised ?? 0);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0) * 100) / 100;
    const donationsCount = campaigns.reduce((sum, campaign) => {
      const value = Number(campaign?.donations_count ?? campaign?.donation_count ?? 0);
      return sum + (Number.isInteger(value) && value >= 0 ? value : 0);
    }, 0);

    const updated = await sr.entities.PlatformConnection.update(connection.id, {
      status: 'connected',
      verification_status: 'verified',
      verification_type: 'provider_account',
      capability_status: 'confirmed',
      last_synced: now,
      last_error: '',
      external_data_source: 'provider_verified',
      history: appendHealthEvent(connection.history, 'health_check', 'Donorbox API key verified', now),
    });

    return Response.json({
      ok: true,
      provider: 'donorbox',
      campaign_count: campaigns.length,
      total_raised: totalRaised,
      donations_count: donationsCount,
      connection: { id: updated.id, status: updated.status, verification_status: updated.verification_status },
    });
  } catch (error) {
    console.error('verifyDonorboxConnection:', error instanceof Error ? error.name : 'UnknownError');
    return Response.json({ ok: false, reason: 'Donorbox verification could not be completed.' }, { status: 500 });
  }
}

async function recordFailure(sr, connection, reason, now) {
  await sr.entities.PlatformConnection.update(connection.id, {
    status: 'needs_setup',
    verification_status: 'unverified',
    verification_type: null,
    capability_status: 'unknown',
    last_error: '',
    history: appendHealthEvent(connection.history, 'health_check_failed', reason, now),
  }).catch(() => {});
}