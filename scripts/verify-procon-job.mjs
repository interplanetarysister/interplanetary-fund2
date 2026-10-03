import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../'+p, import.meta.url),'utf8');
const get = read('base44/functions/getAppUserConnector/entry.ts');
const registry = read('base44/shared/connectionVerification.ts');
const verify = read('base44/functions/verifyAppUserConnector/entry.ts');
const finalize = read('base44/functions/finalizeAppUserOAuthConnection/entry.ts');
const connectorPolicy = read('base44/shared/appUserConnectorPolicy.js');
const disconnect = read('base44/functions/disconnectPlatformConnection/entry.ts');
const dialog = read('src/components/connections/ConnectDialog.jsx');
const connections = read('src/pages/Connections.jsx');
const app = read('src/App.jsx');
const card = read('src/components/connections/ConnectionCard.jsx');
const runtime = read('scripts/require-node22.mjs');
const providers = ['linkedin','facebook','instagram','discord','tiktok','threads','x','pinterest','reddit','youtube','patreon'];
for (const provider of providers) {
  assert.match(registry, new RegExp('\\b'+provider+':'), provider+' missing canonical connector registry entry');
}
assert.match(finalize, /Object\.keys\(OAUTH_ENV\)/, 'OAuth finalization must derive its platform allowlist from the canonical registry');
for (const consumer of [get, verify, disconnect]) {
  assert.match(consumer, /OAUTH_ENV/, 'connector lifecycle function must consume canonical OAuth registry');
}
assert.doesNotMatch(get, /connector_id/);
assert.match(get, /launch_available: false/);
assert.doesNotMatch(dialog, /connectAppUser/);
for (const source of [connections, app]) {
  assert.match(source, /ifund_pending_platform_connection/);
}
assert.match(connections, /pending\.userId === me\.id/);
assert.match(connections, /Date\.now\(\) - pending\.startedAt < 20 \* 60 \* 1000/);
assert.match(app, /me\?\.id === pending\.userId/);
assert.doesNotMatch(dialog, /ifund_pending_oauth_platform/);
assert.match(finalize, /buildOAuthAuthorizationState/);
assert.match(finalize, /authorization_present: true/);
assert.match(finalize, /verification_required: true/);
assert.match(connections, /data\?\.authorization_present && data\?\.verification_required/);
assert.match(connections, /authorization was saved\. A live provider check is still required/);
assert.match(connectorPolicy, /verification_status: 'unverified'/);
assert.match(connectorPolicy, /capability_status: confirmed\.length \? 'confirmed' : 'unknown'/);
assert.match(connectorPolicy, /external_data_source: 'owner_reported'/);
assert.doesNotMatch(connectorPolicy, /external_data_source: existing\?\.external_data_source/);
assert.doesNotMatch(finalize, /granted_capabilities:\s*cfg\.requestedCapabilities/);
assert.match(card, /disconnectPlatformConnection/);
assert.doesNotMatch(card, /PlatformConnection\.delete/);
assert.match(runtime, /const SUPPORTED = \[20, 22\];/);
assert.doesNotMatch(runtime, /SUPPORTED\s*=\s*\[22\]/);
console.log('Pc Job connection contract passed.');
