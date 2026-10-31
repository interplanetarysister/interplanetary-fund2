import assert from 'node:assert/strict';
import test from 'node:test';
import { makeOwnerProofAdapters } from './owner-proof-adapters.mjs';
import { makeAuditedOwnerGateAdapters } from './owner-consent-route.mjs';
import { linkVerifiedOwnerSessions } from './owner-link-gate.mjs';

const sourceId = '6a67a778342a8fe05ee79cbb';
const otherSourceId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const destId = 'bba16ddd-8531-4ed2-84ca-5de48fc8a8c1';
const otherDestId = '11111111-1111-1111-1111-111111111111';
const json = x => new Response(JSON.stringify(x), { headers: { 'content-type': 'application/json' } });

function harness({
  source = { id: sourceId, email: 'owner@example.org' },
  destination = { id: destId, email: 'owner@example.org', email_confirmed_at: '2026-10-23T00:00:00Z' },
  mappings,
} = {}) {
  const records = mappings || new Map([[sourceId, {
    source_owner_id: sourceId, source_email: 'owner@example.org',
    verification_state: 'awaiting_destination_login', destination_auth_uid: null,
    candidate_match_method: null,
  }]]);
  let commits = 0;
  const receipts = [];
  const usedNonces = new Set();
  const fetcher = async (url, opts) => {
    if (url.endsWith('/entities/User/me')) return json(source);
    if (url.endsWith('/auth/v1/user')) return json(destination);
    const body = JSON.parse(opts.body);
    if (url.endsWith('/ifund_migration_owner_lookup_v2')) {
      return json(records.has(body.p_source_owner_id) ? [records.get(body.p_source_owner_id)] : []);
    }
    if (url.endsWith('/ifund_migration_owner_commit_audited')) {
      commits++;
      const row = records.get(body.p_source_owner_id);
      const uniqueDestination = [...records.values()].some(x =>
        x.destination_auth_uid === body.p_destination_auth_uid && x.source_owner_id !== body.p_source_owner_id);
      if (!row || row.verification_state !== 'awaiting_destination_login' ||
          row.destination_auth_uid !== null || row.candidate_match_method !== null ||
          uniqueDestination || row.source_email.toLowerCase() !== body.p_expected_email.toLowerCase() ||
          destination.email.toLowerCase() !== body.p_expected_email.toLowerCase() ||
          destination.id !== body.p_destination_auth_uid || !destination.email_confirmed_at ||
          !/^[a-f0-9]{64}$/.test(body.p_consent_nonce_sha256) ||
          usedNonces.has(body.p_consent_nonce_sha256) ||
          !['https://interplanetaryfund.com', 'https://www.interplanetaryfund.com'].includes(body.p_consent_origin) ||
          !body.p_source_session_checked_at || !body.p_destination_session_checked_at) return json([]);
      usedNonces.add(body.p_consent_nonce_sha256);
      row.destination_auth_uid = destination.id;
      row.verification_state = 'verified';
      receipts.push({
        source_owner_id: row.source_owner_id,
        destination_auth_uid: destination.id,
        nonce: body.p_consent_nonce_sha256,
        transition: 'new_link',
      });
      return json([{
        linked: true, source_owner_id: row.source_owner_id,
        destination_auth_uid: row.destination_auth_uid, verification_state: 'verified',
      }]);
    }
    if (url.endsWith('/ifund_migration_owner_commit')) throw Error('legacy commit endpoint must never be used');
    throw Error('unexpected endpoint');
  };
  const adapters = makeOwnerProofAdapters({
    sourceBearer: 'source-bearer-123456',
    destinationBearer: 'destination-bearer-123456',
    supabasePublishableKey: 'publishable-key-123456',
    supabaseServiceKey: 'service-role-key-123456',
    fetcher,
  });
  const gateAdapters = makeAuditedOwnerGateAdapters(adapters, {
    consentNonceSha256: 'a'.repeat(64),
    consentOrigin: 'https://interplanetaryfund.com',
  });
  return { gateAdapters, records, commits: () => commits, receipts };
}

test('dual-provider owner link uses the audited atomic RPC and records consent evidence', async () => {
  const h = harness();
  assert.deepEqual(await linkVerifiedOwnerSessions(h.gateAdapters), {
    ok: true, linked: true, alreadyLinked: false,
  });
  assert.equal(h.commits(), 1);
  assert.equal(h.receipts.length, 1);
  assert.equal(h.receipts[0].nonce, 'a'.repeat(64));
  assert.equal(h.receipts[0].transition, 'new_link');
  assert.equal(h.records.get(sourceId).verification_state, 'verified');
});

test('cross-tenant destination cannot link someone else source', async () => {
  const h = harness({
    destination: { id: otherDestId, email: 'other@example.org', email_confirmed_at: '2026-10-23T00:00:00Z' },
  });
  assert.equal((await linkVerifiedOwnerSessions(h.gateAdapters)).reason, 'identity_mismatch');
  assert.equal(h.commits(), 0);
});

test('cross-tenant source cannot claim a mapping owned by another source', async () => {
  const h = harness({ source: { id: otherSourceId, email: 'owner@example.org' } });
  assert.equal((await linkVerifiedOwnerSessions(h.gateAdapters)).reason, 'source_owner_not_found');
  assert.equal(h.commits(), 0);
});

test('conflicting previously linked destination cannot link another owner', async () => {
  const records = new Map([
    [sourceId, {
      source_owner_id: sourceId, source_email: 'owner@example.org',
      verification_state: 'awaiting_destination_login', destination_auth_uid: null,
      candidate_match_method: null,
    }],
    [otherSourceId, {
      source_owner_id: otherSourceId, source_email: 'other@example.org',
      verification_state: 'verified', destination_auth_uid: destId,
      candidate_match_method: null,
    }],
  ]);
  const h = harness({ mappings: records });
  assert.equal((await linkVerifiedOwnerSessions(h.gateAdapters)).reason, 'link_conflict');
  assert.equal(h.commits(), 1);
  assert.equal(records.get(sourceId).destination_auth_uid, null);
});

test('historical email-only owner candidates require the separate audited upgrade', async () => {
  const records = new Map([[sourceId, {
    source_owner_id: sourceId, source_email: 'owner@example.org',
    verification_state: 'verified', destination_auth_uid: destId,
    candidate_match_method: 'confirmed_exact_email',
  }]]);
  const h = harness({ mappings: records });
  assert.equal((await linkVerifiedOwnerSessions(h.gateAdapters)).reason, 'owner_proof_upgrade_required');
  assert.equal(h.commits(), 0);
});

test('consent nonce cannot be replayed after a mapping rollback', async () => {
  const h = harness();
  await linkVerifiedOwnerSessions(h.gateAdapters);
  const row = h.records.get(sourceId);
  // Simulate an operator rollback of the mapping while retaining the immutable audit receipt.
  row.destination_auth_uid = null;
  row.verification_state = 'awaiting_destination_login';
  const replay = await h.gateAdapters.commitVerifiedLink({
    sourceOwnerId: sourceId,
    destinationAuthUid: destId,
    expectedEmail: 'owner@example.org',
    expectedState: 'awaiting_destination_login',
  });
  assert.deepEqual(replay, { linked: false });
  assert.equal(h.commits(), 2);
  assert.equal(h.receipts.length, 1);
});
