export const EXTERNAL_SYNC_RUN_TTL_MS = 10 * 60 * 1000;
export const EXTERNAL_SYNC_RATE_WINDOW_MS = 60 * 1000;
export const EXTERNAL_SYNC_RATE_LIMIT = 5;

export const validExternalSyncRequestId = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(String(value || '').trim());

export function externalSyncRequestKey(jobType, actorUserId, requestId) {
  return `${String(jobType)}:${String(actorUserId)}:${String(requestId).toLowerCase()}`;
}

export function crowdfundingConnectionEligibility(connection, ownerUserId) {
  if (!connection || connection.kind !== 'crowdfunding') return { ok: false, reason: 'not_crowdfunding' };
  if (!ownerUserId || connection.created_by_id !== ownerUserId) return { ok: false, reason: 'owner_mismatch' };
  if (connection.status !== 'connected') return { ok: false, reason: 'disconnected' };
  if (connection.verification_status !== 'verified') return { ok: false, reason: 'unverified' };
  if (connection.capability_status === 'reauthorization_required') return { ok: false, reason: 'reauthorization_required' };
  // Purpose-specific provider consent is optional on legacy link connections.
  // When present, an explicit refusal/revocation always fails closed. AI/OBO
  // publishing consent is deliberately not treated as fundraising-data consent.
  const consent = connection.fundraising_data_consent;
  if (consent?.granted === false || consent?.revoked_at) return { ok: false, reason: 'consent_revoked' };
  return { ok: true, reason: '' };
}

export function authorizeExternalSyncScope({ actorId, actorRole, scope, campaignOwnerId, oboUserId }) {
  const isAdmin = actorRole === 'admin' || actorRole === 'super_admin';
  if (!['user', 'campaign', 'all'].includes(scope)) return { ok: false, status: 400, reason: 'invalid_scope' };
  if (scope === 'all' && !isAdmin) return { ok: false, status: 403, reason: 'admin_required' };
  if (oboUserId && (!isAdmin || scope !== 'user')) return { ok: false, status: 403, reason: 'obo_not_allowed' };
  if (scope === 'campaign' && campaignOwnerId && !isAdmin && campaignOwnerId !== actorId) return { ok: false, status: 403, reason: 'owner_required' };
  return { ok: true, status: 200, reason: '' };
}

export class ExternalSyncRequestError extends Error {
  constructor(code, message, status = 503) {
    super(message);
    this.name = 'ExternalSyncRequestError';
    this.code = code;
    this.status = status;
  }
}

const time = (value) => new Date(value || 0).getTime();
const isFinal = (status) => status && status !== 'in_progress';

const EXTERNAL_SYNC_MUTEX_KEY = 'mutex:external-sync:v1';
const EXTERNAL_SYNC_MUTEX_LEASE_MS = 2 * 60 * 1000;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function exactClaims(sr, filter, limit = 3) {
  const rows = await sr.entities.ExternalSyncClaim.filter(filter, '-created_date', limit);
  return Array.isArray(rows) ? rows : [];
}

async function acquireExternalSyncMutex(sr, nowMs) {
  // Base44 upsert updates existing rows, so it is not an immutable claim
  // primitive. A single persistent mutex row plus conditional updateMany is
  // the supported compare-and-set boundary. Bootstrap never performs work:
  // the first request creates the empty row and fails closed so a concurrent
  // initializer cannot slip past an incomplete uniqueness check.
  let rows;
  try {
    rows = await exactClaims(sr, { claim_key: EXTERNAL_SYNC_MUTEX_KEY });
    if (rows.length === 0) {
      await sr.entities.ExternalSyncClaim.create({
        claim_key: EXTERNAL_SYNC_MUTEX_KEY,
        claim_type: 'mutex',
        request_key: 'mutex',
        request_id: 'mutex',
        request_fingerprint: 'mutex-v1',
        job_type: 'external_funds',
        actor_user_id: 'system',
        attempt_number: 0,
        claimed_at: new Date(0).toISOString(),
        lock_token: '',
        lock_expires_at: null,
      });
      throw new ExternalSyncRequestError(
        'backend_unavailable',
        'Synchronization safeguards were initialized. Try the request again.',
      );
    }
  } catch (error) {
    if (error instanceof ExternalSyncRequestError) throw error;
    throw new ExternalSyncRequestError('backend_unavailable', 'Synchronization safeguards are unavailable. Try again later.');
  }
  if (rows.length !== 1) {
    throw new ExternalSyncRequestError('backend_unavailable', 'Synchronization safeguards are ambiguous. Try again later.');
  }

  const token = crypto.randomUUID();
  for (let attempt = 0; attempt < 40; attempt++) {
    const currentRows = await exactClaims(sr, { claim_key: EXTERNAL_SYNC_MUTEX_KEY });
    if (currentRows.length !== 1) {
      throw new ExternalSyncRequestError('backend_unavailable', 'Synchronization safeguards are ambiguous. Try again later.');
    }
    const current = currentRows[0];
    const expiresAt = time(current.lock_expires_at);
    const currentToken = String(current.lock_token || '');
    if (!currentToken || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      const result = await sr.entities.ExternalSyncClaim.updateMany(
        { id: current.id, claim_key: EXTERNAL_SYNC_MUTEX_KEY, lock_token: currentToken },
        { $set: {
          lock_token: token,
          lock_expires_at: new Date(Math.max(Date.now(), nowMs) + EXTERNAL_SYNC_MUTEX_LEASE_MS).toISOString(),
        } },
      );
      if (Number(result?.updated || 0) === 1) {
        const verified = await exactClaims(sr, { claim_key: EXTERNAL_SYNC_MUTEX_KEY });
        if (verified.length === 1 && verified[0].lock_token === token) {
          return { id: current.id, token };
        }
        throw new ExternalSyncRequestError('backend_unavailable', 'Synchronization safeguards could not be verified.');
      }
    }
    await wait(15);
  }
  throw new ExternalSyncRequestError('backend_unavailable', 'Another synchronization request is being recorded. Try again.');
}

