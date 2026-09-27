import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const catalog = readFileSync('src/components/connections/platformCatalog.js', 'utf8');
const finalize = readFileSync('base44/functions/finalizeAppUserOAuthConnection/entry.ts', 'utf8');

assert.match(catalog, /id: "tiktok"[\s\S]{0,500}Posting is not currently supported/);
assert.doesNotMatch(catalog, /id: "tiktok"[\s\S]{0,220}post campaign content/);

// OAuth transport alone must never be promoted into the desired capability set.
assert.match(finalize, /providerCapabilities\(oauth/);
assert.match(finalize, /capability_status: confirmed\.length \? 'confirmed' : 'unknown'/);
assert.match(finalize, /granted_capabilities: sharedAgentConsent \? confirmed : \[\]/);

console.log('native connector truth contract: ok');
