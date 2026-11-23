import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';
const m=JSON.parse(fs.readFileSync('host/workflows/manifest.json'));assert.equal(m.execution,'disabled');assert.equal(m.workflows.length,17);
for(const w of m.workflows){const a=fs.readFileSync('base44/workflows/'+w.file),b=fs.readFileSync('host/workflows/source/'+w.file);assert.deepEqual(a,b);assert.equal(crypto.createHash('sha256').update(a).digest('hex'),w.sha256);}
for(const w of m.workflows){
 const source=JSON.parse(fs.readFileSync('base44/workflows/'+w.file));
 assert.deepEqual(w.trigger_config,source.trigger.config);
 assert.deepEqual(w.condition,source.trigger.condition??null);
 const steps=source.definition.do.flatMap(s=>Object.entries(s));
 assert.equal(w.steps.length,steps.length);
 for(const [i,[id,step]] of steps.entries()){
  assert.equal(w.steps[i].id,id);assert.deepEqual(w.steps[i].definition,step);
  assert.deepEqual(w.steps[i].args,step.with?.args??null);
  assert.equal(w.steps[i].wait,step.wait??step.with?.duration??null);
  assert.equal(w.steps[i].then,step.then??null);
 }
}
console.log('PASS: 17 workflow definitions preserved byte-for-byte; execution disabled');
