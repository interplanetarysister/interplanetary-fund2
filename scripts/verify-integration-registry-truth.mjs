import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  mergeIntegrationStatus,
  normalizeIntegrationStatus,
} from '../base44/shared/integrationStatusPolicy.js';
import {
  BROWSER_RUN_POLICY,
  approvedBrowserTarget,
  browserReadAuthorized,
  browserRunDecision,
} from '../base44/shared/browserConnectionPolicy.js';
import {
  adminRecipeView,
  recipeTransportOrder,
  sanitizedCapability,
} from '../base44/shared/platformConnectionRecipePolicy.js';
import {
  createSettlementLock,
  parseHealthResponse,
  parseRegistryResponse,
} from '../src/lib/integrationRegistryContracts.js';

const read = (path) => fs.readFileSync(path, 'utf8');
const manage = read('base44/functions/managePlatformAccess/entry.ts');
const agentAccess = read('base44/functions/verifyAgentPlatformAccess/entry.ts');
const health = read('base44/functions/validateIntegrationHealth/entry.ts');
const worker = read('base44/functions/runBrowserConnection/entry.ts');
const save = read('base44/functions/saveConnectionCredentials/entry.ts');
const resolver = read('base44/functions/resolvePlatformConnectionRecipe/entry.ts');
const connections = read('src/pages/Connections.jsx');
const adminPage = read('src/pages/IntegrationsAdmin.jsx');
const panel = read('src/components/admin/IntegrationDetailPanel.jsx');
const outreach = read('base44/agents/outreach_agent.jsonc');

// Registry status truth: malformed, revoked, and misconfigured state cannot be
// promoted by configuration/token/admin assertions.
assert.equal(normalizeIntegrationStatus('PENDING'), 'UNKNOWN');
for (const candidate of ['MISCONFIGURED', 'REAUTH_REQUIRED', 'ACTIVE', 'DISCONNECTED', 'UNKNOWN']) {
  assert.equal(mergeIntegrationStatus('REVOKED', candidate, { providerVerified: true }), 'REVOKED');
}
assert.equal(mergeIntegrationStatus('MISCONFIGURED', 'ACTIVE', { providerVerified: true }), 'MISCONFIGURED');
assert.equal(mergeIntegrationStatus('UNKNOWN', 'DISCONNECTED'), 'UNKNOWN');
assert.equal(mergeIntegrationStatus('DISCONNECTED', 'ACTIVE'), 'UNKNOWN');
assert.match(manage, /status: entry \? normalizeIntegrationStatus\(entry\.status\) : 'DISCONNECTED'/);
assert.doesNotMatch(manage, /status: 'ACTIVE'/);
assert.match(health, /providerVerified = false/);
assert.match(health, /result\.status === 'ACTIVE' && result\.providerVerified/);
assert.doesNotMatch(agentAccess, /entry\.status \|\| 'ACTIVE'/);
assert.match(agentAccess, /normalizeIntegrationStatus\(entry\.status\)/);
assert.match(agentAccess, /authentication required/);
assert.match(agentAccess, /oboUserId !== user\.id/);
assert.doesNotMatch(agentAccess, /error:\s*error\.message/);

// Strict bounded response parsing and hostile-value containment.
const goodRow = {
  id: 'row-1', platform: 'github', purpose: '', integration_kind: 'api',
  account_identifier: '', auth_type: 'none', secret_refs: [], environment: 'production',
  authorized_agents: [], dependencies: [], reauth_instructions: '', admin_owner: '',
  status: 'ACTIVE', last_verified: '', last_successful_verification: '',
  auth_failures: 0, cleanup_flags: [],
};
assert.equal(parseRegistryResponse([goodRow])?.[0].status, 'ACTIVE');
assert.equal(parseRegistryResponse([{ ...goodRow, platform: 'x'.repeat(65) }]), null);
assert.equal(parseRegistryResponse(Array.from({ length: 201 }, () => goodRow)), null);
const hostile = new Proxy({}, { get() { throw new Error('hostile getter'); } });
assert.equal(parseRegistryResponse([hostile]), null);
assert.equal(parseHealthResponse({ ok: true, checked: 1, at: new Date().toISOString(), report: [] }), null);
assert.equal(parseHealthResponse({ ok: true, checked: 0, at: 'not-a-date', report: [] }), null);
assert.match(adminPage, /parseRegistryResponse/);
assert.match(adminPage, /parseHealthResponse/);
assert.match(panel, /parseManagementResponse/);

