import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const catalog = readFileSync('src/components/connections/platformCatalog.js', 'utf8');
const dialog = readFileSync('src/components/connections/ConnectDialog.jsx', 'utf8');
const connectorLookup = readFileSync('base44/functions/getAppUserConnector/entry.ts', 'utf8');
const connectorVerify = readFileSync('base44/functions/verifyAppUserConnector/entry.ts', 'utf8');
const connectionVerification = readFileSync('base44/shared/connectionVerification.ts', 'utf8');
const finalize = readFileSync('base44/functions/finalizeAppUserOAuthConnection/entry.ts', 'utf8');

assert.match(catalog, /id: "tiktok"[\s\S]{0,500}Posting is not currently supported/);
assert.doesNotMatch(catalog, /id: "tiktok"[\s\S]{0,220}post campaign content/);

for (const id of ['threads','x','pinterest','reddit','youtube']) {
  const start = catalog.indexOf(`id: "${id}"`);
  assert.notEqual(start, -1);
  const block = catalog.slice(start, start + 650);
  assert.match(block, /setupKind: "link"/);
  assert.doesNotMatch(block, /setupKind: "oauth"/);
}

for (const env of ['THREADS','X','PINTEREST','REDDIT','YOUTUBE','PATREON']) {
  assert.doesNotMatch(connectorLookup, new RegExp(`APP_USER_CONNECTOR_${env}_ID`));
  assert.doesNotMatch(connectorVerify, new RegExp(`APP_USER_CONNECTOR_${env}_ID`));
  assert.doesNotMatch(connectionVerification, new RegExp(`APP_USER_CONNECTOR_${env}_ID`));
  assert.doesNotMatch(finalize, new RegExp(`APP_USER_CONNECTOR_${env}_ID`));
}

assert.match(dialog, /platform\.kind === "crowdfunding"/);
assert.match(dialog, /platform\.kind === "social"/);
assert.doesNotMatch(dialog, /full set of useful permissions/);
assert.doesNotMatch(dialog, /money-moving steps/);

// OAuth transport alone must never be promoted into the desired capability set.
assert.match(finalize, /providerCapabilities\(oauth/);
assert.match(finalize, /capability_status: confirmed\.length \? 'confirmed' : 'unknown'/);
assert.match(finalize, /granted_capabilities: sharedAgentConsent \? confirmed : \[\]/);

console.log('native connector truth contract: ok');
