import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hostAllowed, isPrivateAddress } from '../base44/shared/externalCampaignDiscovery.js';
import { evaluateCollectionSource, sameSettlementAllocation, WITHDRAWAL_FEE_RATE } from '../base44/shared/externalFundPolicy.js';
import { claimWithdrawalMirrors, releaseWithdrawalMirrors } from '../base44/shared/withdrawalMirrorClaims.js';

const read = (path) => fs.readFileSync(path, 'utf8');
const parse = (path) => JSON.parse(read(path));
const now = Date.parse('2026-10-03T12:00:00Z');
const verifiedConnection = {
  status: 'connected', verification_status: 'verified', external_data_source: 'provider_verified',
  external_total: 100, external_currency: 'USD', last_synced: new Date(now - 60_000).toISOString(),
};

assert.equal(hostAllowed('gofundme', 'www.gofundme.com'), true);
assert.equal(hostAllowed('gofundme', 'gofundme.com.attacker.example'), false);
for (const address of ['127.0.0.1', '10.1.2.3', '169.254.169.254', '192.0.0.1', '192.0.2.1', '192.168.1.2', '198.18.0.1', '198.51.100.1', '203.0.113.1', '::1', '::ffff:127.0.0.1', '::ffff:192.168.1.2', 'fd00::1', 'fe80::1']) {
  assert.equal(isPrivateAddress(address), true, `${address} must be private`);
}
assert.equal(isPrivateAddress('8.8.8.8'), false);
assert.equal(isPrivateAddress('2606:4700:4700::1111'), false);

const eligible = evaluateCollectionSource({ connection: verifiedConnection, adapterAvailable: true, payoutReady: true, now });
assert.equal(eligible.eligible, true);
assert.equal(eligible.estimatedPlatformFee, 3);
assert.equal(WITHDRAWAL_FEE_RATE, 0.03);
for (const connection of [
  { ...verifiedConnection, external_data_source: 'owner_reported' },
  { ...verifiedConnection, last_synced: new Date(now - 25 * 60 * 60 * 1000).toISOString() },
  { ...verifiedConnection, external_currency: '' },
]) assert.equal(evaluateCollectionSource({ connection, adapterAvailable: true, payoutReady: true, now }).eligible, false);
assert.equal(evaluateCollectionSource({ connection: verifiedConnection, adapterAvailable: false, payoutReady: true, now }).eligible, false);
assert.equal(evaluateCollectionSource({ connection: verifiedConnection, adapterAvailable: true, payoutReady: false, now }).eligible, false);

const allocation = { campaign_id: 'c1', beneficiary_user_id: 'u1', external_connection_id: 'x1', external_observation_id: 'o1', amount: 100, currency: 'USD' };
assert.equal(sameSettlementAllocation(allocation, { ...allocation }), true);
assert.equal(sameSettlementAllocation(allocation, { ...allocation, external_observation_id: 'o2' }), false);
assert.equal(sameSettlementAllocation(allocation, { ...allocation, beneficiary_user_id: 'u2' }), false);

const rollbackCalls = [];
let holdingCalls = 0;
const rollbackSr = { entities: {
  Donation: { updateMany: async (filter) => { rollbackCalls.push(['donation', filter]); } },
  HoldingLedgerEntry: { updateMany: async (filter) => {
    holdingCalls += 1;
    rollbackCalls.push(['holding', filter]);
    if (holdingCalls === 1) throw new Error('simulated holding claim failure');
  } },
} };
await assert.rejects(() => claimWithdrawalMirrors(rollbackSr, { withdrawalId: 'w1', donationIds: ['d1'], holdingIds: ['h1'] }), /simulated holding claim failure/);
assert.equal(rollbackCalls.filter(([kind]) => kind === 'donation').length, 2, 'donation claim must be rolled back');
assert.equal(rollbackCalls.filter(([kind]) => kind === 'holding').length, 2, 'holding claim must be rolled back');

const failedReleaseSr = { entities: {
  Donation: { updateMany: async () => { throw new Error('simulated release failure'); } },
  HoldingLedgerEntry: { updateMany: async () => {} },
} };
await assert.rejects(() => releaseWithdrawalMirrors(failedReleaseSr, 'w2'), /simulated release failure/);
await assert.rejects(
  () => claimWithdrawalMirrors(failedReleaseSr, { withdrawalId: 'w2', donationIds: ['d2'], holdingIds: [] }),
  (error) => error.releasePending === true,
);

const importer = read('base44/functions/importExternalCampaign/entry.ts');
const importedSync = read('base44/functions/syncImportedCampaign/entry.ts');
const discovery = read('base44/shared/externalCampaignDiscovery.js');
const prepare = read('base44/functions/prepareCollectAndWithdraw/entry.ts');
const execute = read('base44/functions/executeCollectAndWithdraw/entry.ts');
const reconciliation = read('base44/functions/reconcileExternalPayPalSettlement/entry.ts');
const withdrawal = read('base44/functions/requestWithdrawal/entry.ts');
const dialog = read('src/components/withdrawals/CollectAndWithdrawDialog.jsx');
const connectionCard = read('src/components/connections/ConnectionCard.jsx');
const createCampaign = read('src/pages/CreateCampaign.jsx');
const campaignDetail = read('src/pages/CampaignDetail.jsx');
const capabilityPolicy = read('base44/shared/providerCapabilities.ts');
const importedEntity = parse('base44/entities/ExternalCampaignImport.jsonc');
const authorizationEntity = parse('base44/entities/ExternalCollectionAuthorization.jsonc');

assert.match(discovery, /provider_discovery_transport_unavailable/);
assert.doesNotMatch(discovery, /\bfetch\s*\(/);
assert.doesNotMatch(capabilityPolicy, /campaign_import:true|campaign_sync:true/);
assert.doesNotMatch(connectionCard, /Import campaign|import_connection/);
assert.doesNotMatch(createCampaign, /import_connection|importExternalCampaign/);
assert.doesNotMatch(campaignDetail, /ImportedCampaignSync/);
assert.doesNotMatch(importer, /body\.campaign/);
assert.doesNotMatch(importedSync, /body\.campaign/);
assert.match(importer, /discoverProviderCampaign/);
assert.match(importedSync, /discoverProviderCampaign/);
for (const operation of ['create', 'update', 'delete']) {
  assert.equal(importedEntity.rls[operation]?.user_condition?.role, 'admin');
  assert.equal(authorizationEntity.rls[operation]?.user_condition?.role, 'admin');
}
assert.match(prepare, /evaluateCollectionSource/);
assert.match(prepare, /WITHDRAWAL_FEE_RATE/);
assert.match(prepare, /destination_ref/);
assert.match(execute, /hasImplementedTransferAdapter/);
assert.match(execute, /settled_amount:0/);
assert.match(reconciliation, /ExternalFundObservation\.get/);
assert.match(reconciliation, /sameSettlementAllocation/);
assert.match(reconciliation, /external_funds_settlement_conflict/);
assert.match(withdrawal, /covered_holding_entry_ids/);
assert.match(withdrawal, /verifiedExternalGross/);
assert.match(withdrawal, /claimWithdrawalMirrors/);
assert.match(withdrawal, /reservation_release_pending/);
assert.doesNotMatch(dialog, /routing started/);

console.log('External fundraising provenance, SSRF, collection, settlement, fee, and withdrawal contracts verified.');
