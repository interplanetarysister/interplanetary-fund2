import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  DIRECT_VERIFICATION_ENDPOINTS,
  directVerificationRequest,
  verifyDirectConnection,
} from '../base44/shared/manualConnectionVerificationPolicy.js';
import { hasFreshProviderVerification } from '../base44/shared/providerVerificationPolicy.js';
import { deriveConnectionLifecycle, scopedOboGrants } from '../base44/shared/connectionLifecyclePolicy.js';

const verify = fs.readFileSync('base44/functions/verifyPlatformConnection/entry.ts', 'utf8');
const provider = fs.readFileSync('base44/shared/connectionVerification.ts', 'utf8');
const sync = fs.readFileSync('base44/functions/syncConnections/entry.ts', 'utf8');
const directPublish = [
  'base44/functions/publishPost/entry.ts',
  'base44/functions/broadcastPosts/entry.ts',
  'base44/functions/postCampaignUpdate/entry.ts',
].map((path) => fs.readFileSync(path, 'utf8'));
const health = fs.readFileSync('src/lib/connectionHealth.js', 'utf8');
const disconnect = fs.readFileSync('base44/functions/disconnectPlatformConnection/entry.ts', 'utf8');
const card = fs.readFileSync('src/components/connections/ConnectionCard.jsx', 'utf8');
const resolver = fs.readFileSync('base44/functions/resolveConnectionStatus/entry.ts', 'utf8');
const lifecyclePolicy = fs.readFileSync('base44/shared/connectionLifecyclePolicy.js', 'utf8');
const recipe = fs.readFileSync('base44/entities/PlatformConnectionRecipe.jsonc', 'utf8');

assert.match(verify, /getCurrentAppUserConnection/);
assert.match(provider, /verifyDirectConnection/);
assert.match(verify, /providerVerified = false/);
assert.match(verify, /Token presence proves configuration only/);
assert.match(verify, /if \(!providerVerified\) throw/);
assert.match(verify, /verification_status: 'verified'/);
assert.match(verify, /verification_status: 'unverified'/);
assert.match(sync, /oauth_live_probe_unavailable/);
assert.match(sync, /assertOboGrant\(sr, 'platform_outreach_agent', ownerUserId, 'social_publish', connection\)/);
assert.match(sync, /hasFreshProviderVerification\(connection, now\.getTime\(\)\)/);
assert.match(sync, /access\.ok && obo\.ok && verificationFresh/);
for (const source of directPublish) {
  assert.match(source, /hasFreshProviderVerification\((?:conn|connection)\)/);
  assert.ok(source.indexOf('hasFreshProviderVerification(') < source.indexOf('await publishThroughConnection('), 'verification must precede the provider side effect');
}
const verifiedAt = Date.now();
const ready = { status: 'connected', verification_status: 'verified', last_synced: new Date(verifiedAt).toISOString(), last_error: '' };
assert.equal(hasFreshProviderVerification(ready, verifiedAt), true);
for (const denied of [
  { status: 'disconnected' }, { verification_status: 'unverified' },
  { last_error: 'provider rejected access' }, { last_synced: '' },
  { last_synced: new Date(verifiedAt - 8 * 86400_000).toISOString() },
  { last_synced: new Date(verifiedAt + 60_000).toISOString() },
]) assert.equal(hasFreshProviderVerification({ ...ready, ...denied }, verifiedAt), false);
assert.match(sync, /capability_status: reauth \? 'reauthorization_required' : 'unknown'/);
assert.doesNotMatch(sync, /if \(oauth\?\.accessToken\)[\s\S]{0,200}verification_status: 'verified'/);
assert.match(verify, /capability_status: reauth \? 'reauthorization_required' : 'unknown'/);
assert.doesNotMatch(provider, /mastodon_instance|verify_credentials|publicHttpsHost/);
assert.deepEqual(Object.keys(DIRECT_VERIFICATION_ENDPOINTS), ['bluesky']);
const blueskyRequest = directVerificationRequest('bluesky', {
  bluesky_handle: 'owner.example',
  bluesky_app_password: 'app-password',
});
assert.equal(blueskyRequest.url, 'https://bsky.social/xrpc/com.atproto.server.createSession');
assert.equal(blueskyRequest.init.redirect, 'error');
assert.equal(new URL(blueskyRequest.url).hostname, 'bsky.social');

