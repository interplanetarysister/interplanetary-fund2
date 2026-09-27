import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  DIRECT_VERIFICATION_ENDPOINTS,
  directVerificationRequest,
  verifyDirectConnection,
} from '../base44/shared/manualConnectionVerificationPolicy.js';

const verify = fs.readFileSync('base44/functions/verifyPlatformConnection/entry.ts', 'utf8');
const provider = fs.readFileSync('base44/shared/connectionVerification.ts', 'utf8');
const sync = fs.readFileSync('base44/functions/syncConnections/entry.ts', 'utf8');
const health = fs.readFileSync('src/lib/connectionHealth.js', 'utf8');
const disconnect = fs.readFileSync('base44/functions/disconnectPlatformConnection/entry.ts', 'utf8');
const card = fs.readFileSync('src/components/connections/ConnectionCard.jsx', 'utf8');

assert.match(verify, /getCurrentAppUserConnection/);
assert.match(provider, /verifyDirectConnection/);
assert.match(verify, /providerVerified = false/);
assert.match(verify, /Token presence proves configuration only/);
assert.match(verify, /if \(!providerVerified\) throw/);
assert.match(verify, /verification_status: 'verified'/);
assert.match(verify, /verification_status: 'unverified'/);
assert.match(sync, /oauth_live_probe_unavailable/);
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
console.log('Connection lifecycle and operational health contract verified.');