async function releaseExternalSyncMutex(sr, mutex) {
  if (!mutex) return;
  await sr.entities.ExternalSyncClaim.updateMany(
    { id: mutex.id, claim_key: EXTERNAL_SYNC_MUTEX_KEY, lock_token: mutex.token },
    { $set: { lock_token: '', lock_expires_at: null } },
  ).catch(() => {});
}

async function acquireExternalSyncRateSlot(sr, options, requestKey, nowMs, now) {
  const windowStartMs = Math.floor(nowMs / EXTERNAL_SYNC_RATE_WINDOW_MS) * EXTERNAL_SYNC_RATE_WINDOW_MS;
  const windowStartedAt = new Date(windowStartMs).toISOString();
  const records = await exactClaims(sr, {
    claim_type: 'rate_slot',
    job_type: options.jobType,
    actor_user_id: options.actorUserId,
    rate_window_started_at: windowStartedAt,
  }, EXTERNAL_SYNC_RATE_LIMIT + 2);

  const owned = records.find((row) => row.request_key === requestKey);
  if (owned) {
    if (owned.request_fingerprint !== options.fingerprint) {
      throw new ExternalSyncRequestError('request_conflict', 'request_id was already used for a different target.', 409);
    }
    return;
  }
  if (records.length >= EXTERNAL_SYNC_RATE_LIMIT) {
    throw new ExternalSyncRequestError('rate_limited', 'Too many synchronization requests. Wait a minute and try again.', 429);
  }

  const claimKey = `rate:${String(options.jobType)}:${String(options.actorUserId)}:${windowStartMs}:${requestKey}`;
  await sr.entities.ExternalSyncClaim.create({
    claim_key: claimKey,
    claim_type: 'rate_slot',
    request_key: requestKey,
    request_id: options.requestId,
    request_fingerprint: options.fingerprint,
    job_type: options.jobType,
    actor_user_id: options.actorUserId,
    attempt_number: 0,
    claimed_at: now,
    rate_window_started_at: windowStartedAt,
    rate_slot: records.length,
  });
  const verified = await exactClaims(sr, { claim_key: claimKey });
  if (verified.length !== 1 ||
      verified[0].request_key !== requestKey ||
      verified[0].request_fingerprint !== options.fingerprint) {
    throw new ExternalSyncRequestError('backend_unavailable', 'Synchronization rate claim could not be verified.');
  }
}

