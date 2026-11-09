import assert from 'node:assert/strict';
import fs from 'node:fs';

const verify = fs.readFileSync('base44/functions/verifyPlatformConnection/entry.ts', 'utf8');
const provider = fs.readFileSync('base44/shared/connectionVerification.ts', 'utf8');
const sync = fs.readFileSync('base44/functions/syncConnections/entry.ts', 'utf8');
const health = fs.readFileSync('src/lib/connectionHealth.js', 'utf8');
const disconnect = fs.readFileSync('base44/functions/disconnectPlatformConnection/entry.ts', 'utf8');
const card = fs.readFileSync('src/components/connections/ConnectionCard.jsx', 'utf8');
const connectRows = fs.readFileSync('src/components/connections/connectAccountRows.js', 'utf8');
const gofundmePro = fs.readFileSync('base44/functions/verifyGoFundMeProConnection/entry.ts', 'utf8');
const resolver = fs.readFileSync('base44/functions/resolveConnectionStatus/entry.ts', 'utf8');
const recipe = fs.readFileSync('base44/entities/PlatformConnectionRecipe.jsonc', 'utf8');
const recipeRouting = fs.readFileSync('base44/shared/platformConnectionRecipes.ts', 'utf8');

assert.match(verify, /getCurrentAppUserConnection/);
assert.match(provider, /com\.atproto\.server\.createSession/);
assert.match(provider, /Live Mastodon verification is unavailable in this runtime/);
assert.doesNotMatch(provider, /api\/v1\/accounts\/verify_credentials/);
assert.match(verify, /verification_status: 'verified'/);
assert.match(verify, /verification_status: 'unverified'/);
assert.match(verify, /verification_type: verificationType/);
assert.match(verify, /verification_type: null/);
assert.match(verify, /accountAuthenticated = verificationType === 'provider_account'/);
assert.match(verify, /if \(accountAuthenticated\) await completeVerifiedManagedWork/);
assert.match(sync, /isLinkBasedPlatform\(c\.platform\) \|\| c\.platform !== 'bluesky'/);
assert.match(resolver, /connection\.verification_type === 'provider_account'/);
assert.match(resolver, /connection\.verification_type === 'provider_webhook'/);
assert.match(resolver, /connection\.verification_type === 'public_page'/);
assert.match(sync, /verification_type: 'provider_account'/);
assert.match(sync, /connection\.verification_type === 'provider_account'/);
assert.match(verify, /verification_type = 'public_page'/);
assert.match(verify, /verification_type = 'provider_webhook'/);
// Background workers cannot verify app-user OAuth without the signed-in owner.
assert.doesNotMatch(sync, /getCurrentAppUserConnection\(/);
assert.match(sync, /OAUTH_ENV\[c\.platform\]/);
assert.match(sync, /health_deferred/);
assert.match(sync, /Scheduled provider verification succeeded/);
assert.match(health, /verification_status === "verified"/);
assert.match(disconnect, /shared_with_agents: false/);
assert.match(disconnect, /automation_enabled: false/);
assert.match(card, /lifecycleHealth\(resolved\)/);
assert.match(card, /connectionHealth\(connection\)/);
assert.match(card, /needsReauthorization \? "Reconnect"/);
assert.match(card, /failed \? "Fix Connection"/);
assert.match(card, /onClick=\{onManage\}/);
assert.match(card, /const accountAuthenticated = verified && connection\.verification_type === "provider_account"/);
assert.match(card, /Link verified/);
assert.match(card, /Payment webhook verified/);
assert.match(card, /verifyGoFundMeProConnection/);
assert.match(connectRows, /Link verified/);
assert.match(connectRows, /Webhook verified/);
assert.match(gofundmePro, /account_authenticated: true/);
assert.match(resolver, /oauth_variant === 'gofundme_pro'/);

assert.match(recipeRouting, /TRANSPORT_PRIORITY/);
assert.match(resolver, /orderedTransports/);
assert.match(resolver, /deriveLifecycle/);
assert.match(resolver, /recoveryHint/);
for (const state of ['NOT_CONNECTED','AUTHORIZATION_REQUIRED','CONNECTED','RECONNECT_REQUIRED','DEGRADED','CONNECTING']) {
  assert.match(resolver, new RegExp(state));
}
for (const transport of ['oauth','api','webhook','token','authenticated_browser','public_browser','manual']) {
  assert.match(resolver + recipe + recipeRouting, new RegExp(transport));
}
assert.match(resolver, /provider-verified provenance/);
assert.match(resolver, /Configuration, recipes, saved credentials, or public URLs are NOT sufficient/);

console.log('Connection lifecycle, canonical resolver, and recovery contract verified.');
