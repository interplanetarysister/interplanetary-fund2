import assert from 'node:assert/strict';
import test from 'node:test';
import { handleOwnerConsent } from './owner-consent-route.mjs';
const URL = 'https://interplanetaryfund.com/api/v1/migration/owner-link';
const ORIGIN = 'https://interplanetaryfund.com';
const secret = 'csrf-secret-for-tests-only-not-production-0123456789';
const base = {
 IFUND_OWNER_LINK_CSRF_SECRET: secret,
 IFUND_OWNER_LINK_LIMITER: { limit: async () => ({ success: true }) },
 IFUND_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_long_key_123',
 IFUND_SUPABASE_SERVICE_ROLE_KEY: 'service-role-test-long-key-12345',
};
const ip = { 'cf-connecting-ip': '203.0.113.42' };
const SOURCE = '6a67a778342a8fe05ee79cbb';
const DEST = 'bba16ddd-8531-4ed2-84ca-5de48fc8a8c1';
const mockFetch = async (url, opts) => {
 assert.equal(opts.redirect, 'manual');
 assert.doesNotMatch(url, /token|secret|bearer/i);
 const json = body => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
 if (url.endsWith('/entities/User/me')) return json({ id: SOURCE, email: 'owner@example.org' });
 if (url.endsWith('/auth/v1/user')) return json({ id: DEST, email: 'owner@example.org', email_confirmed_at: '2026-10-23T00:00:00Z' });
 if (url.endsWith('/rpc/ifund_migration_owner_lookup')) return json([{ source_owner_id: SOURCE, source_email: 'owner@example.org', verification_state: 'awaiting_destination_login', destination_auth_uid: null }]);
 if (url.endsWith('/rpc/ifund_migration_owner_commit')) return json([{ linked: true, source_owner_id: SOURCE, destination_auth_uid: DEST, verification_state: 'verified' }]);
 throw Error('unexpected upstream');
};
const req = (method, headers = {}, body, url = URL) => new Request(url, {
 method, headers: { origin: ORIGIN, ...ip, ...headers }, ...(body === undefined ? {} : { body }),
});
const challenge = async (env = base) => {
 const response = await handleOwnerConsent(req('GET'), env);
 assert.equal(response.status, 200);
 const data = await response.json();
 return { csrf: data.csrf, cookie: response.headers.get('set-cookie').split(';')[0] };
};
const post = async (ch, body = '{"consent":true}', headers = {}, env = base, fetcher = mockFetch) => handleOwnerConsent(
 req('POST', {
  cookie: ch.cookie, 'x-ifund-csrf': ch.csrf, 'content-type': 'application/json',
  authorization: 'Bearer supabase-valid-test-token-123456',
  'x-ifund-base44-token': 'base44-valid-test-token-123456', ...headers,
 }, body), env, { fetcher },
);

test('GET mints 5-minute signed same-origin challenge with secure HttpOnly cookie', async () => {
 const r = await handleOwnerConsent(req('GET'), base);
 assert.equal(r.status, 200);
 assert.match(r.headers.get('set-cookie'), /Secure; HttpOnly; SameSite=Strict/);
 assert.equal(r.headers.get('cache-control'), 'no-store');
 assert.equal((await r.json()).expires_in_seconds, 300);
});
test('rejects cross-origin and mismatched host without CORS', async () => {
 assert.equal((await handleOwnerConsent(req('GET', { origin: 'https://evil.example' }), base)).status, 403);
 assert.equal((await handleOwnerConsent(req('GET', {}, undefined, 'https://evil.example/api/v1/migration/owner-link'), base)).status, 403);
});
test('rejects insecure http and URL query', async () => {
 assert.equal((await handleOwnerConsent(req('GET', { origin: 'http://interplanetaryfund.com' }, undefined, URL.replace('https:', 'http:')), base)).status, 403);
 assert.equal((await handleOwnerConsent(req('GET', {}, undefined, URL + '?token=bad'), base)).status, 403);
});
test('rejects missing or invalid limiter, secret, IP', async () => {
 assert.equal((await handleOwnerConsent(req('GET'), { ...base, IFUND_OWNER_LINK_LIMITER: undefined })).status, 503);
 assert.equal((await handleOwnerConsent(req('GET'), { ...base, IFUND_OWNER_LINK_CSRF_SECRET: 'short' })).status, 503);
 assert.equal((await handleOwnerConsent(req('GET', { 'cf-connecting-ip': 'not-an-ip' }), base)).status, 503);
});
test('rate limiting fails closed and does not issue challenge', async () => {
 const env = { ...base, IFUND_OWNER_LINK_LIMITER: { limit: async () => ({ success: false }) } };
 assert.equal((await handleOwnerConsent(req('GET'), env)).status, 429);
 const broken = { ...base, IFUND_OWNER_LINK_LIMITER: { limit: async () => { throw Error('internal secret'); } } };
 const r = await handleOwnerConsent(req('GET'), broken);
 assert.equal(r.status, 503);
 assert.doesNotMatch(await r.text(), /internal secret/);
});
test('no cookies or CSRF token rejects POST', async () => {
 assert.equal((await post({ cookie: '', csrf: '' })).status, 403);
});
test('tampered CSRF token or mismatched cookie rejects POST', async () => {
 const ch = await challenge();
 assert.equal((await post({ ...ch, csrf: ch.csrf + 'A' })).status, 403);
 assert.equal((await post({ ...ch, cookie: 'ifund_owner_csrf=other' })).status, 403);
});
test('expired signed challenge rejected', async () => {
 const then = Date.now();
 const env = { ...base };
 const r = await handleOwnerConsent(req('GET'), env, { now: () => then });
 const csrf = (await r.json()).csrf;
 const p = req('POST', {
  cookie: 'ifund_owner_csrf=' + csrf, 'x-ifund-csrf': csrf,
  'content-type': 'application/json', authorization: 'Bearer destination-token-1234567890',
  'x-ifund-base44-token': 'source-token-1234567890',
 }, '{"consent":true}');
 assert.equal((await handleOwnerConsent(p, env, { now: () => then + 300_001 })).status, 403);
});
test('explicit consent required, reject extra fields', async () => {
 const ch = await challenge();
 assert.equal((await post(ch, '{"consent":false}')).status, 400);
 assert.equal((await post(ch, '{"consent":true,"destination_auth_uid":"spoofed"}')).status, 400);
});
test('rejects oversized JSON before identity lookups', async () => {
 const ch = await challenge();
 assert.equal((await post(ch, JSON.stringify({ consent: true, padding: 'x'.repeat(300) }))).status, 400);
});
test('rejects incorrect content type', async () => {
 const ch = await challenge();
 assert.equal((await post(ch, '{"consent":true}', { 'content-type': 'text/plain' })).status, 415);
});
test('rejects missing bearer tokens and server-only credentials', async () => {
 const ch = await challenge();
 assert.equal((await post(ch, '{"consent":true}', { authorization: '' })).status, 401);
 assert.equal((await post(ch, '{"consent":true}', { 'x-ifund-base44-token': '' })).status, 401);
 assert.equal((await post(ch, '{"consent":true}', {}, { ...base, IFUND_SUPABASE_SERVICE_ROLE_KEY: undefined })).status, 503);
});
test('returns only linked state, never bearer tokens, IDs or emails', async () => {
 const ch = await challenge();
 const r = await post(ch);
 assert.equal(r.status, 200);
 assert.deepEqual(await r.json(), { ok: true, linked: true, already_linked: false });
 assert.match(r.headers.get('set-cookie'), /Max-Age=0/);
 assert.doesNotMatch(JSON.stringify([...r.headers]), /service-role-test-long-key/);
});
test('no preflight CORS grants; unsupported method returns 405', async () => {
 const r = await handleOwnerConsent(req('OPTIONS'), base);
 assert.equal(r.status, 405);
 assert.equal(r.headers.get('access-control-allow-origin'), null);
});

