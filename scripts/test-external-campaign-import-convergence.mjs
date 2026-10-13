import assert from 'node:assert/strict';
import {
  convergeExternalCampaignImport,
  externalCampaignImportTargetKey,
} from '../base44/functions/importExternalCampaign/importOperation.ts';

const matches = (row, filter) =>
  Object.entries(filter).every(([key, value]) => row[key] === value);

function makeHarness({ crashAfterCampaign = false } = {}) {
  const user = { id: 'user-1' };
  const connection = {
    id: 'connection-1',
    created_by_id: user.id,
    platform: 'gofundme',
    kind: 'crowdfunding',
    status: 'connected',
    verification_status: 'verified',
  };
  const campaigns = [{
    id: 'forged-campaign',
    created_by_id: user.id,
    title: 'Client-forged marker',
    external_import_recovery_token: 'predictable-forged-value',
    external_import_operation_key: 'campaign_import:v1:forged',
    external_import_connection_id: connection.id,
  }];
  const imports = [];
  const operations = [];
  const syncRun = {
    id: 'run-1',
    active_claim_key: 'claim-1',
    overall_status: 'in_progress',
  };
  let nextId = 0;
  let campaignCreates = 0;
  let crash = crashAfterCampaign;

  const entity = (records) => ({
    async filter(filter) {
      return records.filter((row) => matches(row, filter)).map((row) => ({ ...row }));
    },
    async get(id) {
      const row = records.find((item) => item.id === id);
      return row ? { ...row } : null;
    },
    async create(data) {
      const row = { id: `record-${++nextId}`, created_by_id: user.id, ...data };
      records.push(row);
      return { ...row };
    },
    async update(id, patch) {
      const row = records.find((item) => item.id === id);
      if (!row) throw new Error('missing record');
      Object.assign(row, patch);
      return { ...row };
    },
    async updateMany(filter, update) {
      const found = records.filter((row) => matches(row, filter));
      if (crash && update?.$set?.campaign_id) {
        crash = false;
        throw new Error('simulated crash after Campaign.create');
      }
      found.forEach((row) => Object.assign(row, update.$set));
      return { updated: found.length };
    },
  });

  const operationEntity = entity(operations);
  const syncEntity = {
    async get(id) {
      return id === syncRun.id ? { ...syncRun } : null;
    },
    async updateMany(filter, update) {
      if (!matches(syncRun, filter)) return { updated: 0 };
      Object.assign(syncRun, update.$set);
      return { updated: 1 };
    },
  };
  const campaignEntity = entity(campaigns);
  const importEntity = entity(imports);

  const sr = {
    entities: {
      SyncRun: syncEntity,
      ExternalCampaignImportOperation: operationEntity,
      Campaign: campaignEntity,
      ExternalCampaignImport: importEntity,
      PlatformConnection: {
        async get(id) {
          return id === connection.id ? { ...connection } : null;
        },
        async update(id, patch) {
          assert.equal(id, connection.id);
          Object.assign(connection, patch);
          return { ...connection };
        },
      },
    },
  };
  const base44 = {
    entities: {
      Campaign: {
        async create(data) {
          campaignCreates++;
          const row = { id: `campaign-${++nextId}`, created_by_id: user.id, ...data };
          campaigns.push(row);
          return { ...row };
        },
      },
    },
  };
  const input = {
    base44,
    sr,
    user,
    connection,
    incoming: { goal_amount: 500, external_campaign_id: 'provider-campaign-1' },
    requestId: '8c0b75c0-6b2d-4b14-8c0f-8c21f5df4781',
    requestFingerprint: JSON.stringify({ connection_id: connection.id, goal_amount: 500 }),
    run: { id: syncRun.id },
    claimKey: syncRun.active_claim_key,
  };
  return {
    user, connection, campaigns, imports, operations, syncRun, input,
    get campaignCreates() { return campaignCreates; },
  };
}

const snapshot = {
  source: 'provider_public_campaign_page',
  source_url: 'https://www.gofundme.com/f/example',
  campaign: {
    title: 'Recovered fundraiser',
    summary: 'Provider summary',
    story: 'Provider story',
    category: 'other',
  },
};

// Crash recovery uses a random capability stored only in the admin operation;
// a client-forged deterministic marker is never considered.
{
  const h = makeHarness({ crashAfterCampaign: true });
  let discoveryCalls = 0;
  const discover = async () => {
    discoveryCalls++;
    return snapshot;
  };
  await assert.rejects(
    () => convergeExternalCampaignImport({ ...h.input, discover }),
    /simulated crash after Campaign\.create/,
  );
  assert.equal(h.campaigns.length, 2);
  assert.equal(h.campaignCreates, 1);
  assert.notEqual(
    h.campaigns[1].external_import_recovery_token,
    h.campaigns[0].external_import_recovery_token,
    'a guessed client marker must not match the private operation capability',
  );
  assert.equal(h.campaigns[1].external_import_connection_id, undefined,
    'campaign/public state must not contain a raw connection id');

  h.syncRun.active_claim_key = 'claim-2';
  const recovered = await convergeExternalCampaignImport({
    ...h.input,
    requestId: 'f95911e3-aaf2-48a9-bd43-2f38a265de1e',
    claimKey: 'claim-2',
    discover,
  });
  assert.equal(recovered.recovered, true);
  assert.equal(recovered.campaign.id, h.campaigns[1].id);
  assert.equal(h.campaigns.length, 2, 'retry reuses the one legitimate draft');
  assert.equal(h.imports.length, 1);
  assert.equal(h.connection.campaign_id, h.campaigns[1].id);
  assert.equal(discoveryCalls, 1, 'durable private snapshot avoids rediscovery');
}

// A paused expired holder is rejected when it resumes after the retry has
// replaced active_claim_key; only the retry may create durable import state.
{
  const h = makeHarness();
  let releaseOld;
  let oldEntered;
  const entered = new Promise((resolve) => { oldEntered = resolve; });
  const blockedDiscover = async () => {
    oldEntered();
    await new Promise((resolve) => { releaseOld = resolve; });
    return snapshot;
  };
  const stale = convergeExternalCampaignImport({ ...h.input, discover: blockedDiscover });
  await entered;

  h.syncRun.active_claim_key = 'claim-2';
  const winner = await convergeExternalCampaignImport({
    ...h.input,
    requestId: '00000000-0000-4000-8000-000000000003',
    claimKey: 'claim-2',
    discover: async () => snapshot,
  });
  releaseOld();
  await assert.rejects(stale, (error) => error?.code === 'claim_lost');
  assert.equal(winner.campaign.id, h.connection.campaign_id);
  assert.equal(h.campaignCreates, 1);
  assert.equal(h.imports.length, 1);
  assert.equal(h.operations.length, 1);
}

const target = await externalCampaignImportTargetKey('user-1', 'connection-1');
assert.match(target, /^campaign_import:v1:[a-f0-9]{64}$/);
console.log('External campaign import private recovery and stale-claim fencing passed');