// Locks remain held after the visible timeout and release only when the real
// operation settles. Unmount invalidation fences all late state changes.
let settle;
const source = new Promise((resolve) => { settle = resolve; });
const lock = createSettlementLock({ timeoutMs: 5 });
const first = lock.start(() => source);
assert.ok(first);
assert.equal(lock.start(() => Promise.resolve()), null);
await assert.rejects(first.visible, /timed out/i);
assert.equal(lock.isLocked(), true);
lock.invalidate();
assert.equal(first.isCurrent(), false);
settle('late');
await first.settled;
await Promise.resolve();
assert.equal(lock.isLocked(), false);

// Browser-read authorization is narrow, same-owner, campaign-scoped, and does
// not grant automation. No metered request is possible until atomic quota and
// DNS/private-egress controls are verifiably available.
const user = { id: 'user-1' };
const campaign = { id: 'campaign-1', created_by_id: 'user-1' };
const browserConnection = {
  id: 'connection-1', created_by_id: 'user-1', campaign_id: 'campaign-1',
  kind: 'crowdfunding', platform: 'gofundme', external_url: 'https://www.gofundme.com/f/example',
  obo_consent: { granted: true, granted_capabilities: ['GET_METRICS'] },
  agent_access: { shared_with_agents: true, automation_enabled: false },
};
assert.equal(browserReadAuthorized({ user, campaign, connection: browserConnection, action: 'GET_METRICS' }), true);
assert.equal(browserReadAuthorized({ user, campaign, connection: { ...browserConnection, created_by_id: 'other' }, action: 'GET_METRICS' }), false);
assert.equal(browserReadAuthorized({ user, campaign, connection: { ...browserConnection, obo_consent: { granted: false, granted_capabilities: [] } }, action: 'GET_METRICS' }), false);
for (const url of [
  'http://www.gofundme.com/f/example',
  'https://127.0.0.1/example',
  'https://169.254.169.254/latest/meta-data',
  'https://localhost/example',
  'https://www.gofundme.com.evil.example/f/example',
  'https://user:password@www.gofundme.com/f/example',
]) assert.equal(approvedBrowserTarget('gofundme', url), false, `unsafe target accepted: ${url}`);
assert.equal(BROWSER_RUN_POLICY.maxRunsPerOwnerPerDay, 0);
assert.equal(browserRunDecision({ user, campaign, connection: browserConnection, action: 'GET_METRICS', atomicReservationAvailable: true, dnsPinningAvailable: true, privateEgressDenialProven: true }).allowed, false);
assert.doesNotMatch(worker, /fetch\s*\(/);
assert.doesNotMatch(worker, /BROWSERBASE_API_KEY/);
assert.doesNotMatch(worker, /entities\.Donation|Donation\.create|provider_verified:\s*true/);
assert.match(worker, /provider_verified: false/);
assert.match(worker, /financial_data_created: false/);
assert.match(save, /automation_enabled: existing\?\.agent_access\?\.automation_enabled === true/);
assert.doesNotMatch(save, /automation_enabled: browser_read_consent/);

// Recipe lookup is sanitized for normal users. Stale/unproven recipes have no
// route and there is no implicit browser or global transport fallback.
const fresh = { id: 'r1', status: 'proven', preferred_transport: 'oauth', fallback_transports: ['manual'], last_verified_at: new Date().toISOString() };
assert.deepEqual(recipeTransportOrder(fresh), ['oauth', 'manual']);
assert.deepEqual(recipeTransportOrder({ ...fresh, status: 'stale' }), []);
assert.deepEqual(recipeTransportOrder({ ...fresh, last_verified_at: '2020-01-01T00:00:00.000Z' }), []);
const publicView = sanitizedCapability(fresh, 'facebook', 'connect');
assert.equal(publicView.available, true);
assert.equal('worker_key' in publicView, false);
assert.equal('recipe' in publicView, false);
assert.equal(adminRecipeView({ ...fresh, status: 'probation' }, 'facebook', 'connect').transport_order.length, 0);
assert.match(resolver, /if \(result === 'success'\)/);
assert.match(resolver, /Provider evidence is required/);
assert.doesNotMatch(resolver, /TRANSPORT_PRIORITY/);
assert.doesNotMatch(resolver, /public_browser/);

// Connected counts/groups are derived only from both transport and provider
// verification. Observations remain external-only and never create donations.
assert.match(connections, /connection\.status === "connected" && connection\.verification_status === "verified"/);
assert.match(connections, /Only provider-verified connections appear here/);

// Explicitly reject the unsafe PlatformAdminSkill/Gatebreaker proposal.
for (const forbidden of ['Gatebreaker', 'simulate CAPTCHA solvers', 'bot farm', 'Geo-Location Spoofing', 'X-Admin-Role', 'Gmail OTP']) {
  assert.equal(outreach.includes(forbidden), false, `unsafe agent instruction remains: ${forbidden}`);
}

console.log('Integration registry, browser worker, and recipe truth contracts verified.');