export async function beginExternalSyncRequest(sr, options) {
  const nowMs = options.nowMs ?? Date.now();
  const now = new Date(nowMs).toISOString();
  const requestKey = externalSyncRequestKey(options.jobType, options.actorUserId, options.requestId);

  // These reads intentionally have no fail-open fallback. If the idempotency
  // or limiter backend cannot be read, provider I/O must not begin.
  let runs;
  let claims;
  try {
    [runs, claims] = await Promise.all([
      sr.entities.SyncRun.filter({ request_key: requestKey }, '-created_date', 5),
      sr.entities.ExternalSyncClaim.filter({ request_key: requestKey }, '-attempt_number', 10),
    ]);
  } catch {
    throw new ExternalSyncRequestError('backend_unavailable', 'Synchronization safeguards are unavailable. Try again later.');
  }

  const existing = runs?.[0] || null;
  if (existing?.request_fingerprint && existing.request_fingerprint !== options.fingerprint) {
    throw new ExternalSyncRequestError('request_conflict', 'request_id was already used for a different target.', 409);
  }
  if (existing && isFinal(existing.overall_status)) {
    return { disposition: 'completed', run: existing, requestKey };
  }

  const latestClaim = [...(claims || [])].sort((a, b) => Number(b.attempt_number || 0) - Number(a.attempt_number || 0))[0] || null;
  if (latestClaim?.request_fingerprint && latestClaim.request_fingerprint !== options.fingerprint) {
    throw new ExternalSyncRequestError('request_conflict', 'request_id was already used for a different target.', 409);
  }
  const activeStartedAt = existing?.started_at || latestClaim?.claimed_at;
  const activeAge = nowMs - time(activeStartedAt);
  if ((existing?.overall_status === 'in_progress' || (!existing && latestClaim)) &&
      Number.isFinite(activeAge) && activeAge >= 0 && activeAge < EXTERNAL_SYNC_RUN_TTL_MS) {
    return { disposition: 'in_progress', run: existing, requestKey };
  }

  // A deterministic five-slot window turns the limit into an atomic claim.
  // Concurrent distinct request IDs compete for unique slots before any
  // provider I/O; retries for the same request reuse their existing slot.
  await acquireExternalSyncRateSlot(sr, options, requestKey, nowMs, now);

  const attempt = Math.max(Number(existing?.attempt_number || 0), Number(latestClaim?.attempt_number || 0)) + 1;
  const claimKey = `${requestKey}:${attempt}`;
  let claimResult;
  try {
    claimResult = await sr.entities.ExternalSyncClaim.upsert([{
      claim_key: claimKey,
      claim_type: 'request_attempt',
      request_key: requestKey,
      request_id: options.requestId,
      request_fingerprint: options.fingerprint,
      job_type: options.jobType,
      actor_user_id: options.actorUserId,
      attempt_number: attempt,
      claimed_at: now,
    }], { key: ['claim_key'] });
  } catch {
    throw new ExternalSyncRequestError('backend_unavailable', 'Synchronization safeguards are unavailable. Try again later.');
  }

  // Atomic unique upsert is the claim boundary. Only the caller that created
  // this immutable attempt may perform provider I/O.
  if (Number(claimResult?.created || 0) !== 1) {
    return { disposition: 'in_progress', run: existing, requestKey, claimKey };
  }

  const runData = {
    request_key: requestKey,
    request_id: options.requestId,
    request_fingerprint: options.fingerprint,
    job_type: options.jobType,
    initiator_type: options.initiatorType || 'user',
    initiator_id: options.actorUserId,
    initiator_user_id: options.actorUserId,
    scope: options.scope || 'user',
    campaign_id: options.campaignId || null,
    started_at: now,
    completed_at: null,
    overall_status: 'in_progress',
    provider_results: [],
    total_discovered: 0,
    discovered_totals: [],
    total_imported: 0,
    campaigns_covered: 0,
    attempt_number: attempt,
    active_claim_key: claimKey,
    description: attempt > 1 ? 'Retrying a stale authenticated explicit request.' : 'Authenticated explicit request is in progress.',
  };
  try {
    const run = existing
      ? await sr.entities.SyncRun.update(existing.id, runData)
      : await sr.entities.SyncRun.create(runData);
    return { disposition: 'acquired', run, requestKey, claimKey };
  } catch {
    // The immutable claim prevents a second provider call. A retry receives
    // in-progress until the claim expires, then safely acquires a new attempt.
    throw new ExternalSyncRequestError('backend_unavailable', 'Synchronization request could not be recorded. Try again later.');
  }
}

export async function finishExternalSyncRequest(sr, run, claimKey, patch) {
  const current = await sr.entities.SyncRun.get(run.id);
  if (!current || current.active_claim_key !== claimKey || current.overall_status !== 'in_progress') {
    throw new ExternalSyncRequestError('claim_lost', 'Synchronization claim is no longer active.', 409);
  }
  return sr.entities.SyncRun.update(run.id, { ...patch, completed_at: patch.completed_at || new Date().toISOString() });
}

export async function failExternalSyncRequest(sr, run, claimKey, description) {
  try {
    return await finishExternalSyncRequest(sr, run, claimKey, {
      overall_status: 'failed',
      description: description || 'The authenticated explicit request failed before completion.',
    });
  } catch (error) {
    if (error?.code === 'claim_lost') return null;
    throw error;
  }
}