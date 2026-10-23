import assert from 'node:assert/strict';
import worker from '../host/workforce/worker.js';
const get=(p,method='GET')=>worker.fetch(new Request('https://workforce.invalid'+p,{method}),{});
let r=await get('/health');assert.equal(r.status,200);let b=await r.json();assert.equal(b.ready,false);assert.equal(b.execution,'disabled');
for(const method of ['GET','POST']){r=await get('/v1/workforce/execute',method);assert.equal(r.status,503);b=await r.json();assert.equal(b.code,'workforce_not_ready');}
r=await get('/unknown');assert.equal(r.status,404);
console.log('PASS: workforce bootstrap health reports unready; no execution route can run');
