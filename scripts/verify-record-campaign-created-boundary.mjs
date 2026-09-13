import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('base44/functions/recordCampaignCreated/entry.ts', 'utf8');

assert.match(source, /req\?\.method !== 'POST'/, 'POST-only method guard missing');
assert.match(source, /Allow: 'POST'/, '405 Allow header missing');
assert.match(source, /Array\.isArray\(body\)/, 'body object guard missing');
assert.match(source, /key !== 'campaign_id'/, 'allowlisted body-key guard missing');
assert.match(source, /MAX_CAMPAIGN_ID = 128/, 'campaign id bound missing');
assert.match(source, /SAFE_ID = \/\^\[A-Za-z0-9_-\]\+\$\//, 'campaign id alphabet guard missing');
assert.match(source, /campaign lookup failure:/, 'bounded dependency diagnostic missing');
assert.match(source, /Campaign not found/, 'explicit not-found branch missing');
assert.match(source, /Only the campaign owner can publish this event\./, 'owner authorization branch missing');
assert.match(source, /campaign\.status !== 'active'/, 'inactive campaign handling missing');
assert.match(source, /await ensureCanonicalCampaign\(sr, campaign\);[\s\S]*await emitActivityEvent/, 'canonical registration must precede public event');
assert.match(source, /canonical backend could not be updated/, 'safe top-level failure copy missing');
assert.doesNotMatch(source, /console\.error\([^\n]*error\)/, 'raw error object appears to be logged');

assert.match(source, /const body = await req\.json\(\);/, 'request JSON parsing path missing');
assert.match(source, /try \{[\s\S]*const body = await req\.json\(\);[\s\S]*\} catch \(error\)/, 'top-level request/provider catch boundary missing');
assert.match(source, /catch \(dependencyError\) \{[\s\S]*diagnosticType\(dependencyError\)[\s\S]*return jsonError\('Unable to load campaign\.', 503\)/, 'campaign lookup failure must fail closed with bounded diagnostics');
assert.match(source, /base44\.auth\.me\(\)/, 'authenticated caller binding path missing');
assert.match(source, /campaign\.created_by_id !== user\.id && user\.role !== 'admin'/, 'owner/admin authorization must remain explicit');
assert.doesNotMatch(source, /return jsonError\([^\n]*(?:error|message|stack)/, 'raw exception data appears to be returned');

const diagnostics = new vm.Script(`(${source.match(/function diagnosticType\(value\) \{[\s\S]*?\n\}/)?.[0]})`).runInNewContext({ Error });
assert.equal(diagnostics(new Error('secret')), 'error');
assert.equal(diagnostics('secret'), 'string');
assert.equal(diagnostics(null), 'null');
assert.equal(diagnostics({ message: 'secret' }), 'object');
assert.equal(diagnostics(Symbol('secret')), 'symbol');

console.log('recordCampaignCreated boundary verifier passed');
