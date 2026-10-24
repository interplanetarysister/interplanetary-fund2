import assert from 'node:assert/strict';
import test from 'node:test';
import { makeOwnerProofAdapters } from './owner-proof-adapters.mjs';
const SOURCE = '6a67a778342a8fe05ee79cbb';
const DEST = 'bba16ddd-8531-4ed2-84ca-5de48fc8a8c1';
const config = { sourceBearer: 'base44-test-token-123456', destinationBearer: 'supabase-test-token-123456', supabasePublishableKey: 'publishable-test-key-123456', supabaseServiceKey: 'service-test-key-123456' };
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
const make = (handler) => makeOwnerProofAdapters({ ...config, fetcher: handler });
test('source verifier calls pinned Base44 /entities/User/me with bearer and no redirects', async () => {
  const a = make(async (url, opts) => {
    assert.equal(url, 'https://interplanetaryfund.base44.app/api/apps/6a67a778342a8fe05ee79cba/entities/User/me');
    assert.equal(opts.redirect, 'manual');
    assert.equal(opts.headers.authorization, 'Bearer ' + config.sourceBearer);
    assert.equal(opts.headers['x-app-id'], '6a67a778342a8fe05ee79cba');
    return json({ id: SOURCE, email: 'owner@example.org' });
  });
  assert.deepEqual(await a.verifySourceSession(), { verified: true, active: true, id: SOURCE, email: 'owner@example.org' });
});
test('source deleted account is inactive', async () => {
  const a = make(async () => json({ id: SOURCE, email: 'owner@example.org', account_deletion_pending: true }));
  assert.equal((await a.verifySourceSession()).active, false);
});
test('destination verifier calls pinned Supabase auth endpoint, not decoded JWT', async () => {
  const a = make(async (url, opts) => {
    assert.equal(url, 'https://tzehxfikoslihnclhxuz.supabase.co/auth/v1/user');
    assert.equal(opts.headers.apikey, config.supabasePublishableKey);
    assert.equal(opts.headers.authorization, 'Bearer ' + config.destinationBearer);
    return json({ id: DEST, email: 'owner@example.org', email_confirmed_at: '2026-10-23T00:00:00Z' });
  });
  assert.equal((await a.verifyDestinationSession()).id, DEST);
});
test('source mapping lookup uses service-only RPC with scoped owner ID', async () => {
  const a = make(async (url, opts) => {
    assert.equal(url, 'https://tzehxfikoslihnclhxuz.supabase.co/rest/v1/rpc/ifund_migration_owner_lookup_v2');
    assert.equal(opts.headers.authorization, 'Bearer ' + config.supabaseServiceKey);
    assert.equal(JSON.parse(opts.body).p_source_owner_id, SOURCE);
    return json([{ source_owner_id: SOURCE, source_email: 'owner@example.org', verification_state: 'awaiting_destination_login', destination_auth_uid: null, candidate_match_method: null }]);
  });
  assert.equal((await a.loadSourceOwner(SOURCE)).source_owner_id, SOURCE);
});
test('legacy lookup response without candidate provenance is rejected', async () => {
  const a = make(async () => json([{ source_owner_id: SOURCE, source_email: 'owner@example.org', verification_state: 'verified', destination_auth_uid: DEST }]));
  await assert.rejects(a.loadSourceOwner(SOURCE), /invalid_lookup_provenance/);
});
test('commit only calls atomic service RPC with expected state', async () => {
  const a = make(async (url, opts) => {
    assert.equal(url, 'https://tzehxfikoslihnclhxuz.supabase.co/rest/v1/rpc/ifund_migration_owner_commit');
    assert.equal(JSON.parse(opts.body).p_expected_email, 'owner@example.org');
    assert.equal(opts.headers.apikey, config.supabaseServiceKey);
    return json([{ linked: true, source_owner_id: SOURCE, destination_auth_uid: DEST, verification_state: 'verified' }]);
  });
  const row = await a.commitVerifiedLink({ sourceOwnerId: SOURCE, destinationAuthUid: DEST, expectedEmail: 'owner@example.org', expectedState: 'awaiting_destination_login' });
  assert.equal(row.linked, true);
});
test('unconfigured adapters fail before network request', async () => {
  const a = makeOwnerProofAdapters({ fetcher: () => { throw Error('network called'); } });
  await assert.rejects(a.verifySourceSession(), /not_configured/);
});
test('invalid owner ID fails before network request', async () => {
  const a = make(() => { throw Error('network called'); });
  await assert.rejects(a.loadSourceOwner('not-an-owner'), /invalid_owner/);
});
test('wrong expected state fails before network request', async () => {
  const a = make(() => { throw Error('network called'); });
  await assert.rejects(a.commitVerifiedLink({ sourceOwnerId: SOURCE, destinationAuthUid: DEST, expectedEmail: 'owner@example.org', expectedState: 'verified' }), /invalid_link/);
});
test('redirect is rejected without following it', async () => {
  const a = make(async () => new Response(null, { status: 302, headers: { location: 'https://evil.example' } }));
  await assert.rejects(a.verifySourceSession(), /provider_unavailable/);
});
test('non-JSON responses rejected', async () => {
  const a = make(async () => new Response('ok', { headers: { 'content-type': 'text/plain' } }));
  await assert.rejects(a.verifyDestinationSession(), /provider_unavailable/);
});
test('oversized responses rejected even without content-length', async () => {
  const a = make(async () => json({ payload: 'x'.repeat(17000) }));
  await assert.rejects(a.verifySourceSession(), /provider_unavailable/);
});
test('provider error response rejected', async () => {
  const a = make(async () => json({ message: 'invalid token' }, 401));
  await assert.rejects(a.verifyDestinationSession(), /provider_unavailable/);
});
test('network and provider error never echo secrets', async () => {
  const a = make(async () => { throw Error('secret ' + config.supabaseServiceKey); });
  await assert.rejects(a.loadSourceOwner(SOURCE));
});
