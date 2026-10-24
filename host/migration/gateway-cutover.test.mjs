// Offline regression tests for the migration gateway's fail-closed cutover behavior.
// No external requests, secrets, paid runs, or database writes.
// Run with: node --test host/migration/gateway-cutover.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../gateway/worker.js';

const url = path => 'https://ifund.invalid' + path;
const run = (path, method='GET', env={}) =>
  worker.fetch(new Request(url(path), { method }), env);

test('readiness refuses cutover while Base44 is authoritative', async () => {
  const response = await run('/api/health/readiness');
  assert.equal(response.status, 503);
  const data = await response.json();
  assert.equal(data.ready, false);
  assert.equal(data.independent_backend, false);
  assert.ok(data.blockers.includes('base44_campaign_authority'));
});
test('independent campaign preview stays disabled by default', async () => {
  const response = await run('/api/v1/migration/campaigns');
  assert.equal(response.status, 503);
  assert.equal((await response.json()).cutover_ready, false);
});
test('independent auth preview stays disabled by default', async () => {
  const response = await run('/api/v1/migration/auth/session');
  assert.equal(response.status, 503);
});
test('enabled preview still requires bearer authentication', async () => {
  const env = { IFUND_INDEPENDENT_AUTH_PREVIEW: 'enabled' };
  for (const path of ['/api/v1/migration/campaigns', '/api/v1/migration/auth/session']) {
    const response = await run(path, 'GET', env);
    assert.equal(response.status, 401);
  }
});
test('mutation methods cannot read campaign preview', async () => {
  const response = await run('/api/v1/migration/campaigns', 'POST',
    { IFUND_INDEPENDENT_AUTH_PREVIEW: 'enabled' });
  assert.equal(response.status, 405);
});
