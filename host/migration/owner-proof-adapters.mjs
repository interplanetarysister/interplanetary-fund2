/**
 * Dormant, server-only owner-proof adapters. Do not expose directly to browsers.
 * All endpoints are pinned; no redirects, credentials in URLs, or token logging.
 * Requires separately deployed service-role-only SQL RPCs before use.
 */
export const BASE44_APP_ID = '6a67a778342a8fe05ee79cba';
const BASE44 = 'https://interplanetaryfund.base44.app';
const SUPABASE = 'https://tzehxfikoslihnclhxuz.supabase.co';
const MAX_BYTES = 16_384;
const TIMEOUT_MS = 6_000;
const tokenOK = (v) => typeof v === 'string' && v.length >= 16 && v.length <= 8192 && !/[\s\u0000-\u001f]/.test(v);

async function boundedJSON(fetcher, url, { method = 'GET', headers = {}, body } = {}) {
  const response = await fetcher(url, {
    method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response || response.status !== 200 || response.redirected ||
      response.headers.get('location') ||
      !/^application\/json(?:\s*;|\s*$)/i.test(response.headers.get('content-type') || '')) {
    throw new Error('provider_unavailable');
  }
  const declared = response.headers.get('content-length');
  if (declared !== null && (Number(declared) > MAX_BYTES || !Number.isFinite(Number(declared))))
    throw new Error('provider_unavailable');
  if (!response.body?.getReader) throw new Error('provider_unavailable');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) throw new Error('provider_unavailable');
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  const data = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(data));
}

