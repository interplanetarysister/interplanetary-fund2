import assert from 'node:assert/strict';
import {
  EXTERNAL_SYNC_RUN_TTL_MS,
  authorizeExternalSyncScope,
  beginExternalSyncRequest,
  crowdfundingConnectionEligibility,
  finishExternalSyncRequest,
  validExternalSyncRequestId,
} from '../base44/shared/externalSyncRequest.ts';

const UUID = '8c0b75c0-6b2d-4b14-8c0f-8c21f5df4781';
const UUID2 = 'f95911e3-aaf2-48a9-bd43-2f38a265de1e';
assert.equal(validExternalSyncRequestId(UUID), true);
assert.equal(validExternalSyncRequestId('scheduled'), false);
assert.equal(validExternalSyncRequestId(''), false);

assert.equal(authorizeExternalSyncScope({ actorId:'u1', actorRole:'user', scope:'campaign', campaignOwnerId:'u1' }).ok, true);
assert.equal(authorizeExternalSyncScope({ actorId:'u1', actorRole:'user', scope:'campaign', campaignOwnerId:'u2' }).reason, 'owner_required');
assert.equal(authorizeExternalSyncScope({ actorId:'a1', actorRole:'admin', scope:'campaign', campaignOwnerId:'u2' }).ok, true);
assert.equal(authorizeExternalSyncScope({ actorId:'u1', actorRole:'user', scope:'all' }).reason, 'admin_required');
assert.equal(authorizeExternalSyncScope({ actorId:'a1', actorRole:'admin', scope:'user', oboUserId:'u2' }).ok, true);

const eligible = { kind:'crowdfunding', created_by_id:'u1', status:'connected', verification_status:'verified', capability_status:'confirmed' };
assert.equal(crowdfundingConnectionEligibility(eligible,'u1').ok,true);
for (const row of [
  {...eligible,status:'disconnected'},
  {...eligible,verification_status:'unverified'},
  {...eligible,capability_status:'reauthorization_required'},
  {...eligible,fundraising_data_consent:{granted:false}},
  {...eligible,fundraising_data_consent:{granted:true,revoked_at:'2026-10-11T00:00:00.000Z'}},
  {...eligible,created_by_id:'u2'},
]) assert.equal(crowdfundingConnectionEligibility(row,'u1').ok,false);

function fakeService({ runs=[], claims=[], failReads=false }={}) {
  let id=0;
  const matches=(row,filter)=>Object.entries(filter).every(([key,value])=>row[key]===value);
  const SyncRun={
    async filter(filter){ if(failReads) throw new Error('backend'); return runs.filter((row)=>matches(row,filter)); },
    async create(data){ const row={id:`run-${++id}`,...data}; runs.push(row); return row; },
    async update(rowId,data){ const row=runs.find((item)=>item.id===rowId); if(!row) throw new Error('missing'); Object.assign(row,data); return {...row}; },
    async get(rowId){ return runs.find((item)=>item.id===rowId)||null; },
  };
  const ExternalSyncClaim={
    async filter(filter){ if(failReads) throw new Error('backend'); return claims.filter((row)=>matches(row,filter)); },
    async upsert(records){ const data=records[0]; const prior=claims.find((row)=>row.claim_key===data.claim_key); if(prior) return {created:0,records:[prior]}; const row={id:`claim-${++id}`,...data}; claims.push(row); return {created:1,records:[row]}; },
  };
  return { sr:{entities:{SyncRun,ExternalSyncClaim}}, runs, claims };
}

const args={jobType:'external_funds',actorUserId:'u1',requestId:UUID,fingerprint:'user-scope',scope:'user',nowMs:Date.parse('2026-10-12T00:00:00.000Z')};
const concurrent=fakeService();
const [first,second]=await Promise.all([beginExternalSyncRequest(concurrent.sr,args),beginExternalSyncRequest(concurrent.sr,args)]);
assert.deepEqual([first.disposition,second.disposition].sort(),['acquired','in_progress']);
assert.equal(concurrent.claims.length,1,'concurrent retry has one atomic claim');
assert.equal(concurrent.runs.length,1,'concurrent retry has one run');

await finishExternalSyncRequest(concurrent.sr,first.disposition==='acquired'?first.run:second.run,first.disposition==='acquired'?first.claimKey:second.claimKey,{overall_status:'success',result_payload:{ok:true}});
const replay=await beginExternalSyncRequest(concurrent.sr,args);
assert.equal(replay.disposition,'completed');
assert.deepEqual(replay.run.result_payload,{ok:true});

const oldTime=args.nowMs-EXTERNAL_SYNC_RUN_TTL_MS-1;
const stale=fakeService({runs:[{id:'old',request_key:`external_funds:u1:${UUID}`,request_id:UUID,request_fingerprint:'user-scope',job_type:'external_funds',initiator_user_id:'u1',started_at:new Date(oldTime).toISOString(),overall_status:'in_progress',attempt_number:1,active_claim_key:`external_funds:u1:${UUID}:1`}],claims:[{claim_key:`external_funds:u1:${UUID}:1`,request_key:`external_funds:u1:${UUID}`,request_id:UUID,job_type:'external_funds',actor_user_id:'u1',attempt_number:1,claimed_at:new Date(oldTime).toISOString()}]});
const recovered=await beginExternalSyncRequest(stale.sr,args);
assert.equal(recovered.disposition,'acquired');
assert.equal(recovered.run.attempt_number,2);
assert.match(recovered.claimKey,/:2$/);

await assert.rejects(()=>beginExternalSyncRequest(fakeService({failReads:true}).sr,args),(error)=>error.code==='backend_unavailable'&&error.status===503);

const limitedRuns=Array.from({length:5},(_,index)=>({id:`r${index}`,request_key:`external_funds:u1:old${index}`,request_id:`old${index}`,job_type:'external_funds',initiator_user_id:'u1',started_at:new Date(args.nowMs-index).toISOString(),overall_status:'success'}));
await assert.rejects(()=>beginExternalSyncRequest(fakeService({runs:limitedRuns}).sr,{...args,requestId:UUID2}),(error)=>error.code==='rate_limited'&&error.status===429);

const paths=fakeService();
const imported=await beginExternalSyncRequest(paths.sr,{...args,jobType:'campaign_import'});
const discovery=await beginExternalSyncRequest(paths.sr,{...args,jobType:'campaign_discovery'});
assert.equal(imported.disposition,'acquired');
assert.equal(discovery.disposition,'acquired');
assert.notEqual(imported.requestKey,discovery.requestKey,'discovery and import are independently bounded jobs');

const importedReplay=fakeService({runs:[{id:'imported',request_key:`imported_campaign_refresh:u1:${UUID}`,request_id:UUID,request_fingerprint:'import-1',job_type:'imported_campaign_refresh',initiator_user_id:'u1',overall_status:'success',result_payload:{ok:true,campaign_id:'c1'}}]});
const refreshed=await beginExternalSyncRequest(importedReplay.sr,{...args,jobType:'imported_campaign_refresh',fingerprint:'import-1'});
assert.equal(refreshed.disposition,'completed');
assert.equal(refreshed.run.result_payload.campaign_id,'c1');

console.log('Request-triggered external sync behavioral tests passed');