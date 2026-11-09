import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { decryptConnectionSecret } from '../../shared/connectionCrypto.ts';
import { appendHealthEvent } from '../../shared/connectionHealthHistory.ts';

// GoFundMe Pro (Classy) account verification for one member.
//
// The endpoints are hard-coded: Classy's token endpoint is documented relative
// to the API host, and a relative token URL does not resolve at request time.
// The member's client credentials live only in their encrypted vault; they are
// read here for this one request and are never logged, echoed or stored on the
// connection record.
const TOKEN_URL = 'https://api.classy.org/oauth2/auth';
const ORG_URL = 'https://api.classy.org/2.0/organizations/me';
const REJECTED = 'GoFundMe Pro rejected these credentials.';

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const guard = await assertActiveAccount(base44);
    if (!guard.ok) return Response.json({ ok: false, reason: guard.error }, { status: guard.status });
    const user = guard.user;
    const sr = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));

    const vaultRef = String(body?.vault_ref || '').trim();
    if (!vaultRef)
      return Response.json({
        ok: false,
        reason: 'GoFundMe Pro client credentials are not saved for your account yet.',
      }, { status: 400 });

    const row = await sr.entities.UserCredentialVault.get(vaultRef).catch(() => null);
    if (!row || row.user_id !== user.id)
      return Response.json({ ok: false, reason: 'GoFundMe Pro connection not found.' }, { status: 404 });
    if (!String(row.ciphertext || '').startsWith('enc:v1:'))
      return Response.json({
        ok: false,
        reason: 'These saved credentials cannot be read by IFund. Save the GoFundMe Pro client credentials again.',
      }, { status: 400 });

    let bundle: Record<string, any> = {};
    try {
      const parsed = JSON.parse(await decryptConnectionSecret(row.ciphertext, sr));
      bundle = parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return Response.json({ ok: false, reason: 'Saved GoFundMe Pro credentials could not be opened.' }, { status: 503 });
    }

    const clientId = String(bundle.gofundme_pro_client_id || bundle.client_id || '').trim();
    const clientSecret = String(bundle.gofundme_pro_client_secret || bundle.client_secret || '').trim();
    if (!clientId || !clientSecret)
      return Response.json({
        ok: false,
        reason: 'GoFundMe Pro client credentials are not saved for your account yet.',
      }, { status: 400 });

    let tokenResponse;
    try {
      tokenResponse = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        // Client credentials travel in the body, never in the URL.
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          scope: 'read write',
          client_id: clientId,
          client_secret: clientSecret,
        }).toString(),
        // This runtime only supports 'follow' | 'manual'.
        redirect: 'manual',
        signal: AbortSignal.timeout(15000),
      });
    } catch (error) {
      console.error('verifyGoFundMeProConnection token transport:', error instanceof Error ? `${error.name}: ${error.message}` : 'UnknownError');
      return Response.json({ ok: false, reason: 'GoFundMe Pro could not be reached from IFund right now. Try again shortly.' }, { status: 502 });
    }

    if (tokenResponse.status === 401 || tokenResponse.status === 403) {
      await recordFailure(sr, user.id, REJECTED);
      return Response.json({ ok: false, reason: REJECTED }, { status: 401 });
    }
    if (!tokenResponse.ok)
      return Response.json({ ok: false, reason: 'GoFundMe Pro did not return an access token.' }, { status: 502 });

    const token = await tokenResponse.json().catch(() => null);
    const accessToken = String(token?.access_token || '').trim();
    if (!accessToken)
      return Response.json({ ok: false, reason: 'GoFundMe Pro did not return an access token.' }, { status: 502 });

    let orgResponse;
    try {
      orgResponse = await fetch(ORG_URL, {
        method: 'GET',
        headers: { Authorization: 'Bearer ' + accessToken, Accept: 'application/json' },
        redirect: 'manual',
        signal: AbortSignal.timeout(15000),
      });
    } catch (error) {
      console.error('verifyGoFundMeProConnection org transport:', error instanceof Error ? `${error.name}: ${error.message}` : 'UnknownError');
      return Response.json({ ok: false, reason: 'GoFundMe Pro could not be reached from IFund right now. Try again shortly.' }, { status: 502 });
    }

    if (orgResponse.status === 401 || orgResponse.status === 403) {
      await recordFailure(sr, user.id, REJECTED);
      return Response.json({ ok: false, reason: REJECTED }, { status: 401 });
    }
    if (!orgResponse.ok)
      return Response.json({ ok: false, reason: 'GoFundMe Pro did not return organization details.' }, { status: 502 });

    const org = await orgResponse.json().catch(() => null);
    const organizationName = String(org?.name || org?.organization_name || '').slice(0, 120);
    const organizationId = org?.id ? String(org.id) : '';

    const now = new Date().toISOString();
    let connection = body?.connection_id
      ? await sr.entities.PlatformConnection.get(body.connection_id).catch(() => null)
      : null;
    if (connection && (connection.created_by_id !== user.id || connection.platform !== 'gofundme')) connection = null;
    if (!connection)
      connection = (await sr.entities.PlatformConnection
        .filter({ created_by_id: user.id, platform: 'gofundme' }, '-updated_date', 1).catch(() => []))[0] || null;
    if (!connection) {
      connection = await sr.entities.PlatformConnection.create({
        created_by_id: user.id,
        platform: 'gofundme',
        kind: 'crowdfunding',
        display_name: organizationName || 'GoFundMe Pro',
        status: 'needs_setup',
        verification_status: 'unverified',
        history: [],
      });
    }

    const updated = await sr.entities.PlatformConnection.update(connection.id, {
      status: 'connected',
      verification_status: 'verified',
      verification_type: 'provider_account',
      capability_status: 'confirmed',
      external_data_source: 'provider_verified',
      last_synced: now,
      last_error: '',
      credentials: {
        ...(connection.credentials || {}),
        vault_ref: vaultRef,
        oauth_variant: 'gofundme_pro',
      },
      history: appendHealthEvent(connection.history, 'health_check', 'GoFundMe Pro organization verified', now),
    });

    return Response.json({
      ok: true,
      provider: 'gofundme_pro',
      organization_name: organizationName,
      organization_id: organizationId,
      connection: { id: updated.id, status: updated.status, verification_status: updated.verification_status },
    });
  } catch (error) {
    console.error('verifyGoFundMeProConnection:', error instanceof Error ? error.name : 'UnknownError');
    return Response.json({ ok: false, reason: 'GoFundMe Pro verification could not be completed.' }, { status: 500 });
  }
}

async function recordFailure(sr: any, userId: string, reason: string) {
  const connection = (await sr.entities.PlatformConnection
    .filter({ created_by_id: userId, platform: 'gofundme' }, '-updated_date', 1).catch(() => []))[0];
  if (!connection) return;
  const now = new Date().toISOString();
  await sr.entities.PlatformConnection.update(connection.id, {
    status: 'needs_setup',
    verification_status: 'unverified',
    verification_type: null,
    capability_status: 'unknown',
    last_error: '',
    history: appendHealthEvent(connection.history, 'health_check_failed', reason, now),
  }).catch(() => {});
}