export function makeOwnerProofAdapters({
  sourceBearer, destinationBearer, supabasePublishableKey, supabaseServiceKey,
  fetcher = globalThis.fetch,
} = {}) {
  // A server-side route must accept BOTH tokens from the same authorized
  // owner interaction and never store them, place them in URLs, or log them.
  // Service role key must come exclusively from server-side secret storage.
  const configured = [sourceBearer, destinationBearer, supabasePublishableKey, supabaseServiceKey]
    .every(tokenOK) && typeof fetcher === 'function';
  const requireConfigured = () => { if (!configured) throw new Error('not_configured'); };
  const serviceHeaders = () => ({
    authorization: `Bearer ${supabaseServiceKey}`, apikey: supabaseServiceKey,
    'content-type': 'application/json', accept: 'application/json',
  });
  const rpc = (name, payload) => boundedJSON(fetcher, `${SUPABASE}/rest/v1/rpc/${name}`, {
    method: 'POST', headers: serviceHeaders(), body: payload,
  });

  return {
    verifySourceSession: async () => {
      requireConfigured();
      const user = await boundedJSON(fetcher, `${BASE44}/api/apps/${BASE44_APP_ID}/entities/User/me`, {
        headers: { authorization: `Bearer ${sourceBearer}`, 'x-app-id': BASE44_APP_ID, accept: 'application/json' },
      });
      const active = user && user.account_deletion_pending !== true &&
        user.disabled !== true && user.is_active !== false &&
        user.suspended !== true && !['suspended', 'disabled', 'deleted', 'banned'].includes(String(user.status || '').toLowerCase());
      return { verified: true, active: Boolean(active), id: user?.id, email: user?.email };
    },
    verifyDestinationSession: async () => {
      requireConfigured();
      const user = await boundedJSON(fetcher, `${SUPABASE}/auth/v1/user`, {
        headers: { authorization: `Bearer ${destinationBearer}`, apikey: supabasePublishableKey, accept: 'application/json' },
      });
      return { verified: true, id: user?.id, email: user?.email, email_confirmed_at: user?.email_confirmed_at };
    },
    loadSourceOwner: async (sourceOwnerId) => {
      requireConfigured();
      if (!/^[0-9a-f]{24}$/i.test(String(sourceOwnerId))) throw new Error('invalid_owner');
      // V2 exposes candidate_match_method; legacy email-only links are not
      // proof of two live provider sessions and cannot be treated as linked.
      const rows = await rpc('ifund_migration_owner_lookup_v2', { p_source_owner_id: sourceOwnerId });
      if (!Array.isArray(rows) || rows.length > 1) throw new Error('invalid_lookup');
      const row = rows[0] || null;
      if (row && (!Object.prototype.hasOwnProperty.call(row, 'candidate_match_method') ||
          (row.candidate_match_method !== null && typeof row.candidate_match_method !== 'string')))
        throw new Error('invalid_lookup_provenance');
      return row;
    },
    // STAGED ONLY: a separate, receipt-creating RPC. The public route still
    // uses the legacy adapter until the entire trusted gate is upgraded.
    // Never silently fall back to the unaudited RPC on any error.
    commitAuditedLink: async ({
      sourceOwnerId, destinationAuthUid, expectedEmail, expectedState,
      consentNonceSha256, consentOrigin, sourceSessionCheckedAt, destinationSessionCheckedAt,
    }) => {
      requireConfigured();
      const recent = (value) => {
        if (typeof value !== 'string') return false;
        const time = Date.parse(value);
        return Number.isFinite(time) && time <= Date.now() && time >= Date.now() - 60_000;
      };
      if (expectedState !== 'awaiting_destination_login' ||
          !/^[0-9a-f]{24}$/i.test(String(sourceOwnerId)) ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(destinationAuthUid)) ||
          typeof expectedEmail !== 'string' || expectedEmail.length > 254 ||
          !/^[0-9a-f]{64}$/.test(String(consentNonceSha256)) ||
          !['https://interplanetaryfund.com', 'https://www.interplanetaryfund.com'].includes(consentOrigin) ||
          !recent(sourceSessionCheckedAt) || !recent(destinationSessionCheckedAt))
        throw new Error('invalid_audited_link');
      const rows = await rpc('ifund_migration_owner_commit_audited', {
        p_source_owner_id: sourceOwnerId,
        p_destination_auth_uid: destinationAuthUid,
        p_expected_email: expectedEmail,
        p_consent_nonce_sha256: consentNonceSha256,
        p_consent_origin: consentOrigin,
        p_source_session_checked_at: sourceSessionCheckedAt,
        p_destination_session_checked_at: destinationSessionCheckedAt,
      });
      if (!Array.isArray(rows) || rows.length > 1) throw new Error('invalid_audited_commit');
      return rows[0] || { linked: false };
    },
    // Separate atomic upgrade for a historical confirmed-email candidate.
    // Never call the legacy unaudited commit or silently change its target UID.
    upgradeHistoricalLink: async ({
      sourceOwnerId, destinationAuthUid, expectedEmail, expectedState,
      expectedCandidateMethod, consentNonceSha256, consentOrigin,
      sourceSessionCheckedAt, destinationSessionCheckedAt,
    }) => {
      requireConfigured();
      const recent = value => {
        const t = typeof value === 'string' ? Date.parse(value) : NaN;
        return Number.isFinite(t) && t <= Date.now() && t > Date.now() - 60_000;
      };
      if (expectedState !== 'verified' ||
          expectedCandidateMethod !== 'confirmed_exact_email' ||
          !/^[a-f0-9]{24}$/i.test(String(sourceOwnerId)) ||
          !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(String(destinationAuthUid)) ||
          typeof expectedEmail !== 'string' || expectedEmail.length > 254 ||
          !/^[^\s@\\]+@[^\s@\\]+\.[^\s@\\]+$/.test(expectedEmail) ||
          !/^[a-f0-9]{64}$/.test(String(consentNonceSha256)) ||
          !['https://interplanetaryfund.com', 'https://www.interplanetaryfund.com'].includes(consentOrigin) ||
          !recent(sourceSessionCheckedAt) || !recent(destinationSessionCheckedAt))
        throw new Error('invalid_historical_upgrade');
      const rows = await rpc('ifund_migration_owner_upgrade_historical', {
        p_source_owner_id: sourceOwnerId,
        p_destination_auth_uid: destinationAuthUid,
        p_expected_email: expectedEmail,
        p_consent_nonce_sha256: consentNonceSha256,
        p_consent_origin: consentOrigin,
        p_source_session_checked_at: sourceSessionCheckedAt,
        p_destination_session_checked_at: destinationSessionCheckedAt,
      });
      if (!Array.isArray(rows) || rows.length > 1) throw new Error('invalid_historical_upgrade_result');
      return rows[0] || { upgraded: false };
    },
    commitVerifiedLink: async ({ sourceOwnerId, destinationAuthUid, expectedEmail, expectedState }) => {
      requireConfigured();
      if (expectedState !== 'awaiting_destination_login' ||
          !/^[0-9a-f]{24}$/i.test(String(sourceOwnerId)) ||
          !/^[0-9a-f-]{36}$/i.test(String(destinationAuthUid)) ||
          typeof expectedEmail !== 'string' || expectedEmail.length > 254) throw new Error('invalid_link');
      const rows = await rpc('ifund_migration_owner_commit', {
        p_source_owner_id: sourceOwnerId,
        p_destination_auth_uid: destinationAuthUid,
        p_expected_email: expectedEmail,
      });
      if (!Array.isArray(rows) || rows.length > 1) throw new Error('invalid_commit');
      return rows[0] || { linked: false };
    },
  };
}
