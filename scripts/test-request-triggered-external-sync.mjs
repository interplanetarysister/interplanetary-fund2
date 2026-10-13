import assert from 'node:assert/strict';
import {
  EXTERNAL_SYNC_RUN_TTL_MS,
  authorizeExternalSyncScope,
  beginExternalSyncRequest,
  crowdfundingConnectionEligibility,
  finishExternalSyncRequest,
  validExternalSyncRequestId,
} from '../base44/shared/externalSyncRequest.ts';
import { externalBalanceEvidenceChanged } from '../base44/shared/externalBalanceEvidence.ts';

const preservedEvidence = {
  external_total: 125.5,
  external_currency: 'USD',
  external_donor_count: 7,
  external_data_source: 'provider_verified',
  external_balance_observed_at: '2026-10-11T10:00:00.000Z',
};
assert.equal(externalBalanceEvidenceChanged({
  kind:'crowdfunding',existing:preservedEvidence,
  externalTotal:125.5,externalCurrency:'usd',externalDonorCount:7,
}),false,'unchanged dialog totals do not refresh balance evidence');
assert.equal(externalBalanceEvidenceChanged({
  kind:'crowdfunding',existing:preservedEvidence,
  externalTotal:126,externalCurrency:'USD',externalDonorCount:7,
}),true,'a normalized total change refreshes owner-reported evidence');
assert.equal(externalBalanceEvidenceChanged({
  kind:'crowdfunding',existing:preservedEvidence,
  externalTotal:125.5,externalCurrency:'USD',externalDonorCount:7,reaffirmed:true,
}),true,'explicit owner reaffirmation refreshes balance evidence');

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

function fakeService({ runs=[], claims=[], failReads=false, withMutex=true }={}) {
  let id=0;
  const metrics={upserts:0};
  if (withMutex && !claims.some((row)=>row.claim_key==='mutex:external-sync:v1')) {
    claims.push({
      id:'mutex-0',claim_key:'mutex:external-sync:v1',claim_type:'mutex',
      request_key:'mutex',request_id:'mutex',request_fingerprint:'mutex-v1',
      job_type:'external_funds',actor_user_id:'system',attempt_number:0,
      claimed_at:new Date(0).toISOString(),lock_token:'',lock_expires_at:new Date(0).toISOString(),
    });
  }
  const matches=(row,filter)=>Object.entries(filter).every(([key,value])=>row[key]===value);
  const SyncRun={
    async filter(filter){ if(failReads) throw new Error('backend'); return runs.filter((row)=>matches(row,filter)); },
    async create(data){ const row={id:`run-${++id}`,...data}; runs.push(row); return row; },
    async update(rowId,data){ const row=runs.find((item)=>item.id===rowId); if(!row) throw new Error('missing'); Object.assign(row,data); return {...row}; },
    async get(rowId){ return runs.find((item)=>item.id===rowId)||null; },
  };
  const ExternalSyncClaim={
    async filter(filter){ if(failReads) throw new Error('backend'); return claims.filter((row)=>matches(row,filter)); },
    async create(data){ const row={id:`claim-${++id}`,...data}; claims.push(row); return {...row}; },
    async updateMany(filter,update){
      const matched=claims.filter((row)=>matches(row,filter));
      for(const row of matched) {
        if(update.$set) Object.assign(row,update.$set);
        if(update.$inc) for(const [key,value] of Object.entries(update.$inc)) row[key]=Number(row[key]||0)+Number(value);
      }
      return {success:true,updated:matched.length,has_more:false};
    },
    // Mirrors Base44 semantics: upsert mutates an existing natural-key row.
    // Production claim code must never call this audit-corrupting path.
    async upsert(records){
      metrics.upserts++;
      const data=records[0];
      const prior=claims.find((row)=>row.claim_key===data.claim_key);
      if(prior){ Object.assign(prior,data); return {created:0,updated:1,records:[{...prior}]}; }
      const row={id:`claim-${++id}`,...data}; claims.push(row);
      return {created:1,updated:0,records:[{...row}]};
    },
  };
  return { sr:{entities:{SyncRun,ExternalSyncClaim}}, runs, claims, metrics };
}

