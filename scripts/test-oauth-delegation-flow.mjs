import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const finalize = read('base44/functions/finalizeAppUserOAuthConnection/entry.ts');
const compatibility = read('base44/functions/completeOAuthConnection/entry.ts');
const connect = read('src/components/connections/ConnectDialog.jsx');
const page = read('src/pages/Connections.jsx');
const verify = read('base44/functions/verifyPlatformConnection/entry.ts');
const readiness = read('base44/functions/getAppUserConnector/entry.ts');

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
assert.match(connect, /data\?\.can_attempt/);
assert.match(connect, /registration_unverified/);
assert.match(connect, /OAUTH_ATTEMPT_BLOCKED_STATES = new Set\(\["checking", "not_configured", "unsupported"\]\)/);
assert.match(connect, /oauthAttemptBlocked = usesProviderOAuth &&[\s\S]{0,120}oauthReadinessPlatform !== platform\.id \|\| OAUTH_ATTEMPT_BLOCKED_STATES\.has\(oauthReadiness\)/,
  'a stale readiness result from another platform must remain blocked');
assert.equal((connect.match(/blockOAuthAttempt\(\)/g) || []).length, 3,
  'direct OAuth, managed helper, and managed account setup handlers must share the readiness guard');
assert.match(connect, /disabled=\{managedBusy \|\| connecting \|\| oauthAttemptBlocked\}/,
  'the rendered helper action must honor the shared OAuth guard');
assert.match(connect, /disabled=\{connecting \|\| oauthAttemptBlocked\}/,
  'the rendered direct OAuth action must honor the shared OAuth guard');
assert.match(connect, /disabled=\{managedBusy \|\| oauthAttemptBlocked\}/,
  'the rendered managed account action must honor the shared OAuth guard');
assert.doesNotMatch(connect, /OAUTH_ATTEMPT_BLOCKED_STATES[^\n]*unavailable/,
  'a transient readiness check failure must leave retry available');
assert.doesNotMatch(connect, /data\?\.configured && data\?\.connector_id \? "ready"/);
assert.match(page, /p\.setupKind === "oauth" \? "Check setup" : "Open setup"/,
  'the chooser must not promise an OAuth connection before readiness is checked');
assert.match(page, /IFund will check its setup before offering provider sign-in/);

assert.match(readiness, /getCurrentAppUserConnection/);
assert.match(readiness, /registration_reference_present: true/);
assert.match(readiness, /registration_verified: false/);
assert.doesNotMatch(readiness, /registered: true/);
assert.match(readiness, /can_attempt: true/);
assert.match(readiness, /provider_verified: false/);
assert.match(readiness, /readiness: authorizationPresent \? 'authorization_present' : 'registration_unverified'/);
assert.doesNotMatch(readiness, /configured:\s*!!connectorId/);

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
