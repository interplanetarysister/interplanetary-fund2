import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buildOAuthAuthorizationState,
  connectorAuthorizationStatus,
  connectorPolicy,
  providerCapabilities,
} from '../base44/shared/appUserConnectorPolicy.js';
import {
  denyMastodonNetworkAccess,
  MASTODON_NETWORK_BLOCK_REASON,
} from '../base44/shared/mastodonNetworkPolicy.js';
import {
  mergeConnectionCredentials,
  redactPlatformConnection,
} from '../base44/shared/credentialRedaction.js';

const entity = fs.readFileSync('base44/entities/PlatformConnection.jsonc', 'utf8');
const finalize = fs.readFileSync('base44/functions/finalizeAppUserOAuthConnection/entry.ts', 'utf8');
const verify = fs.readFileSync('base44/functions/verifyAppUserConnector/entry.ts', 'utf8');
const verifyPlatform = fs.readFileSync('base44/functions/verifyPlatformConnection/entry.ts', 'utf8');
const saveConnection = fs.readFileSync('base44/functions/saveConnectionCredentials/entry.ts', 'utf8');
const listConnections = fs.readFileSync('base44/functions/listConnections/entry.ts', 'utf8');
const prepare = fs.readFileSync('base44/functions/getAppUserConnector/entry.ts', 'utf8');
const dialog = fs.readFileSync('src/components/connections/ConnectDialog.jsx', 'utf8');
const socialPublish = fs.readFileSync('base44/shared/socialPublish.ts', 'utf8');
const mirror = fs.readFileSync('base44/functions/mirrorExternalPosts/entry.ts', 'utf8');

const schema = JSON.parse(entity);
for (const operation of ['create', 'update', 'delete']) {
  assert.equal(schema.rls[operation]?.user_condition?.role, 'admin', `${operation} must be server/admin owned`);
}

for (const platform of ['gmail', 'slack', 'github', 'facebook', 'patreon']) {
  const policy = connectorPolicy(platform);
  assert.ok(policy.requestedCapabilities.length > 0, `${platform} must declare a capability policy`);
  assert.ok(!policy.requestedCapabilities.includes('transfer_or_payout'), `${platform} must not inherit money movement`);
}
assert.deepEqual(connectorPolicy('gmail').requestedCapabilities, ['read_account', 'read_messages', 'reply_message']);
assert.deepEqual(connectorPolicy('googledrive').requestedCapabilities, ['read_account', 'read_resources']);
assert.ok(connectorPolicy('facebook').requestedCapabilities.includes('create_post'));
assert.ok(!connectorPolicy('facebook').requestedCapabilities.includes('read_balance'));
assert.ok(connectorPolicy('patreon').requestedCapabilities.includes('read_donations'));
assert.ok(!connectorPolicy('patreon').requestedCapabilities.includes('transfer_or_payout'));

assert.deepEqual(providerCapabilities({ accessToken: 'token-only' }), []);
assert.deepEqual(providerCapabilities({ scopes: 'profile email profile' }), ['profile', 'email']);

const tokenOnlyState = buildOAuthAuthorizationState({
  platform: 'gmail',
  kind: 'app',
  oauth: { accessToken: 'token-only' },
  sharedAgentConsent: true,
  now: '2026-09-28T00:00:00.000Z',
});
assert.equal(tokenOnlyState.status, 'disconnected');
assert.equal(tokenOnlyState.verification_status, 'unverified');
assert.equal(tokenOnlyState.capability_status, 'unknown');
assert.equal(tokenOnlyState.automation_mode, 'manual');
assert.equal(tokenOnlyState.agent_access.shared_with_agents, true);
assert.equal(tokenOnlyState.agent_access.automation_enabled, false);
assert.deepEqual(tokenOnlyState.obo_consent.granted_capabilities, []);

