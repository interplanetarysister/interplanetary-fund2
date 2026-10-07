import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');

const command = read('base44/functions/requestManagedConnectionAction/entry.ts');
const entitlements = read('base44/shared/subscriptionEntitlements.ts');
const registry = read('base44/shared/integrationRegistry.ts');
const consent = read('base44/functions/setUnifiedOboConsent/entry.ts');
const save = read('base44/functions/saveConnectionCredentials/entry.ts');
const agent = read('base44/agents/managed_connection_agent.jsonc');
const agentsPage = read('src/pages/Agents.jsx');
const plans = read('src/components/subscriptions/plans.js');
const chief = read('base44/agents/chief_of_staff.jsonc');
const automate = read('src/components/onboarding/AutomateStep.jsx');
const onboarding = read('src/pages/Onboarding.jsx');
const connectionsPage = read('src/pages/Connections.jsx');
const connectDialog = read('src/components/connections/ConnectDialog.jsx');
const connectionCard = read('src/components/connections/ConnectionCard.jsx');
const finalizeOauth = read('base44/functions/finalizeAppUserOAuthConnection/entry.ts');

assert.match(entitlements, /MANAGED_CONNECTIONS_MIN_LEVEL\s*=\s*2/);
assert.match(entitlements, /hasManagedConnections\(user/);
assert.match(command, /hasManagedConnections\(user\)/);
assert.match(command, /hasUnifiedOboConsent\(user\)/);
assert.match(command, /Managed Connections requires an eligible active subscription/);
assert.match(command, /Turn on IFund help before asking Managed Connections to act for you/);

assert.match(command, /visible\.created_by_id !== user\.id/);
assert.match(command, /connection\.created_by_id !== user\.id/);
assert.match(command, /campaign\.created_by_id !== user\.id/);
assert.match(command, /Connection and campaign do not match/);
assert.match(command, /destination_agent:\s*'managed_connection_agent'/);
assert.match(command, /consent_version:\s*consentVersion/);
assert.match(command, /if \(!consentVersion\)/);
assert.match(command, /connection\.obo_consent\?\.granted !== true/);
assert.match(command, /permission_version \|\| ''\) !== consentVersion/);
assert.match(command, /const nextStatus = waitForUser \? 'waiting_user' : 'waiting_external'/);
assert.match(command, /status:\s*nextStatus/);
assert.match(command, /verifyPlatformConnection/);
assert.match(command, /already_connected:\s*true/);
assert.match(command, /executable_now:\s*false/);
assert.doesNotMatch(command, /orderedTransports/);
assert.match(command, /const supportedTransports = rediscoveryRequired/);
assert.match(command, /effective\.preferred_transport/);
assert.match(command, /effective\.fallback_transports/);
assert.doesNotMatch(command, /password|cookie|mfa_seed|recovery_code/i);

assert.match(registry, /return user\?\.ai_obo_consent\?\.granted === true/);
assert.doesNotMatch(registry, /ai_publishing_consent.*\|\|.*ai_connection_consent/);
assert.match(consent, /consent_version:/);
assert.match(consent, /waiting_user/);
assert.match(save, /hasUnifiedOboConsent/);
assert.doesNotMatch(save, /hasAiPublishingConsent/);

assert.match(agent, /requestManagedConnectionAction/);
assert.match(agent, /Every connect, account-creation, repair, or reauthorization request MUST go through requestManagedConnectionAction/);
assert.doesNotMatch(agent, /"entity_name"\s*:\s*"PlatformConnection"/);
assert.doesNotMatch(agent, /"entity_name"\s*:\s*"AuthorizationGrant"/);
assert.doesNotMatch(agent, /"entity_name"\s*:\s*"AgentDelegation"/);

assert.match(agentsPage, /managed_connection_agent/);
assert.match(agentsPage, /minLevel:\s*2/);
assert.match(agentsPage, /visibleAgents/);
assert.match(plans, /Managed Connections/);
assert.match(chief, /Managed Connections Agent/);
assert.match(chief, /requestManagedConnectionAction/);

assert.match(automate, /Let IFund help me do things/);
assert.match(automate, /delegated_operations_enabled/);
assert.match(onboarding, /setUnifiedOboConsent/);
assert.match(onboarding, /granted: !!data\.delegated_operations_enabled/);
assert.match(connectionsPage, /requestManagedConnectionAction/);
assert.match(connectionsPage, /hasManagedConnections\(user\)/);
assert.match(connectionCard, /Let IFund repair/);
assert.match(connectDialog, /Ask IFund to help set up a new account/);
assert.doesNotMatch(connectDialog, /sharedAgentConsent/);
assert.doesNotMatch(connectionsPage, /shared_agent_consent|sharedAgentConsent/);
assert.doesNotMatch(finalizeOauth, /shared_agent_consent/);
assert.match(finalizeOauth, /user\.ai_obo_consent\?\.granted === true/);

console.log('Managed Connections authorization and delegation contract verified.');
