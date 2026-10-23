import assert from 'node:assert/strict';
import test from 'node:test';
import { makeOwnerProofAdapters } from './owner-proof-adapters.mjs';
import { linkVerifiedOwnerSessions } from './owner-link-gate.mjs';
const sourceId = '6a67a778342a8fe05ee79cbb';
const otherSourceId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const destId = 'bba16ddd-8531-4ed2-84ca-5de48fc8a8c1';
const otherDestId = '11111111-1111-1111-1111-111111111111';
const json = x => new Response(JSON.stringify(x), { headers: { 'content-type': 'application/json' } });
function harness({ source = { id: sourceId, email: 'owner@example.org' }, destination = { id: destId, email: 'owner@example.org', email_confirmed_at: '2026-10-23T00:00:00Z' }, mappings } = {}) {
  const records = mappings || new Map([[sourceId, { source_owner_id: sourceId, source_email: 'owner@example.org', verification_state: 'awaiting_destination_login', destination_auth_uid: null }]]);
  let commits = 0;
  const fetcher = async (url, opts) => {
    if (url.endsWith('/entities/User/me')) return json(source);
    if (url.endsWith('/auth/v1/user')) return json(destination);
    const body = JSON.parse(opts.body);
    if (url.endsWith('/ifund_migration_owner_lookup')) return json(records.has(body.p_source_owner_id) ? [records.get(body.p_source_owner_id)] : []);
    if (url.endsWith('/ifund_migration_owner_commit')) {
      commits++;
      const row = records.get(body.p_source_owner_id);
      if (!row || row.verification_state !== 'awaiting_destination_login' || row.destination_auth_uid !== null ||
          row.source_email.toLowerCase() !== body.p_expected_email.toLowerCase() ||
          destination.email.toLowerCase() !== body.p_expected_email.toLowerCase() ||
          destination.id !== body.p_destination_auth_uid || !destination.email_confirmed_at ||
          [...records.values()].some(x => x.destination_auth_uid === destination.id)) return json([]);
      row.destination_auth_uid = destination.id;
      row.verification_state = 'verified';
      return json([{ linked: true, source_owner_id: row.source_owner_id, destination_auth_uid: row.destination_auth_uid, verification_state: row.verification_state }]);
    }
    throw Error('unexpected endpoint');
  };
  const adapters = makeOwnerProofAdapters({
    sourceBearer: 'source-bearer-123456', destinationBearer: 'destination-bearer-123456',
    supabasePublishableKey: 'publishable-key-123456', supabaseServiceKey: 'service-role-key-123456', fetcher,
  });
  return { adapters, records, commits: () => commits };
}
test('full dual-provider route links once and replay is idempotent without another DB update', async () => {
  const h = harness();
  assert.deepEqual(await linkVerifiedOwnerSessions(h.adapters), { ok: true, linked: true, alreadyLinked: false });
  assert.deepEqual(await linkVerifiedOwnerSessions(h.adapters), { ok: true, linked: true, alreadyLinked: true });
  assert.equal(h.commits(), 1);
});
test('cross-tenant destination cannot link someone else source', async () => {
  const h = harness({ destination: { id: otherDestId, email: 'other@example.org', email_confirmed_at: '2026-10-23T00:00:00Z' } });
  assert.equal((await linkVerifiedOwnerSessions(h.adapters)).reason, 'identity_mismatch');
  assert.equal(h.commits(), 0);
});
test('cross-tenant source cannot claim a mapping owned by another source', async () => {
  const h = harness({ source: { id: otherSourceId, email: 'owner@example.org' } });
  assert.equal((await linkVerifiedOwnerSessions(h.adapters)).reason, 'source_owner_not_found');
  assert.equal(h.commits(), 0);
});
test('conflicting previously linked destination cannot link another owner', async () => {
  const records = new Map([
    [sourceId, { source_owner_id: sourceId, source_email: 'owner@example.org', verification_state: 'awaiting_destination_login', destination_auth_uid: null }],
    [otherSourceId, { source_owner_id: otherSourceId, source_email: 'other@example.org', verification_state: 'verified', destination_auth_uid: destId }],
  ]);
  const h = harness({ mappings: records });
  assert.equal((await linkVerifiedOwnerSessions(h.adapters)).reason, 'link_conflict');
  assert.equal(h.commits(), 1);
  assert.equal(records.get(sourceId).destination_auth_uid, null);
});
