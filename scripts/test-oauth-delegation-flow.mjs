import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../'+path, import.meta.url),'utf8');
function handler(path, sdk, env={APP_USER_CONNECTOR_GITHUB_ID:'connector123'}) {
  const js=ts.transpileModule(read(path), { compilerOptions: {module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports={};
  const require = name => {
    if(name.startsWith('npm:@base44/sdk')) return {createClientFromRequest:()=>sdk};
    if(name.endsWith('connectionVerification.ts')) return {OAUTH_ENV:{github:'APP_USER_CONNECTOR_GITHUB_ID'}};
    throw Error('unexpected import '+name);
  };
  new Function('require','exports','Deno','Response','console',js)(require,exports,{env:{get:k=>env[k]||''}},Response,console);
  return exports.default;
}
const req=data=>({json:async()=>data});
function fixture(opts={}) {
 const calls={userEdits:[],connectionUpdates:[],created:[]};
 const owner={id:'owner',role:'user', ai_obo_consent:{granted:false}};
 const current={id:'connection123',platform:'github',created_by_id:opts.otherOwner?'other':'owner',
     obo_consent:{granted:false,provider_capabilities:['read:user','repo']},history:[]};
 const sr={entities:{PlatformConnection:{
  get:async()=>current,
  update:async(id,patch)=>{calls.connectionUpdates.push(patch);return{...current,...patch};},
 }}, connectors:{getCurrentAppUserConnection:async()=>opts.noToken?null:{accessToken:'protected-access'}}};
 const sdk={auth:{me:async()=>opts.unauthorized?null:owner,updateMe:async data=>{calls.userEdits.push(data);}},
  entities:{PlatformConnection:{get:async()=>opts.notFound?null:current,filter:async()=>[],create:async patch=>{calls.created.push(patch);return{id:'new',...patch};}}},
  asServiceRole:sr};
 return{sdk,calls,owner,current};
}
{
 const x=fixture();const fn=handler('base44/functions/completeOAuthConnection/entry.ts',x.sdk);
 const res=await fn(req({connection_id:'connection123',allow_ai:true}));
 assert.equal(res.status,200);
 assert.equal((await res.json()).ai_authorized,true);
 assert.equal(x.calls.userEdits[0].ai_obo_consent.granted,true);
 assert.equal(x.calls.connectionUpdates[0].obo_consent.granted,true);
 assert.equal(x.calls.connectionUpdates[0].agent_access.automation_enabled,false,'must await provider check');
 assert.deepEqual(x.calls.connectionUpdates[0].obo_consent.granted_capabilities,['read:user','repo'],
   'grant must never invent provider scopes');
}
{
 const x=fixture();const res=await handler('base44/functions/completeOAuthConnection/entry.ts',x.sdk)(req({connection_id:'connection123',allow_ai:false}));
 assert.equal(res.status,200);
 assert.equal(x.calls.userEdits.length,0,'declined consent cannot modify global OBO');
 assert.equal(x.calls.connectionUpdates[0].obo_consent.granted,false);
 assert.equal(x.calls.connectionUpdates[0].automation_mode,'manual');
}
{
 const x=fixture({otherOwner:true});const res=await handler('base44/functions/completeOAuthConnection/entry.ts',x.sdk)(req({connection_id:'connection123',allow_ai:true}));
 assert.equal(res.status,404);assert.equal(x.calls.userEdits.length,0);
}
{
 const x=fixture({noToken:true});const res=await handler('base44/functions/completeOAuthConnection/entry.ts',x.sdk)(req({connection_id:'connection123',allow_ai:true}));
 assert.equal(res.status,409);assert.equal(x.calls.userEdits.length,0);
}
{
 const x=fixture();const res=await handler('base44/functions/completeOAuthConnection/entry.ts',x.sdk)(req({connection_id:'connection123'}));
 assert.equal(res.status,400);assert.equal(x.calls.userEdits.length,0);
}
{
 const x=fixture({unauthorized:true});const res=await handler('base44/functions/completeOAuthConnection/entry.ts',x.sdk)(req({connection_id:'connection123',allow_ai:true}));
 assert.equal(res.status,401);
}
{
 const x=fixture();const res=await handler('base44/functions/finalizeAppUserOAuthConnection/entry.ts',x.sdk)(req({platform:'github'}));
 assert.equal(res.status,200);
 const data=await res.json();
 assert.equal(data.ai_consent_required,true);
 assert.equal(data.connected,false);
 assert.equal(data.connection.id,'new');
 assert.equal(data.connection.accessToken,undefined,'No tokens in response');
 assert.equal(x.calls.created[0].obo_consent.granted,false);
 assert.equal(x.calls.created[0].agent_access.automation_enabled,false);
}
const ui=read('src/pages/Connections.jsx');
assert.match(ui,/pendingOAuthConsent/);
assert.match(ui,/step: "consent_pending"/);
assert.match(ui,/completeOAuthConnection/);
assert.match(ui,/verifyPlatformConnection/);
assert.ok(ui.indexOf('completeOAuthConnection')<ui.indexOf('const verified = await base44.functions.invoke("verifyPlatformConnection"'),
  'Grant precedes live provider verification');
const connect=read('src/components/connections/ConnectDialog.jsx');
assert.match(connect,/connectAppUser/);
assert.match(connect,/returnPath: window.location.pathname/);
assert.match(connect,/destination.protocol !== "https:"/);
assert.match(read('base44/functions/verifyPlatformConnection/entry.ts'),/aiAllowed && connection.automation_mode === 'auto' && providerBacked/);

console.log('PASS: OAuth staged login, 6 consent/denial/security scenarios, strict verification and safe return contracts.');
