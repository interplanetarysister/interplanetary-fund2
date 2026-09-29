import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../'+p, import.meta.url),'utf8');
const get = read('base44/functions/getAppUserConnector/entry.ts');
const registry = read('base44/shared/connectionVerification.ts');
const verify = read('base44/functions/verifyAppUserConnector/entry.ts');
const finalize = read('base44/functions/finalizeAppUserOAuthConnection/entry.ts');
const disconnect = read('base44/functions/disconnectPlatformConnection/entry.ts');
const dialog = read('src/components/connections/ConnectDialog.jsx');
const card = read('src/components/connections/ConnectionCard.jsx');
const runtime = read('scripts/require-node22.mjs');
const providers = ['linkedin','facebook','instagram','discord','tiktok','threads','x','pinterest','reddit','youtube','patreon'];
for (const provider of providers) {
  assert.match(registry, new RegExp('\\b'+provider+':'), provider+' missing canonical connector registry entry');
  assert.match(finalize, new RegExp('\\b'+provider+':'), provider+' missing OAuth finalization config');
}
for (const consumer of [get, verify, disconnect]) {
  assert.match(consumer, /OAUTH_ENV/, 'connector lifecycle function must consume canonical OAuth registry');
}
assert.match(dialog, /connectAppUser/);
assert.match(dialog, /ifund_pending_platform_connection/);
assert.match(finalize, /providerCapabilities/);
assert.match(finalize, /capability_status: confirmed\.length \? 'confirmed' : 'unknown'/);
assert.doesNotMatch(finalize, /granted_capabilities:\s*cfg\.requestedCapabilities/);
assert.match(card, /disconnectPlatformConnection/);
assert.doesNotMatch(card, /PlatformConnection\.delete/);
assert.match(runtime, /const SUPPORTED = \[20, 22, 24\];/);
assert.doesNotMatch(runtime, /SUPPORTED\s*=\s*\[22\]/);
console.log('Pc Job connection contract passed.');
