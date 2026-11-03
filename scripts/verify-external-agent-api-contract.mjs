import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Gateway source contract: malformed credentials, redirects, and HTML login
// responses must never be treated as successful authenticated JSON APIs.
const worker = readFileSync(new URL('../host/gateway/worker.js',import.meta.url),'utf8');
const read = readFileSync(new URL('../base44/functions/externalAgentCampaigns/entry.ts',import.meta.url),'utf8');
const write = readFileSync(new URL('../base44/functions/externalAgentContentWrite/entry.ts',import.meta.url),'utf8');
const keys = readFileSync(new URL('../base44/functions/manageExternalAgentKeys/entry.ts',import.meta.url),'utf8');
assert.match(worker,/\/api\/v1\/agent\/campaigns/);
assert.match(worker,/\/api\/v1\/agent\/content/);
assert.equal((worker.match(/redirect:"manual"/g)||[]).length >= 2,true);
assert.equal((worker.match(/invalid API response/g)||[]).length,2);
assert.equal((worker.match(/response\.status>=300 && response\.status<400/g)||[]).length,2);
assert.equal((worker.match(/response\.headers\.get\("content-type"\)/g)||[]).length,2);
assert.match(read,/outreach_enabled:true/);
assert.match(read,/outreach_paused!==true/);
assert.match(write,/key\.scope!=='campaigns:read,content:write'/);
assert.match(write,/AuthorizationGrant\.filter/);
assert.match(write,/agent_name:key\.id/);
assert.match(write,/created_by_id/);
assert.match(keys,/SHA-256/);
assert.match(keys,/status:'revoked'/);
assert.doesNotMatch(keys,/key_hash:token/);
console.log('External agent API authorization and gateway contracts passed.');
