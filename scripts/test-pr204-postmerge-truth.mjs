import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const between = (source, start, end) => {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `missing source block: ${start}`);
  return source.slice(from, to);
};

const healthSource = read('base44/functions/validateIntegrationHealth/entry.ts');
const healthBlock = between(healthSource, 'function hasRecordedProviderEvidence', '\nexport default async function');
const validateEntry = new Function(
  'PLATFORM_SECRETS', 'checkSecrets', 'secrets', 'verifyCloudflareToken', 'isUnhealthy', 'STATUS_LABEL',
  `${healthBlock}\nreturn validateEntry;`,
)(
  { stripe: ['STRIPE_SECRET_KEY'], paypal: ['PAYPAL_CLIENT_ID'] },
  (platform) => ({ names: [platform], missing: [platform] }),
  { get: () => '' },
  async () => ({ ok: false, detail: 'not configured' }),
  (status) => status !== 'ACTIVE',
  {},
);

const sr = { connectors: { getConnection: async () => ({ accessToken: 'configured-not-verified' }) } };
const revoked = await validateEntry(sr, { platform: 'stripe', status: 'REVOKED', optional: false });
assert.equal(revoked.status, 'REVOKED', 'revocation must outrank missing configuration');
assert.equal(revoked.applyStatus, true);

const defaultActive = await validateEntry(sr, {
  platform: 'github', status: 'ACTIVE', auth_type: 'oauth', account_identifier: 'platform-managed',
});
assert.equal(defaultActive.status, 'DISCONNECTED', 'ACTIVE without provider evidence must fail closed');
assert.equal(defaultActive.applyStatus, true);

const verifiedActive = await validateEntry(sr, {
  platform: 'github', status: 'ACTIVE', auth_type: 'oauth',
  account_identifier: 'platform-managed', last_successful_verification: '2026-10-11T19:00:00.000Z',
});
assert.equal(verifiedActive.status, 'ACTIVE');
assert.equal(verifiedActive.applyStatus, false, 'unsupported checks must not rewrite provider-backed state');

const perConnection = await validateEntry(sr, {
  platform: 'mastodon', status: 'ACTIVE', auth_type: 'per_connection',
});
assert.equal(perConnection.status, 'DISCONNECTED');
assert.equal(perConnection.applyStatus, true);

const sharedSource = read('base44/shared/integrationRegistry.ts');
const accessBlock = between(sharedSource, 'export async function assertPlatformAccess', '\n// OBO');
const assertPlatformAccess = new Function(
  `${accessBlock.replace('export async function', 'async function')}\nreturn assertPlatformAccess;`,
)();
const registry = (entry) => ({ entities: { PlatformAccessRegistry: { filter: async () => [entry] } } });
assert.equal((await assertPlatformAccess(registry({ status: 'ACTIVE' }), 'github')).ok, false);
assert.equal((await assertPlatformAccess(registry({
  status: 'ACTIVE', last_successful_verification: '2026-10-11T19:00:00.000Z',
}), 'github')).ok, true);

const adminSource = read('src/pages/IntegrationsAdmin.jsx');
const lockBlock = between(adminSource, 'function withTimeout', '\nfunction isAdminUser');
const { invokeWithLock } = new Function(
  'REQUEST_TIMEOUT_MS',
  `${lockBlock}\nreturn { invokeWithLock };`,
)(10);
let starts = 0;
let finish;
const lock = { current: null };
const first = invokeWithLock(lock, () => {
  starts += 1;
  return new Promise((resolve) => { finish = resolve; });
});
await assert.rejects(first, /Request timed out/);
const second = invokeWithLock(lock, () => {
  starts += 1;
  return Promise.resolve('overlap');
});
assert.equal(starts, 1, 'retry must attach to the original in-flight operation');
finish('done');
assert.equal(await second, 'done');
assert.equal(lock.current, null);

const snapshotSource = read('base44/shared/publicCampaignSnapshot.ts');
const decodeBlock = between(snapshotSource, 'function decode', '\nfunction readMeta');
const decode = new Function(`${decodeBlock}\nreturn decode;`)();
assert.equal(decode('&amp;lt;script&amp;gt;'), '&lt;script&gt;', 'metadata decoding must be single-pass');

const saveSource = read('base44/functions/saveConnectionCredentials/entry.ts');
assert.match(saveSource, /hasReportedTotal \|\| hasReportedDonors[\s\S]{0,80}'owner_reported'/);
const createSource = read('src/pages/CreateCampaign.jsx');
assert.match(createSource, /campaign: \{ goal_amount: goal \}/);
assert.doesNotMatch(createSource, /title: form\.title \|\| snapshot\.title/);

console.log('PR #204 post-merge truth behavior: PASS');
