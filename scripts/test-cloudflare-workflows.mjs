import assert from 'node:assert/strict';import worker from '../host/workflows/worker.js';
const call=(path,method='GET')=>worker.fetch(new Request('https://ifund.invalid'+path,{method}));
let r=await call('/health');assert.equal(r.status,200);let v=await r.json();assert.equal(v.workflow_count,17);assert.equal(v.ready,false);
r=await call('/v1/workflows/catalog');assert.equal(r.status,200);v=await r.json();assert.equal(v.workflows.length,17);
r=await call('/v1/workflows/execute','POST');assert.equal(r.status,503);v=await r.json();assert.equal(v.executed,false);
r=await call('/v1/workflows/preview?entity=CampaignUpdate&event=create');v=await r.json();
assert.equal(r.status,200);assert.equal(v.executed,false);assert.equal(v.preview,true);
assert.deepEqual(v.workflows.map(w=>w.name),['Campaign Sync on Update']);
assert.equal(v.workflows[0].steps[0].function_name,'syncConnections');
r=await call('/v1/workflows/preview?entity=CampaignUpdate&event=update');v=await r.json();assert.equal(v.workflows.length,0);
r=await call('/v1/workflows/preview?entity=Campaign&event=update');v=await r.json();
assert.deepEqual(v.workflows.map(w=>w.name),['Campaign Protocol','Feature Discovery on Completion']);
r=await call('/v1/workflows/preview?name='+encodeURIComponent('Volunteer Welcome Follow-up'));v=await r.json();
assert.equal(v.workflows[0].steps[1].wait,'P3D');
assert.equal(v.workflows[0].steps[0].then,'wait_period');
assert.deepEqual(v.workflows[0].steps[2].args,{signup_id:'${ .trigger.entity_id }'});
assert.equal(v.workflows[0].condition_evaluated,false);
r=await call('/v1/workflows/preview?name='+encodeURIComponent('IFund Reporter Daily Diary'));v=await r.json();
assert.equal(v.workflows[0].trigger_config.timezone,'America/Los_Angeles');
for(const query of ['', '?entity=Campaign', '?entity=Campaign&event=publish', '?name=Campaign%20Protocol&entity=Campaign&event=update']){
 r=await call('/v1/workflows/preview'+query);assert.equal(r.status,400);
}
r=await call('/v1/workflows/preview?name=unknown');assert.equal(r.status,404);
r=await call('/v1/workflows/preview?entity=Campaign&event=update','POST');assert.equal(r.status,503);
r=await call('/v1/workflows/readiness');v=await r.json();assert.equal(v.ready,false);assert.equal(v.results.length,17);
assert.ok(v.results.every(w=>w.eligible_for_activation===false));
assert.ok(!v.results.find(w=>w.name==='Campaign Sync on Update').reasons.some(r=>r.includes('trigger mismatch')));
let scheduledRecord;
const oldLog=console.log;
try{console.log=value=>{scheduledRecord=JSON.parse(value);};await worker.scheduled({cron:'0 * * * *'},{},{});}finally{console.log=oldLog;}
assert.equal(scheduledRecord.executed,false);
console.log('PASS: workflow catalog preserves all 17 entries; execution is disabled');
console.log('PASS: previews preserve event selection, delay, arguments, transitions and timezone; invalid selectors fail closed');
