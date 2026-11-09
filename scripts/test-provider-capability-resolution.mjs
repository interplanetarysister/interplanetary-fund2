import assert from 'node:assert/strict';
import { canonicalProviderId, resolveCapabilities, resolveCapabilityForPlatform } from '../base44/shared/providerCapabilities.ts';

const makeService = (rows = []) => ({
  entities: {
    FundraisingProviderCapability: {
      list: async () => rows,
    },
  },
});

assert.equal(canonicalProviderId('GoFundMe Pro'), 'gofundme');
assert.equal(canonicalProviderId('Ko-Fi'), 'kofi');
assert.equal(canonicalProviderId('Give Send Go'), 'givesendgo');

const seedOnly = await resolveCapabilities(makeService());
const gofundme = seedOnly.find((row) => row.platform === 'gofundme');
const kofi = seedOnly.find((row) => row.platform === 'kofi');
assert.ok(kofi.supported_actions.includes('webhook_events'), 'the tested Ko-fi webhook receiver remains advertised');
assert.equal(gofundme.campaign_import, true, 'implemented public-page import remains available');
assert.equal(gofundme.campaign_sync, false, 'a public-page importer is not an ongoing sync adapter');
assert.equal(gofundme.balance_read, false, 'public-page metadata does not imply balance-read support');
assert.equal(gofundme.api_transfer, false, 'public-page metadata does not imply transfer support');
assert.equal(gofundme.campaign_create_verified, false, 'no external campaign-create adapter is shipped');

const researchRow = {
  platform: 'kickstarter',
  display_name: 'Kickstarter',
  campaign_import: true,
  campaign_sync: true,
  balance_read: true,
  api_transfer: true,
  authenticated_browser: true,
  withdrawal_initiation: true,
  campaign_create_verified: true,
  campaign_create_tested_at: '2026-11-01T00:00:00.000Z',
  direct_publish_verified: true,
  publish_tested_at: '2026-11-01T00:00:00.000Z',
  implementation_status: 'implemented',
  test_status: 'passing',
  adapter_reference: 'untrusted-admin-value',
};
const withResearch = await resolveCapabilities(makeService([researchRow]));
const kickstarter = withResearch.find((row) => row.platform === 'kickstarter');
assert.equal(kickstarter.campaign_import, true, 'stored research may confirm an action with a shipped runtime adapter');
assert.equal(kickstarter.campaign_sync, false, 'stored research cannot invent an ongoing sync adapter');
assert.equal(kickstarter.balance_read, false, 'stored research cannot invent a balance reader');
assert.equal(kickstarter.api_transfer, false, 'stored research cannot invent a transfer adapter');
assert.equal(kickstarter.authenticated_browser, false, 'stored research cannot enable browser execution');
assert.equal(kickstarter.withdrawal_initiation, false, 'stored research cannot enable withdrawal initiation');
assert.equal(kickstarter.campaign_create_verified, false, 'campaign creation requires a shipped, explicitly registered runtime adapter');
assert.equal(kickstarter.direct_publish_verified, false, 'a fundraising provider record cannot invent a social publishing adapter');

const unknown = await resolveCapabilities(makeService([{
  platform: 'unregistered_provider',
  display_name: 'Unregistered Provider',
  campaign_import: true,
  campaign_sync: true,
  balance_read: true,
  api_transfer: true,
}]));
const unregistered = unknown.find((row) => row.platform === 'unregistered_provider');
assert.equal(unregistered.campaign_import, false);
assert.equal(unregistered.campaign_sync, false);
assert.equal(unregistered.balance_read, false);
assert.equal(unregistered.api_transfer, false);

const aliasLookup = await resolveCapabilityForPlatform(makeService(), 'GoFundMe Pro');
assert.equal(aliasLookup.platform, 'gofundme', 'provider aliases resolve to the canonical capability row');

const webhookResearchOnly = await resolveCapabilities(makeService([{
  platform: 'fund-razr',
  display_name: 'FundRazr',
  webhook_support: true,
  supported_actions: ['campaign_import', 'webhook_events', 'campaign_sync'],
  implementation_status: 'in_progress',
  test_status: 'untested',
}]));
const fundrazr = webhookResearchOnly.find((row) => row.platform === 'fundrazr');
assert.equal(fundrazr.campaign_sync, false);
assert.equal(fundrazr.supported_actions.includes('webhook_events'), false, 'provider webhook support alone cannot advertise an IFund receiver');

const duplicates = await resolveCapabilities(makeService([
  { platform: 'GoFundMe', display_name: 'GoFundMe A', campaign_import: true, campaign_sync: true },
  { platform: 'gofundme', display_name: 'GoFundMe B', campaign_import: true, campaign_sync: true },
]));
const conflicted = duplicates.find((row) => row.platform === 'gofundme');
assert.equal(conflicted.campaign_import, false, 'duplicate canonical rows disable executable capabilities');
assert.equal(conflicted.campaign_sync, false);
assert.deepEqual(conflicted.supported_actions, [], 'duplicate canonical provider rows advertise no executable actions');
assert.match(conflicted.notes, /Duplicate capability records detected/);

const narrowed = await resolveCapabilities(makeService([{
  platform: 'gofundme',
  display_name: 'GoFundMe',
  campaign_import: false,
  campaign_sync: false,
}]));
assert.equal(narrowed.find((row) => row.platform === 'gofundme').campaign_import, false, 'admin research can disable a runtime capability');

console.log('Provider capability resolution behavioral tests passed');
