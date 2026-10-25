import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dispatchOwnerLink, OWNER_LINK_PATH } from './owner-consent-dispatch.mjs';

const url = `https://interplanetaryfund.com${OWNER_LINK_PATH}`;
const req = (method = 'GET') => new Request(url, { method });

test('unrelated requests pass through untouched', async () => {
  assert.equal(await dispatchOwnerLink(new Request('https://interplanetaryfund.com/api/health'), {}), null);
});
test('disabled by default: no cookie, provider fetch, or secret exposure', async () => {
  let calls = 0;
  const response = await dispatchOwnerLink(req(), {}, async () => { calls++; throw Error('should not call'); });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('set-cookie'), null);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(calls, 0);
  assert.deepEqual(await response.json(), { error: 'owner_link_unavailable', cutover_ready: false });
});
test('only exact enabled flag invokes handler', async () => {
  let calls = 0;
  const handler = async () => { calls++; return new Response('handler-ok', { status: 200 }); };
  for (const flag of [undefined, null, true, 'true', 'ENABLED', '1']) {
    const response = await dispatchOwnerLink(req(), { IFUND_OWNER_LINK_ENABLED: flag }, handler);
    assert.equal(response.status, 503);
  }
  assert.equal(calls, 0);
  const response = await dispatchOwnerLink(req(), { IFUND_OWNER_LINK_ENABLED: 'enabled' }, handler);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'handler-ok');
  assert.equal(calls, 1);
});
test('missing handler and thrown handler both fail closed without leaking secrets', async () => {
  const env = { IFUND_OWNER_LINK_ENABLED: 'enabled' };
  assert.equal((await dispatchOwnerLink(req(), env)).status, 503);
  const response = await dispatchOwnerLink(req(), env, async () => { throw Error('secret-value-123'); });
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /secret-value-123/);
});
test('worker source contains early exact-path routing before generic admin fallback', () => {
  const source = readFileSync(new URL('../gateway/worker.js', import.meta.url), 'utf8');
  assert.match(source, /import \{ handleOwnerConsent \} from ['"]\.\.\/migration\/owner-consent-route\.mjs['"]/);
  assert.match(source, /import \{ dispatchOwnerLink, OWNER_LINK_PATH \} from ['"]\.\.\/migration\/owner-consent-dispatch\.mjs['"]/);
  const route = source.indexOf('if (url.pathname === OWNER_LINK_PATH) return dispatchOwnerLink(request, env, handleOwnerConsent);');
  const fallback = source.indexOf('const origin=allowedOrigin(request,env);');
  assert.ok(route > 0 && fallback > route, 'owner link must precede admin fallback');
});

test('owner-only campaign RPC requires audited proof and excludes historical email candidates', () => {
  const sql = readFileSync(new URL('../../docs/migration/independent-owner-campaigns-rpc.sql', import.meta.url), 'utf8');
  assert.match(sql, /m\.destination_auth_uid\s*=\s*auth\.uid\(\)/);
  assert.match(sql, /m\.verification_state\s*=\s*'verified'/);
  assert.match(sql, /m\.candidate_match_method\s+IS\s+NULL/i);
  assert.match(sql, /EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+ifund_migration\.owner_link_consent_audit/i);
  assert.match(sql, /proof\.source_owner_id\s*=\s*m\.source_owner_id/);
  assert.match(sql, /proof\.destination_auth_uid\s*=\s*m\.destination_auth_uid/);
  assert.match(sql, /proof\.consent_version\s*=\s*'ifund-owner-link-v1'/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.ifund_migration_my_campaigns\(\) FROM PUBLIC, anon/);
});
