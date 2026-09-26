import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../'+p, import.meta.url),'utf8');
const get = read('base44/functions/getAppUserConnector/entry.ts');
const verify = read('base44/functions/verifyAppUserConnector/entry.ts');
const finalize = read('base44/functions/finalizeAppUserOAuthConnection/entry.ts');
const disconnect = read('base44/functions/disconnectPlatformConnection/entry.ts');
const dialog = read('src/components/connections/ConnectDialog.jsx');
const connections = read('src/pages/Connections.jsx');
const app = read('src/App.jsx');
const card = read('src/components/connections/ConnectionCard.jsx');
const runtime = read('scripts/require-node22.mjs');
const providers = ['linkedin','facebook','instagram','discord','tiktok','threads','x','pinterest','reddit','youtube','patreon'];
for (const provider of providers) {
  assert.match(get, new RegExp('\\b'+provider+':'), provider+' missing connector lookup');
  assert.match(verify, new RegExp('\\b'+provider+':'), provider+' missing connector verification');
  assert.match(finalize, new RegExp('\\b'+provider+':'), provider+' missing OAuth finalization');
  assert.match(disconnect, new RegExp('\\b'+provider+':'), provider+' missing central revocation');
}
assert.match(dialog, /connectAppUser/);
for (const source of [dialog, connections, app]) {
  assert.match(source, /ifund_pending_platform_connection/);
}
assert.match(dialog, /userId:\s*me\.id/);
assert.match(dialog, /sharedAgentConsent:\s*permissionAccepted/);
assert.match(connections, /pending\.userId === me\.id/);
assert.match(connections, /Date\.now\(\) - pending\.startedAt < 20 \* 60 \* 1000/);
assert.match(app, /me\?\.id === pending\.userId/);
assert.doesNotMatch(dialog, /ifund_pending_oauth_platform/);
assert.match(finalize, /providerCapabilities/);
assert.match(finalize, /capability_status: confirmed\.length \? 'confirmed' : 'unknown'/);
assert.doesNotMatch(finalize, /granted_capabilities:\s*cfg\.requestedCapabilities/);
assert.match(card, /disconnectPlatformConnection/);
assert.doesNotMatch(card, /PlatformConnection\.delete/);
assert.match(runtime, /const SUPPORTED = \[20, 22\];/);
assert.doesNotMatch(runtime, /SUPPORTED\s*=\s*\[22\]/);
console.log('Pc Job connection contract passed.');