test('cross-tenant destination email mismatch blocks owner lookup and commit', async () => {
 const ch = await challenge();
 const called = [];
 const fetcher = async (url, opts) => {
  called.push(url);
  if (url.endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id: DEST, email: 'other@example.org', email_confirmed_at: '2026-10-23T00:00:00Z' }), { headers: { 'content-type': 'application/json' } });
  return mockFetch(url, opts);
 };
 const r = await post(ch, '{"consent":true}', {}, base, fetcher);
 assert.equal(r.status, 403);
 assert.equal(called.filter(x => x.includes('/rpc/')).length, 0);
});
test('source mapping mismatch blocks atomic commit', async () => {
 const ch = await challenge();
 let commits = 0;
 const fetcher = async (url, opts) => {
  if (url.endsWith('/rpc/ifund_migration_owner_lookup')) return new Response(JSON.stringify([{ source_owner_id: SOURCE, source_email: 'other@example.org', verification_state: 'awaiting_destination_login', destination_auth_uid: null }]), { headers: { 'content-type': 'application/json' } });
  if (url.endsWith('/rpc/ifund_migration_owner_commit')) commits++;
  return mockFetch(url, opts);
 };
 assert.equal((await post(ch, '{"consent":true}', {}, base, fetcher)).status, 403);
 assert.equal(commits, 0);
});
test('already verified same-owner replay is idempotent without second commit', async () => {
 const ch = await challenge();
 let commits = 0;
 const fetcher = async (url, opts) => {
  if (url.endsWith('/rpc/ifund_migration_owner_lookup')) return new Response(JSON.stringify([{ source_owner_id: SOURCE, source_email: 'owner@example.org', verification_state: 'verified', destination_auth_uid: DEST }]), { headers: { 'content-type': 'application/json' } });
  if (url.endsWith('/rpc/ifund_migration_owner_commit')) commits++;
  return mockFetch(url, opts);
 };
 const r = await post(ch, '{"consent":true}', {}, base, fetcher);
 assert.equal(r.status, 200);
 assert.equal((await r.json()).already_linked, true);
 assert.equal(commits, 0);
});
test('provider exception is sanitized, no secret disclosure', async () => {
 const ch = await challenge();
 const r = await post(ch, '{"consent":true}', {}, base, async () => { throw Error('secret-token-should-not-appear'); });
 assert.equal(r.status, 503);
 assert.doesNotMatch(await r.text(), /secret-token-should-not-appear/);
});
test('POST durable rate limiter rejects before any identity lookup', async () => {
 const ch = await challenge();
 let network = 0;
 const env = { ...base, IFUND_OWNER_LINK_LIMITER: { limit: async () => ({ success: false }) } };
 assert.equal((await post(ch, '{"consent":true}', {}, env, async () => { network++; throw Error('should not call'); })).status, 429);
 assert.equal(network, 0);
});
