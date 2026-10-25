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

test('audited owner-link adapter requires signed consent evidence and never calls legacy RPC', async () => {
  const checkedAt = new Date().toISOString();
  let requests = 0;
  const a = make(async (url, opts) => {
    requests++;
    assert.equal(url, 'https://tzehxfikoslihnclhxuz.supabase.co/rest/v1/rpc/ifund_migration_owner_commit_audited');
    const body = JSON.parse(opts.body);
    assert.equal(body.p_source_owner_id, SOURCE);
    assert.equal(body.p_destination_auth_uid, DEST);
    assert.equal(body.p_consent_nonce_sha256, 'a'.repeat(64));
    assert.equal(body.p_consent_origin, 'https://interplanetaryfund.com');
    assert.equal(body.p_source_session_checked_at, checkedAt);
    assert.equal(body.p_destination_session_checked_at, checkedAt);
    assert.equal(opts.headers.authorization, 'Bearer ' + config.supabaseServiceKey);
    return json([{ linked: true, source_owner_id: SOURCE, destination_auth_uid: DEST, verification_state: 'verified' }]);
  });
  const row = await a.commitAuditedLink({
    sourceOwnerId: SOURCE, destinationAuthUid: DEST, expectedEmail: 'owner@example.org',
    expectedState: 'awaiting_destination_login', consentNonceSha256: 'a'.repeat(64),
    consentOrigin: 'https://interplanetaryfund.com',
    sourceSessionCheckedAt: checkedAt, destinationSessionCheckedAt: checkedAt,
  });
  assert.equal(row.linked, true);
  assert.equal(requests, 1);
});
test('audited adapter rejects missing, stale, or untrusted consent without network', async () => {
  let network = 0;
  const a = make(async () => { network++; throw Error('must not call provider'); });
  const valid = {
    sourceOwnerId: SOURCE, destinationAuthUid: DEST, expectedEmail: 'owner@example.org',
    expectedState: 'awaiting_destination_login', consentNonceSha256: 'b'.repeat(64),
    consentOrigin: 'https://interplanetaryfund.com',
    sourceSessionCheckedAt: new Date().toISOString(),
    destinationSessionCheckedAt: new Date().toISOString(),
  };
  for (const invalid of [
    { consentNonceSha256: undefined }, { consentNonceSha256: 'invalid' },
    { consentOrigin: 'https://evil.example' },
    { sourceSessionCheckedAt: new Date(Date.now() - 61_000).toISOString() },
    { destinationSessionCheckedAt: new Date(Date.now() + 60_000).toISOString() },
    { expectedState: 'verified' },
  ]) {
    await assert.rejects(a.commitAuditedLink({ ...valid, ...invalid }), /invalid_audited_link/);
  }
  assert.equal(network, 0);
});
test('audited adapter never downgrades to unaudited commit when provider errors', async () => {
  const checkedAt = new Date().toISOString();
  let calls = 0;
  const a = make(async (url) => {
    calls++;
    assert.match(url, /ifund_migration_owner_commit_audited$/);
    return json({ error: 'unavailable' }, 503);
  });
  await assert.rejects(a.commitAuditedLink({
    sourceOwnerId: SOURCE, destinationAuthUid: DEST, expectedEmail: 'owner@example.org',
    expectedState: 'awaiting_destination_login', consentNonceSha256: 'c'.repeat(64),
    consentOrigin: 'https://interplanetaryfund.com',
    sourceSessionCheckedAt: checkedAt, destinationSessionCheckedAt: checkedAt,
  }), /provider_unavailable/);
  assert.equal(calls, 1);
});

test('historical adapter calls only audited upgrade RPC with fresh consent and exact UID', async () => {
 const now = new Date().toISOString();
 let count = 0;
 const a = make(async (url, opts) => {
  count++;
  assert.equal(url, 'https://tzehxfikoslihnclhxuz.supabase.co/rest/v1/rpc/ifund_migration_owner_upgrade_historical');
  const p = JSON.parse(opts.body);
  assert.equal(p.p_source_owner_id, SOURCE);
  assert.equal(p.p_destination_auth_uid, DEST);
  assert.equal(p.p_consent_nonce_sha256, 'd'.repeat(64));
  assert.equal(opts.headers.authorization, 'Bearer ' + config.supabaseServiceKey);
  return json([{ upgraded: true, source_owner_id: SOURCE,
   destination_auth_uid: DEST, verification_state: 'verified' }]);
 });
 const r = await a.upgradeHistoricalLink({
  sourceOwnerId: SOURCE, destinationAuthUid: DEST,
  expectedEmail: 'owner@example.org', expectedState: 'verified',
  expectedCandidateMethod: 'confirmed_exact_email',
  consentNonceSha256: 'd'.repeat(64), consentOrigin: 'https://interplanetaryfund.com',
  sourceSessionCheckedAt: now, destinationSessionCheckedAt: now,
 });
 assert.equal(r.upgraded, true);
 assert.equal(count, 1);
});
test('historical adapter rejects stale or invalid proof before any RPC', async () => {
 let calls = 0;
 const a = make(async () => { calls++; throw Error('unexpected network'); });
 const valid = {
  sourceOwnerId: SOURCE, destinationAuthUid: DEST, expectedEmail: 'owner@example.org',
  expectedState: 'verified', expectedCandidateMethod: 'confirmed_exact_email',
  consentNonceSha256: 'e'.repeat(64), consentOrigin: 'https://interplanetaryfund.com',
  sourceSessionCheckedAt: new Date().toISOString(),
  destinationSessionCheckedAt: new Date().toISOString(),
 };
 for (const change of [
  { expectedCandidateMethod: null }, { expectedState: 'awaiting_destination_login' },
  { destinationAuthUid: 'wrong' }, { consentOrigin: 'https://evil.example' },
  { consentNonceSha256: 'bad' },
  { sourceSessionCheckedAt: new Date(Date.now() - 61_000).toISOString() },
 ]) {
  await assert.rejects(a.upgradeHistoricalLink({ ...valid, ...change }), /invalid_historical_upgrade/);
 }
 assert.equal(calls, 0);
});
