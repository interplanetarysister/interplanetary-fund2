import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

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
const verifyConnection = read('base44/functions/verifyPlatformConnection/entry.ts');
const register = read('src/pages/Register.jsx');
const recipeSource = read('base44/shared/platformConnectionRecipes.ts');
const continuationSource = read('base44/shared/managedConnectionContinuation.ts');
const recipeModule = await import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(
  recipeSource,
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } },
).outputText).toString('base64')}`);
const { orderedTransports, requiresRouteRediscovery } = recipeModule;
const continuationModule = await import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(
  continuationSource,
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } },
).outputText).toString('base64')}`);
const {
  managedConnectionRequestKey,
  verifiedAccountCreationTransport,
  reusableManagedDelegation,
  validateManagedRequestIdentity,
  validateManagedResume,
  completionDelegation,
} = continuationModule;

const webhookOnly = { preferred_transport: 'webhook' };
assert.deepEqual(orderedTransports(webhookOnly), ['webhook']);
assert.equal(requiresRouteRediscovery(webhookOnly), false);

const tokenOnly = { candidate_transports: ['token', 'token'] };
assert.deepEqual(orderedTransports(tokenOnly), ['token']);
assert.equal(requiresRouteRediscovery(tokenOnly), false);

const explicitPriorityOrder = {
  successful_route: 'token',
  preferred_transport: 'webhook',
  candidate_transports: ['token', 'webhook'],
};
assert.deepEqual(orderedTransports(explicitPriorityOrder), ['webhook', 'token']);

const blockedAll = { preferred_transport: 'oauth', blocked_routes: ['oauth'] };
assert.deepEqual(orderedTransports(blockedAll), []);
assert.equal(requiresRouteRediscovery(blockedAll), true);

const exhausted = { preferred_transport: 'token', discovery_state: 'exhausted' };
assert.deepEqual(orderedTransports(exhausted), ['token']);
assert.equal(requiresRouteRediscovery(exhausted), true);

const unknownTransport = { preferred_transport: 'unknown_transport' };
assert.deepEqual(orderedTransports(unknownTransport), []);
assert.equal(requiresRouteRediscovery(unknownTransport), true);

assert.deepEqual(orderedTransports({}), []);
assert.equal(requiresRouteRediscovery({}), true);

const request = {
  ownerUserId: 'owner-a', platform: 'eventbrite', action: 'create_account', campaignId: 'campaign-a', consentVersion: 'v1',
};
assert.equal(managedConnectionRequestKey(request), managedConnectionRequestKey({ ...request }));
assert.notEqual(managedConnectionRequestKey(request), managedConnectionRequestKey({ ...request, ownerUserId: 'owner-b' }));
assert.notEqual(managedConnectionRequestKey(request), managedConnectionRequestKey({ ...request, campaignId: 'campaign-b' }));

assert.equal(verifiedAccountCreationTransport({ preferred_transport: 'oauth' }, ['oauth']), null);
assert.equal(verifiedAccountCreationTransport({ status: 'proven', successful_route: 'token' }, ['token']), null);
assert.equal(verifiedAccountCreationTransport({ status: 'proven', successful_route: 'oauth' }, ['oauth']), 'oauth');

const activeRows = [
  { id: 'newer', request_key: 'rk', status: 'waiting_user', created_at: '2026-10-08T00:00:02.000Z' },
  { id: 'older', request_key: 'rk', status: 'waiting_user', created_at: '2026-10-08T00:00:01.000Z' },
  { id: 'done', request_key: 'rk', status: 'completed', created_at: '2026-10-08T00:00:00.000Z' },
];
assert.equal(reusableManagedDelegation(activeRows, 'rk').id, 'older');

const resumeDelegation = {
  id: 'delegation-a', owner_user_id: 'owner-a', request_key: 'rk', status: 'waiting_user', consent_version: 'v1',
  campaign_id: 'campaign-a', destination_agent: 'managed_connection_agent',
  continuation_state: { platform: 'eventbrite', requested_action: 'create_account', continuation_ref: 'connection-a' },
};
const validIdentity = {
  requestKey: 'rk', ownerUserId: 'owner-a', platform: 'eventbrite', action: 'create_account', campaignId: 'campaign-a', consentVersion: 'v1',
};
assert.equal(validateManagedRequestIdentity(resumeDelegation, validIdentity), null);
assert.equal(validateManagedRequestIdentity(resumeDelegation, { ...validIdentity, campaignId: 'campaign-b' }), 'campaign_mismatch');
assert.equal(validateManagedRequestIdentity(resumeDelegation, { ...validIdentity, ownerUserId: 'owner-b' }), 'owner_mismatch');
const validResume = {
  delegation: resumeDelegation, ownerUserId: 'owner-a', consentGranted: true, consentVersion: 'v1', requestKey: 'rk',
  platform: 'eventbrite', action: 'create_account',
};
assert.equal(validateManagedResume(validResume), null);
assert.equal(validateManagedResume({ ...validResume, ownerUserId: 'owner-b' }), 'owner_mismatch');
assert.equal(validateManagedResume({ ...validResume, consentGranted: false }), 'consent_revoked');
assert.equal(validateManagedResume({ ...validResume, consentVersion: 'v2' }), 'consent_mismatch');

