import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const entitlement = read('base44/shared/subscriptionEntitlements.ts');
const outreach = read('base44/functions/runOutreachAgent/entry.ts');
const withdrawal = read('base44/functions/requestWithdrawal/entry.ts');
const discover = read('base44/functions/discoverFeatures/entry.ts');
const registry = read('base44/shared/integrationRegistry.ts');
const finalize = read('base44/functions/finalizeAppUserOAuthConnection/entry.ts');
const connectorPolicy = read('base44/shared/appUserConnectorPolicy.js');
const publish = read('base44/functions/publishPost/entry.ts');
const broadcast = read('base44/functions/broadcastPosts/entry.ts');
const update = read('base44/functions/postCampaignUpdate/entry.ts');
const unifiedConsent = read('base44/functions/setUnifiedOboConsent/entry.ts');
const consentCard = read('src/components/connections/AIConsentCard.jsx');

assert.match(entitlement, /user\?\.role === 'admin'/);
assert.match(entitlement, /TOP_SUBSCRIPTION_TIER = 'enterprise'/);
assert.match(outreach, /hasSubscriptionLevel\(owner, 2\)/);
assert.match(withdrawal, /effectiveSubscription\(user\)\.active/);
assert.match(discover, /effectiveSubscription\(user\)\.active/);
assert.match(registry, /connection\.obo_consent\?\.granted === true/);
assert.match(registry, /connection\.agent_access\?\.shared_with_agents === true/);
assert.match(registry, /connection\.verification_status === 'verified'/);
assert.match(finalize, /buildOAuthAuthorizationState/);
assert.match(connectorPolicy, /shared_with_agents: consentGranted/);
assert.match(connectorPolicy, /automation_enabled: false/);
assert.doesNotMatch(finalize, /automation_enabled: sharedAgentConsent/);
assert.match(publish, /assertOboGrant\([^;]+connection\)/s);
assert.match(broadcast, /assertOboGrant\([^;]+connection\)/s);
assert.match(update, /assertOboGrant\([^;]+conn\)/s);
assert.match(consentCard, /functions\.invoke\("setUnifiedOboConsent", \{ granted \}\)/);
assert.match(unifiedConsent, /Array\.isArray\(currentObo\.provider_capabilities\)/);
assert.doesNotMatch(unifiedConsent, /provider_capabilities \|\| currentObo\.granted_capabilities/);
assert.match(unifiedConsent, /automation_enabled: granted \? currentAgent\.automation_enabled === true : false/);

console.log('Unified owner authorization and fail-closed per-connection OBO contract verified.');
