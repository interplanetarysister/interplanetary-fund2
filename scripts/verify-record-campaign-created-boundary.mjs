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

const diagnostics = new vm.Script(`(${source.match(/function diagnosticType\(value\) \{[\s\S]*?\n\}/)?.[0]})`).runInNewContext({ Error });
assert.equal(diagnostics(new Error('secret')), 'error');
assert.equal(diagnostics('secret'), 'string');
assert.equal(diagnostics(null), 'null');
assert.equal(diagnostics({ message: 'secret' }), 'object');
assert.equal(diagnostics(Symbol('secret')), 'symbol');

const runnable = source
  .replace(/import[^;]+;\n/g, '')
  .replace('export default async function(req)', 'async function handler(req)');

function makeRuntime({ user = { id: 'u1', role: 'user' }, campaign = null, campaignError = null, ensureError = null, creator = null } = {}) {
  const events = [];
  const logs = [];
  const context = {
    Response,
    console: { error: (...args) => logs.push(args) },
    createClientFromRequest: () => ({
      auth: { me: async () => user },
      asServiceRole: {
        entities: {
          Campaign: { get: async () => campaignError ? Promise.reject(campaignError) : campaign },
          User: { get: async () => creator },
        },
      },
    }),
    ensureCanonicalCampaign: async () => {
      events.push('canonical');
      if (ensureError) throw ensureError;
    },
    emitActivityEvent: async () => { events.push('activity'); },
  };
  const script = new vm.Script(`${runnable}\nhandler;`);
  const handler = script.runInNewContext(context);
  return { handler, events, logs };
}

async function json(res) {
  return { status: res.status, body: await res.json(), allow: res.headers.get('allow') };
}

let runtime = makeRuntime();
assert.deepEqual(await json(await runtime.handler({ method: 'GET' })), { status: 405, body: { error: 'Method not allowed.' }, allow: 'POST' });

runtime = makeRuntime({ user: null });
assert.deepEqual(await json(await runtime.handler({ method: 'POST', json: async () => ({ campaign_id: 'c1' }) })), { status: 401, body: { error: 'Sign in required' }, allow: null });

runtime = makeRuntime({});
assert.deepEqual(await json(await runtime.handler({ method: 'POST', json: async () => ({ campaign_id: 'c1' }) })), { status: 404, body: { error: 'Campaign not found' }, allow: null });

runtime = makeRuntime({ campaignError: new Error('secret lookup') });
const lookupFailure = await json(await runtime.handler({ method: 'POST', json: async () => ({ campaign_id: 'c1' }) }));
assert.deepEqual(lookupFailure, { status: 503, body: { error: 'Unable to load campaign.' }, allow: null });
assert.deepEqual(runtime.logs, [['recordCampaignCreated campaign lookup failure:', 'error']]);

runtime = makeRuntime({ campaign: { id: 'c1', created_by_id: 'u2', status: 'active' } });
assert.deepEqual(await json(await runtime.handler({ method: 'POST', json: async () => ({ campaign_id: 'c1' }) })), { status: 403, body: { error: 'Only the campaign owner can publish this event.' }, allow: null });

runtime = makeRuntime({ campaign: { id: 'c1', created_by_id: 'u1', status: 'draft' } });
assert.deepEqual(await json(await runtime.handler({ method: 'POST', json: async () => ({ campaign_id: 'c1' }) })), { status: 200, body: { ok: true, skipped: true }, allow: null });
assert.deepEqual(runtime.events, []);

runtime = makeRuntime({ campaign: { id: 'c1', created_by_id: 'u1', status: 'active', title: 'T' }, creator: { full_name: 'U' } });
assert.deepEqual(await json(await runtime.handler({ method: 'POST', json: async () => ({ campaign_id: 'c1' }) })), { status: 200, body: { ok: true, canonical_registered: true }, allow: null });
assert.deepEqual(runtime.events, ['canonical', 'activity']);

runtime = makeRuntime({ campaign: { id: 'c1', created_by_id: 'u1', status: 'active', title: 'T' }, ensureError: new Error('secret ensure') });
const ensureFailure = await json(await runtime.handler({ method: 'POST', json: async () => ({ campaign_id: 'c1' }) }));
assert.deepEqual(ensureFailure, { status: 503, body: { error: 'Unable to publish campaign because the canonical backend could not be updated.' }, allow: null });
assert.deepEqual(runtime.events, ['canonical']);
assert.deepEqual(runtime.logs, [['recordCampaignCreated error:', 'error']]);

runtime = makeRuntime({ campaign: { id: 'c1', created_by_id: 'u1', status: 'active', title: 'T' } });
for (const body of [null, [], { campaign_id: 123 }, { campaign_id: 'bad id' }, { campaign_id: 'c1', extra: true }]) {
  const result = await json(await runtime.handler({ method: 'POST', json: async () => body }));
  assert.equal(result.status, 400);
}

console.log('recordCampaignCreated boundary verifier passed');