const overbroadGmailState = buildOAuthAuthorizationState({
  platform: 'gmail',
  kind: 'app',
  oauth: { accessToken: 'present', scopes: ['read_account', 'read_messages', 'transfer_or_payout', 'read_balance'] },
  sharedAgentConsent: true,
  now: '2026-09-28T00:00:00.000Z',
});
assert.deepEqual(overbroadGmailState.obo_consent.requested_capabilities, ['read_account', 'read_messages', 'reply_message']);
assert.deepEqual(overbroadGmailState.obo_consent.granted_capabilities, ['read_account', 'read_messages']);
assert.ok(!overbroadGmailState.obo_consent.granted_capabilities.includes('transfer_or_payout'));
assert.ok(!overbroadGmailState.obo_consent.granted_capabilities.includes('read_balance'));
assert.equal(overbroadGmailState.agent_access.automation_enabled, false);

const noConsentState = buildOAuthAuthorizationState({
  platform: 'facebook',
  kind: 'social',
  oauth: { accessToken: 'present', scopes: ['read_account', 'create_post'] },
  sharedAgentConsent: false,
  existing: { history: 'invalid-legacy-history' },
  now: '2026-09-28T00:00:00.000Z',
});
assert.equal(noConsentState.obo_consent.granted, false);
assert.deepEqual(noConsentState.obo_consent.granted_capabilities, []);
assert.equal(noConsentState.agent_access.shared_with_agents, false);
assert.equal(noConsentState.agent_access.automation_enabled, false);
assert.equal(noConsentState.history.length, 1);

const reauthorizedCrowdfundingState = buildOAuthAuthorizationState({
  platform: 'patreon',
  kind: 'crowdfunding',
  oauth: { accessToken: 'replacement-token', scopes: ['read_account', 'read_donations'] },
  sharedAgentConsent: true,
  existing: {
    external_total: 250,
    external_currency: 'USD',
    external_data_source: 'provider_verified',
    history: [],
  },
  now: '2026-09-28T00:00:00.000Z',
});
assert.equal(reauthorizedCrowdfundingState.status, 'disconnected');
assert.equal(reauthorizedCrowdfundingState.verification_status, 'unverified');
assert.equal(reauthorizedCrowdfundingState.external_data_source, 'owner_reported',
  'reauthorization must invalidate the checked/provider-verified badge until a fresh provider call succeeds');

assert.deepEqual(connectorAuthorizationStatus({ accessToken: 'token-only' }), {
  authorization_present: true,
  connected: false,
  provider_verified: false,
  configured: true,
});
assert.deepEqual(connectorAuthorizationStatus(null), {
  authorization_present: false,
  connected: false,
  provider_verified: false,
  configured: true,
});

assert.match(finalize, /authorization_present: true/);
assert.match(finalize, /buildOAuthAuthorizationState/);
assert.doesNotMatch(finalize, /status: 'connected'/);
assert.doesNotMatch(finalize, /verification_status: 'verified'/);
assert.doesNotMatch(finalize, /transfer_or_payout/);
assert.doesNotMatch(finalize, /automation_enabled:\s*sharedAgentConsent/);

assert.match(verify, /connectorAuthorizationStatus\(connection\)/);
assert.doesNotMatch(verify, /connected: !!connection\?\.accessToken/);

const rawConnection = {
  id: 'connection-1',
  status: 'error',
  credentials: {
    bluesky_handle: 'owner.example',
    bluesky_app_password: 'secret-app-password',
    mastodon_instance: 'social.example',
    mastodon_access_token: 'secret-token',
    kofi_verification_token: 'secret-webhook-token',
  },
};
for (const state of ['connected', 'error']) {
  const safe = redactPlatformConnection({ ...rawConnection, status: state });
  assert.equal(safe.status, state);
  assert.equal(safe.credentials.bluesky_handle, 'owner.example');
  assert.equal(safe.credentials.mastodon_instance, 'social.example');
  assert.equal(safe.credentials.bluesky_app_password, '');
  assert.equal(safe.credentials.mastodon_access_token, '');
  assert.equal(safe.credentials.kofi_verification_token, '');
  assert.equal(safe.credentials_meta.bluesky_app_password_set, true);
  assert.equal(safe.credentials_meta.mastodon_access_token_set, true);
  assert.equal(safe.credentials_meta.kofi_verification_token_set, true);
}
assert.equal((verifyPlatform.match(/connection: redactPlatformConnection\(updated\)/g) || []).length, 2);
assert.doesNotMatch(verifyPlatform, /connection: updated/);
assert.match(verifyPlatform, /ownerVisible\.created_by_id !== user\.id[\s\S]+sr\.entities\.PlatformConnection\.get/);