// Executable SSRF regression cases. Mastodon is deliberately unavailable:
// without resolution/pinning and private-egress denial, even a public-looking
// hostname can rebind after validation and therefore must never reach fetch.
for (const hostname of [
  'localhost',
  '127.0.0.1',
  '10.0.0.1',
  '169.254.169.254',
  'metadata.google.internal',
  '[::1]',
  '[fe80::1]',
  'public-looking-rebind.example',
  'mastodon.social',
]) {
  let fetchCalls = 0;
  await assert.rejects(
    verifyDirectConnection('mastodon', {
      mastodon_instance: hostname,
      mastodon_access_token: 'must-not-be-used',
    }, async () => {
      fetchCalls += 1;
      return { ok: true };
    }),
    /unavailable until private-network egress can be denied safely/i,
    `unsafe Mastodon hostname reached a request path: ${hostname}`,
  );
  assert.equal(fetchCalls, 0, `fetch was called for unsafe Mastodon hostname: ${hostname}`);
}
assert.match(sync, /reauthorization_required/);
assert.match(sync, /Scheduled provider verification succeeded/);
assert.match(health, /verification_status === "verified"/);
assert.match(disconnect, /shared_with_agents: false/);
assert.match(disconnect, /automation_enabled: false/);
assert.match(verify, /error\?\.name \|\| 'UnknownError'/);
assert.doesNotMatch(verify, /last_error: error\?\.message/);
assert.doesNotMatch(verify, /console\.error\([^\n]*error\?\.message/);
assert.match(card, /actionLock\.current/);
assert.doesNotMatch(card, /console\.error\("Connection check failed", e\)/);
assert.match(card, /verifyPlatformConnection/);
assert.match(card, /\/>Check/);

assert.match(resolver, /orderedTransports/);
assert.match(resolver, /deriveConnectionLifecycle/);
assert.match(resolver, /recoveryHint/);
for (const state of ['NOT_CONNECTED','AUTHORIZATION_REQUIRED','CONNECTED','RECONNECT_REQUIRED','DEGRADED','CONNECTING','DISCONNECTED','BLOCKED']) {
  assert.match(resolver + lifecyclePolicy, new RegExp(state));
}
for (const transport of ['oauth','api','webhook','token','authenticated_browser','public_browser','manual']) {
  assert.match(resolver + recipe, new RegExp(transport));
}
assert.match(resolver, /provider-verified provenance/);
assert.match(resolver, /Configuration, recipes, saved credentials, or public URLs are NOT sufficient/);

const oauthRecipe = { preferred_transport: 'oauth' };
const browserRecipe = { preferred_transport: 'public_browser' };
assert.equal(deriveConnectionLifecycle({
  connection: { status: 'connected', verification_status: 'unverified', last_synced: new Date(verifiedAt).toISOString() },
  oauth: { configured: true, transport_ok: true }, recipe: oauthRecipe, now: verifiedAt,
}), 'CONNECTING', 'an OAuth token without provider proof must not be connected');
assert.equal(deriveConnectionLifecycle({
  connection: { ...ready, last_synced: new Date(verifiedAt - 8 * 86400_000).toISOString() },
  oauth: { configured: true, transport_ok: true }, recipe: oauthRecipe, now: verifiedAt,
}), 'CONNECTING', 'stale provider proof must not be connected');
assert.equal(deriveConnectionLifecycle({
  connection: { ...ready, external_url: 'https://example.test/campaign', obo_consent: { granted: true } },
  recipe: browserRecipe, browserRunEnabled: false, now: verifiedAt,
}), 'BLOCKED', 'a disabled browser runner must remain blocked even with URL, consent, and old verification');
assert.equal(deriveConnectionLifecycle({
  connection: ready, oauth: { configured: true, transport_ok: true }, recipe: oauthRecipe, now: verifiedAt,
}), 'CONNECTED');

const consentedConnection = {
  obo_consent: { granted: true, granted_capabilities: ['read_analytics'] },
  agent_access: { shared_with_agents: true },
};
assert.equal(scopedOboGrants(consentedConnection, [
  { status: 'active', agent_name: 'unrelated-agent', scope: 'publish_draft' },
], verifiedAt).length, 0, 'an unrelated active grant must not authorize this connection capability');
assert.equal(scopedOboGrants(consentedConnection, [
  { status: 'active', agent_name: 'analytics-agent', scope: 'read_analytics' },
], verifiedAt).length, 1);
assert.match(resolver, /BROWSER_RUN_POLICY\.enabled/);
assert.match(resolver, /scopedOboGrants/);

console.log('Connection lifecycle, canonical resolver, and recovery contract verified.');