const completionRows = [
  resumeDelegation,
  { ...resumeDelegation, id: 'delegation-b', created_at: '2026-10-08T00:00:02.000Z' },
];
assert.equal(completionDelegation(completionRows, 'delegation-b', 'connection-a', 'v1').id, 'delegation-b');
assert.equal(completionDelegation(completionRows, 'missing', 'connection-a', 'v1'), null);
assert.equal(completionDelegation(completionRows, 'delegation-b', 'connection-a', 'v2'), null);

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
assert.match(command, /orderedTransports/);
assert.match(command, /requiresRouteRediscovery\(effective, supportedTransports\)/);
assert.match(command, /candidate_transports/);
assert.match(command, /managedConnectionRequestKey/);
assert.match(command, /reusableManagedDelegation/);
assert.match(command, /validateManagedRequestIdentity/);
assert.match(command, /AgentDelegation\.upsert\(\[delegationData\], \{ key: 'request_key' \}\)/);
assert.doesNotMatch(command, /AgentDelegation\.create\(/);
assert.match(command, /if \(activeClaim\) return Response\.json\(publicDelegationResult\(activeClaim/);
assert.match(command, /\['failed', 'cancelled', 'superseded'\]\.includes/);
assert.match(command, /if \(!retryableTerminal\)/);
assert.match(command, /retry_count: priorClaim \? Number\(priorClaim\.retry_count \|\| 0\) \+ 1 : 0/);
assert.doesNotMatch(command, /status:\s*\{\s*\$in/);
assert.doesNotMatch(command, /AgentDelegation\.filter[\s\S]{0,200}\.catch/);
assert.match(command, /verifiedAccountCreationTransport/);
assert.match(command, /state: 'unsupported'/);
assert.match(command, /No account or background task was created/);
assert.doesNotMatch(command, /password|cookie|mfa_seed|recovery_code/i);

assert.doesNotMatch(recipeSource, /\.\.\.TRANSPORT_PRIORITY/);
assert.match(recipeSource, /priority\.has\(transport\)/);
assert.match(recipeSource, /executable\.length === 0/);
const resolver = read('base44/functions/resolvePlatformConnectionRecipe/entry.ts');
assert.match(resolver, /requiresRouteRediscovery\(effective,transportOrder\)/);

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
assert.match(verifyConnection, /completeManagedDelegation/);
assert.match(verifyConnection, /user\?\.ai_obo_consent\?\.granted !== true/);
assert.match(verifyConnection, /completionDelegation/);
assert.match(verifyConnection, /requestedDelegationId/);
assert.match(verifyConnection, /hasManagedConnections\(user\)/);
assert.match(verifyConnection, /Managed Connections completion requires an active eligible subscription/);
assert.doesNotMatch(verifyConnection, /status:\s*\{\s*\$in/);
assert.doesNotMatch(consent, /status:\s*\{\s*\$in/);
assert.doesNotMatch(verifyConnection, /AgentDelegation\.filter[\s\S]{0,200}\.catch/);
assert.doesNotMatch(consent, /AgentDelegation\.filter[\s\S]{0,200}\.catch/);
assert.match(finalizeOauth, /validateManagedResume/);
assert.match(finalizeOauth, /hasManagedConnections\(user\)/);
assert.match(finalizeOauth, /resume_after_subscription/);
assert.match(finalizeOauth, /resumeDelegation\?\.campaign_id/);
assert.match(finalizeOauth, /campaign_id: resumeCampaignId \|\| existing\?\.campaign_id/);
assert.match(finalizeOauth, /already linked to a different campaign/);
assert.match(finalizeOauth, /continuation_ref: saved\.id/);
assert.match(finalizeOauth, /managed_resume: Boolean\(resumeDelegation\)/);
assert.match(connectionsPage, /delegation_id: pending\.delegationId/);
assert.match(connectionsPage, /delegation_id: data\.delegation_id/);
assert.match(connectDialog, /delegationId: managedResume\?\.delegation_id/);
assert.match(consent, /if \(!granted\) \{/);
assert.match(connectionsPage, /verifyPlatformConnection/);
assert.match(register, /window\.location\.href = "\/onboarding"/);
assert.match(register, /ifund_post_onboarding_return_to/);
assert.match(onboarding, /ifund_post_onboarding_return_to/);

console.log('Managed Connections authorization and delegation contract verified.');