const storedCredentials = {
  bluesky_handle: 'owner.example',
  bluesky_app_password: 'stored-app-password',
  mastodon_instance: 'social.example',
  mastodon_access_token: 'stored-access-token',
  kofi_verification_token: 'stored-webhook-token',
};
const preserved = mergeConnectionCredentials(storedCredentials, {
  bluesky_handle: 'renamed.example',
  bluesky_app_password: '',
  mastodon_access_token: '',
  kofi_verification_token: '',
});
assert.equal(preserved.bluesky_handle, 'renamed.example');
assert.equal(preserved.bluesky_app_password, 'stored-app-password');
assert.equal(preserved.mastodon_access_token, 'stored-access-token');
assert.equal(preserved.kofi_verification_token, 'stored-webhook-token');
const ownerView = redactPlatformConnection({ credentials: preserved });
assert.equal(ownerView.credentials.bluesky_app_password, '');
assert.equal(ownerView.credentials_meta.bluesky_app_password_set, true);
assert.match(saveConnection, /ownerVisible\.created_by_id !== user\.id[\s\S]+sr\.entities\.PlatformConnection\.get/);
assert.match(listConnections, /asServiceRole\.entities\.PlatformConnection\.filter\(\{ created_by_id: user\.id \}/);
assert.match(finalize, /connection: redactPlatformConnection\(saved\)/);

assert.doesNotMatch(prepare, /connector_id/);
assert.match(prepare, /launch_available: false/);
assert.doesNotMatch(dialog, /data\?\.connector_id/);
assert.doesNotMatch(dialog, /connectAppUser/);

assert.doesNotMatch(socialPublish, /mastodon_instance[\s\S]{0,500}fetch\(/);
assert.match(socialPublish, /denyMastodonNetworkAccess/);
assert.doesNotMatch(mirror, /mastodon_instance[\s\S]{0,700}fetch\(/);
assert.match(mirror, /runExternalMirroring\(\)/);
assert.doesNotMatch(mirror, /\bfetch\(/);
assert.doesNotMatch(mirror, /connectors\.getConnection/);

let mastodonFetchCalls = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => {
  mastodonFetchCalls += 1;
  throw new Error('unsafe fetch reached');
};
try {
  assert.throws(denyMastodonNetworkAccess, new RegExp(MASTODON_NETWORK_BLOCK_REASON.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.equal(mastodonFetchCalls, 0);
} finally {
  globalThis.fetch = originalFetch;
}

const writeFiles = [
  'base44/functions/saveConnectionCredentials/entry.ts',
  'base44/functions/finalizeAppUserOAuthConnection/entry.ts',
  'base44/functions/verifyPlatformConnection/entry.ts',
  'base44/functions/disconnectPlatformConnection/entry.ts',
  'base44/functions/postCampaignUpdate/entry.ts',
  'base44/functions/publishPost/entry.ts',
  'base44/functions/broadcastPosts/entry.ts',
];
for (const file of writeFiles) {
  const source = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(source, /base44\.entities\.PlatformConnection\.(?:create|update|delete)\(/, `${file} contains a user-mode trusted-state write`);
}

console.log('Platform connection trusted-state, least-privilege, OAuth truth, and SSRF contract verified.');