const args={jobType:'external_funds',actorUserId:'u1',requestId:UUID,fingerprint:'user-scope',scope:'user',nowMs:Date.parse('2026-10-12T00:00:00.000Z')};
const concurrent=fakeService();
const [first,second]=await Promise.all([beginExternalSyncRequest(concurrent.sr,args),beginExternalSyncRequest(concurrent.sr,args)]);
assert.deepEqual([first.disposition,second.disposition].sort(),['acquired','in_progress']);
assert.equal(concurrent.claims.filter((row)=>row.claim_type==='request_attempt').length,1,'concurrent retry has one atomic request claim');
assert.equal(concurrent.claims.filter((row)=>row.claim_type==='rate_slot').length,1,'concurrent retry reuses one atomic rate slot');
assert.equal(concurrent.runs.length,1,'concurrent retry has one run');
assert.equal(concurrent.metrics.upserts,0,'claim code never calls Base44 mutating upsert');
assert.deepEqual(
  [...new Set(concurrent.claims.filter((row)=>row.claim_type!=='mutex').map((row)=>row.request_fingerprint))],
  ['user-scope'],
  'concurrent retry cannot mutate an immutable request fingerprint',
);

const bootstrap=fakeService({withMutex:false});
await assert.rejects(
  ()=>beginExternalSyncRequest(bootstrap.sr,args),
  (error)=>error.code==='backend_unavailable'&&error.status===503,
  'missing mutex bootstraps once and fails closed before provider work',
);
assert.equal(bootstrap.runs.length,0,'mutex bootstrap starts no provider job');
assert.equal(bootstrap.claims.filter((row)=>row.claim_type==='mutex').length,1);
const afterBootstrap=await beginExternalSyncRequest(bootstrap.sr,args);
assert.equal(afterBootstrap.disposition,'acquired','retry can proceed after safe mutex bootstrap');

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

const claimOnlyConflict=fakeService({claims:[{
  claim_key:`external_funds:u1:${UUID}:1`,
  claim_type:'request_attempt',
  request_key:`external_funds:u1:${UUID}`,
  request_id:UUID,
  request_fingerprint:'different-target',
  job_type:'external_funds',
  actor_user_id:'u1',
  attempt_number:1,
  claimed_at:new Date(oldTime).toISOString(),
}]});
await assert.rejects(
  ()=>beginExternalSyncRequest(claimOnlyConflict.sr,args),
  (error)=>error.code==='request_conflict'&&error.status===409,
  'a stale immutable claim must bind its request id to its original fingerprint',
);
assert.equal(claimOnlyConflict.runs.length,0,'fingerprint conflict starts no sync run or provider work');
assert.equal(claimOnlyConflict.claims.length,1,'fingerprint conflict acquires no rate slot or new request claim');

await assert.rejects(()=>beginExternalSyncRequest(fakeService({failReads:true}).sr,args),(error)=>error.code==='backend_unavailable'&&error.status===503);

const windowStart=Math.floor(args.nowMs/60000)*60000;
const limitedClaims=Array.from({length:5},(_,index)=>({
  claim_key:`rate:external_funds:u1:${windowStart}:${index}`,
  claim_type:'rate_slot',
  request_key:`external_funds:u1:old${index}`,
  request_id:`old${index}`,
  job_type:'external_funds',
  actor_user_id:'u1',
  attempt_number:0,
  claimed_at:new Date(args.nowMs).toISOString(),
  rate_window_started_at:new Date(windowStart).toISOString(),
  rate_slot:index,
}));
await assert.rejects(()=>beginExternalSyncRequest(fakeService({claims:limitedClaims}).sr,{...args,requestId:UUID2}),(error)=>error.code==='rate_limited'&&error.status===429);

const burst=fakeService();
const burstIds=Array.from({length:6},(_,index)=>`00000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`);
const burstResults=await Promise.allSettled(burstIds.map((requestId)=>
  beginExternalSyncRequest(burst.sr,{...args,requestId,fingerprint:`burst-${requestId}`})));
assert.equal(burstResults.filter((result)=>result.status==='fulfilled'&&result.value.disposition==='acquired').length,5,'five concurrent distinct requests acquire bounded jobs');
assert.equal(burstResults.filter((result)=>result.status==='rejected'&&result.reason?.code==='rate_limited'&&result.reason?.status===429).length,1,'sixth concurrent distinct request is atomically rate limited');
assert.equal(burst.runs.length,5,'atomic limiter creates only five runs');
assert.equal(burst.claims.filter((row)=>row.claim_type==='rate_slot').length,5,'atomic limiter creates only five rate slots');
assert.equal(burst.metrics.upserts,0,'six-way contention never invokes mutating upsert');
for(const row of burst.claims.filter((claim)=>claim.claim_type==='request_attempt')) {
  assert.equal(row.request_fingerprint,`burst-${row.request_id}`,'request fingerprint stays bound to its original immutable claim');
}

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