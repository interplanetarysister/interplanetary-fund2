import assert from 'node:assert/strict';
import {
  convergeExternalCampaignImport,
  externalCampaignImportTargetKey,
} from '../base44/functions/importExternalCampaign/importOperation.ts';

const user = { id: 'user-1' };
const connection = {
  id: 'connection-1',
  created_by_id: user.id,
  platform: 'gofundme',
  kind: 'crowdfunding',
  status: 'connected',
  verification_status: 'verified',
};
const expectedTargetKey = await externalCampaignImportTargetKey(user.id, connection.id);
const campaigns = [];
const imports = [];
let nextId = 0;
let crashAfterCampaign = true;
let campaignCreates = 0;
let importCreates = 0;
let discoveryCalls = 0;

const matches = (row, filter) =>
  Object.entries(filter).every(([key, value]) => row[key] === value);
const entity = (records) => ({
  async filter(filter) {
    return records.filter((row) => matches(row, filter)).map((row) => ({ ...row }));
  },
  async get(id) {
    const row = records.find((item) => item.id === id);
    return row ? { ...row } : null;
  },
});

const sr = {
  entities: {
    Campaign: entity(campaigns),
    ExternalCampaignImport: entity(imports),
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
    ExternalCampaignImport: {
      async create(data) {
        importCreates++;
        if (crashAfterCampaign) {
          crashAfterCampaign = false;
          throw new Error('simulated crash after Campaign.create');
        }
        const row = { id: `import-${++nextId}`, created_by_id: user.id, ...data };
        imports.push(row);
        return { ...row };
      },
    },
  },
};
const discover = async () => {
  discoveryCalls++;
  return {
    source: 'provider_public_campaign_page',
    source_url: 'https://www.gofundme.com/f/example',
    campaign: {
      title: 'Recovered fundraiser',
      summary: 'Provider summary',
      story: 'Provider story',
      category: 'other',
    },
  };
};
const input = {
  base44,
  sr,
  user,
  connection,
  incoming: { goal_amount: 500, external_campaign_id: 'provider-campaign-1' },
  requestId: '8c0b75c0-6b2d-4b14-8c0f-8c21f5df4781',
  discover,
};

await assert.rejects(
  () => convergeExternalCampaignImport(input),
  /simulated crash after Campaign\.create/,
  'a crash after campaign creation must remain recoverable',
);
assert.equal(campaigns.length, 1, 'the first attempt creates one marked draft');
assert.equal(imports.length, 0, 'the injected crash happens before the import record');
assert.equal(campaigns[0].status, 'draft');
assert.equal(
  campaigns[0].external_import_operation_key,
  expectedTargetKey,
);

const recovered = await convergeExternalCampaignImport({
  ...input,
  requestId: 'f95911e3-aaf2-48a9-bd43-2f38a265de1e',
});
assert.equal(recovered.recovered, true);
assert.equal(recovered.campaign.id, campaigns[0].id);
assert.equal(recovered.result.campaign_id, campaigns[0].id);
assert.equal(recovered.result.duplicate, true);
assert.equal(campaigns.length, 1, 'retry converges on the marked campaign');
assert.equal(imports.length, 1, 'retry creates exactly one canonical import record');
assert.equal(connection.campaign_id, campaigns[0].id, 'connection converges on the recovered campaign');
assert.equal(imports[0].owner_user_id, user.id);
assert.equal(imports[0].operation_key, expectedTargetKey);
assert.equal(imports[0].field_provenance.goal_amount.source, 'owner_supplied');
assert.equal(discoveryCalls, 1, 'recovery does not repeat provider discovery after the durable campaign marker');
assert.equal(campaignCreates, 1);
assert.equal(importCreates, 2, 'one interrupted import-record write and one successful recovery write');

const replay = await convergeExternalCampaignImport({
  ...input,
  requestId: '00000000-0000-4000-8000-000000000003',
});
assert.equal(replay.campaign.id, campaigns[0].id);
assert.equal(campaigns.length, 1);
assert.equal(imports.length, 1);
assert.equal(discoveryCalls, 1);
assert.equal(campaignCreates, 1);
assert.equal(importCreates, 2);

console.log('External campaign import crash recovery convergence passed');
