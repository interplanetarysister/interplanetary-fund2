import assert from 'node:assert/strict';
import fs from 'node:fs';

const verify = fs.readFileSync('base44/functions/verifyPlatformConnection/entry.ts', 'utf8');
const provider = fs.readFileSync('base44/shared/connectionVerification.ts', 'utf8');
const sync = fs.readFileSync('base44/functions/syncConnections/entry.ts', 'utf8');
const health = fs.readFileSync('src/lib/connectionHealth.js', 'utf8');
const disconnect = fs.readFileSync('base44/functions/disconnectPlatformConnection/entry.ts', 'utf8');
const card = fs.readFileSync('src/components/connections/ConnectionCard.jsx', 'utf8');
const resolver = fs.readFileSync('base44/functions/resolveConnectionStatus/entry.ts', 'utf8');
const recipeResolver = fs.readFileSync('base44/functions/resolvePlatformConnectionRecipe/entry.ts', 'utf8');
const recipe = fs.readFileSync('base44/entities/PlatformConnectionRecipe.jsonc', 'utf8');

assert.match(verify, /getCurrentAppUserConnection/);
assert.match(provider, /com\.atproto\.server\.createSession/);
assert.match(provider, /api\/v1\/accounts\/verify_credentials/);
assert.match(verify, /verification_status: 'verified'/);
assert.match(verify, /verification_status: 'unverified'/);
assert.match(sync, /reauthorization_required/);
assert.match(sync, /Scheduled provider verification succeeded/);
assert.match(health, /verification_status === "verified"/);
assert.match(disconnect, /shared_with_agents: false/);
assert.match(disconnect, /automation_enabled: false/);
assert.match(card, /verifyPlatformConnection/);
assert.match(card, /\/>Check/);

assert.match(resolver, /TRANSPORT_PRIORITY/);
assert.match(resolver, /orderedTransports/);
assert.match(resolver, /deriveLifecycle/);
assert.match(resolver, /recoveryHint/);
for (const state of ['NOT_CONNECTED','AUTHORIZATION_REQUIRED','CONNECTED','RECONNECT_REQUIRED','DEGRADED','CONNECTING']) {
  assert.match(resolver, new RegExp(state));
}
for (const transport of ['oauth','api','webhook','token','authenticated_browser','public_browser','manual']) {
  assert.match(resolver + recipeResolver + recipe, new RegExp(transport));
}
assert.match(recipeResolver, /next_candidate/);
assert.match(recipeResolver, /blockedRoutes/);
assert.match(recipe, /successful_route/);
assert.match(recipe, /rediscovery_on_failure/);
assert.match(resolver, /provider-verified provenance/);
assert.match(resolver, /Configuration, recipes, saved credentials, or public URLs are NOT sufficient/);

console.log('Connection lifecycle, canonical resolver, and recovery contract verified.');
