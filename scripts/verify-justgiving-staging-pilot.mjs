import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createUnclaimedPayload, createJustGivingStagingPage, validateJustGivingCreateResult,
  pageSlug, JUSTGIVING_STAGING_ENDPOINT, JUSTGIVING_UNCLAIMED_PATH } from '../base44/shared/justGivingUnclaimed.js';

const campaign = { id: 'ifund_camp_abc123zz', title: 'A verified charity fundraiser',
  story: 'Helping eligible charity volunteers with a specific project.',
  goal_amount: 1000 };
const payload = createUnclaimedPayload(campaign, {
  charity_id: '12345', activity_type: 'OtherPersonalChallenge', currency: 'GBP',
});
assert.equal(payload.charityId, 12345);
assert.equal(payload.pageShortName, pageSlug(campaign));
assert.equal(payload.pageTitle, campaign.title);
assert.equal(payload.pageStory, campaign.story);
assert.equal(payload.charityOptIn, false);
assert.equal(payload.charityFunded, false);
assert.equal(payload.targetAmount, '1000');
assert.throws(() => createUnclaimedPayload(campaign,{charity_id:0,activity_type:'OtherPersonalChallenge'}));
assert.throws(() => createUnclaimedPayload(campaign,{charity_id:123,activity_type:'something_else'}));
assert.throws(() => createUnclaimedPayload({ ...campaign, goal_amount:0 },{charity_id:123,activity_type:'Walks'}));

assert.throws(() => validateJustGivingCreateResult({pageId:7,next:{uri:'https://evil.example.com/fundraising/fake'}}));
assert.throws(() => validateJustGivingCreateResult({pageId:0,next:{uri:'https://www.justgiving.com/fundraising/page'}}));

let calls = 0;
const result = await createJustGivingStagingPage({
  appId: 'TestAppID1', payload,
  fetchFn: async (url, opts) => {
    calls++;
    assert.equal(url, JUSTGIVING_STAGING_ENDPOINT + '/TestAppID1' + JUSTGIVING_UNCLAIMED_PATH);
    assert.equal(opts.method, 'PUT');
    assert.equal(opts.redirect, 'manual');
    assert.equal(opts.headers['Content-Type'], 'application/json');
    assert.equal(JSON.parse(opts.body).charityId, 12345);
    return {status:201,json:async()=>({
      pageId:123456,next:{uri:'https://www.justgiving.com/id/staging-page'},
      signOnUrl:'https://www.justgiving.com/create-page/id/staging-page/PRIVATECLAIMTOKEN',
    })};
  },
});
assert.equal(calls, 1);
assert.equal(result.status, 'staging_created');
assert.equal(result.page_id, '123456');
assert.match(result.page_url, /^https:\/\/www\.justgiving\.com\//);
assert.match(result.claim_url, /PRIVATECLAIMTOKEN/);

let rejected = await createJustGivingStagingPage({
  appId:'TestAppID1',payload,fetchFn:async()=>({status:409}),
});
assert.equal(rejected.status,'provider_conflict');
rejected = await createJustGivingStagingPage({
  appId:'TestAppID1',payload,fetchFn:async()=>({status:403}),
});
assert.equal(rejected.status,'provider_rejected');
assert.equal(rejected.http_status,403);
await assert.rejects(()=>createJustGivingStagingPage({appId:'',payload,fetchFn:()=>{throw Error('Should not call');}}));

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const worker=read('base44/functions/justGivingStagingPilot/entry.ts');
const ui=read('src/components/distribution/JustGivingStagingPilot.jsx');
const schema=JSON.parse(read('base44/entities/ExternalCampaignPublication.jsonc'));
assert.equal(schema.name,'ExternalCampaignPublication');
assert.match(worker,/confirm_staging_creation !== true/);
assert.match(worker,/JUSTGIVING_STAGING_WRITE_ENABLED/);
assert.match(worker,/user.role !== 'admin'/);
assert.match(worker,/provider_verified_at/);
assert.doesNotMatch(worker,/Deno\.env\.get\('JUSTGIVING_PRODUCTION_WRITE_ENABLED'\)/);
assert.match(ui,/Preview staging page/);
assert.match(ui,/eligible/);
console.log('JustGiving staging adapter: documented endpoint, validation, mocked success, conflict, no unsafe production writes: PASS');
