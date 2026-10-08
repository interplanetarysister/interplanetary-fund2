import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const finalize = read('base44/functions/finalizeAppUserOAuthConnection/entry.ts');
const compatibility = read('base44/functions/completeOAuthConnection/entry.ts');
const connect = read('src/components/connections/ConnectDialog.jsx');
const page = read('src/pages/Connections.jsx');
const verify = read('base44/functions/verifyPlatformConnection/entry.ts');

assert.match(connect, /localStorage\.setItem\("ifund_pending_platform_connection"/);
assert.ok(
  connect.indexOf('localStorage.setItem("ifund_pending_platform_connection"') <
  connect.indexOf('base44.connectors.connectAppUser(data.connector_id)'),
  'OAuth return state must be stored before redirect'
);
assert.match(connect, /campaignId: form\.campaign_id/);
assert.match(connect, /campaignTitle: selectedCampaign\?\.title/);
assert.match(connect, /returnPath: "\/connections"/);
assert.match(connect, /destination\.protocol !== "https:"/);

assert.match(finalize, /getCurrentAppUserConnection/);
assert.match(finalize, /requestedCampaignId/);
assert.match(finalize, /pairedCampaign\.created_by_id !== user\.id/);
assert.match(finalize, /hasUnifiedOboConsent/);
assert.match(finalize, /ai_consent_required: false/);
assert.match(finalize, /granted_capabilities: unifiedObo \? confirmed : \[\]/);
assert.match(finalize, /automation_mode: unifiedObo \? 'auto' : 'manual'/);

assert.match(compatibility, /Compatibility endpoint/);
assert.match(compatibility, /hasUnifiedOboConsent/);
assert.doesNotMatch(compatibility, /typeof allowAi|granted: allowAi|shared_with_agents: allowAi/);
assert.match(compatibility, /deprecated_per_connection_prompt: true/);

assert.doesNotMatch(page, /pendingOAuthConsent|OAuthPermissionStep|completeOAuthConnection/);
assert.match(page, /finalizeAppUserOAuthConnection/);
assert.match(page, /verifyPlatformConnection/);
assert.match(page, /publishLinkedCampaignToConnection/);
assert.match(page, /finalizeAppUserOAuthConnection[\s\S]{0,1800}verifyPlatformConnection/);
assert.match(verify, /aiAllowed && connection\.automation_mode === 'auto' && providerBacked/);

console.log('PASS: one-click OAuth campaign pairing, provider permission return, unified OBO, and live verification contracts.');