import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const source = await fs.readFile(new URL('../base44/functions/geocodeCity/entry.ts', import.meta.url), 'utf8');
const executable = source
  .replace(/^import .*?;\n\n/s, '')
  .replace('export default async function', 'const handler = async function');

async function loadHandler({ user = { id: 'u1' }, fetchImpl }) {
  const logs = [];
  const context = {
    Response,
    AbortController,
    setTimeout,
    clearTimeout,
    console: { error: (...args) => logs.push(args) },
    fetch: fetchImpl,
    createClientFromRequest: () => ({ auth: { me: async () => user } }),
  };
  const script = new vm.Script(`(async () => { ${executable}; return handler; })()`);
  const handler = await script.runInNewContext(context);
  return { handler, logs };
}

function req(body, method = 'POST') {
  return new Request('https://example.test', {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function invoke(options, body, method) {
  const { handler, logs } = await loadHandler(options);
  const response = await handler(req(body, method));
  return { response, logs };
}

const ok = async (body) => new Response(JSON.stringify(body), { status: 200 });

{
  let captured;
  const { response } = await invoke({ fetchImpl: async (url, options) => {
    captured = { url, options };
    return ok([{ lat: '40.7128', lon: '-74.0060', display_name: 'New York, NY', unsafe_private: 'omit' }]);
  } }, { city: 'New York' });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { lat: 40.7128, lng: -74.006, display: 'New York, NY' });
  assert.match(captured.url, /^https:\/\/nominatim\.openstreetmap\.org\/search\?format=jsonv2&limit=1&q=New%20York$/);
  assert.equal(captured.options.headers['User-Agent'], 'InterplanetaryFund/1.0 (geocoding)');
  assert.ok(captured.options.signal instanceof AbortSignal);
}

{
  const { response } = await invoke({ user: null, fetchImpl: async () => ok([]) }, { city: 'New York' });
  assert.equal(response.status, 401);
}

for (const [body, expected] of [
  [{ city: '' }, 400],
  [{ city: 'x'.repeat(201) }, 400],
  [{ city: 'New York', extra: true }, 400],
  ['New York', 400],
  [[], 400],
]) {
  const { response } = await invoke({ fetchImpl: async () => ok([]) }, body);
  assert.equal(response.status, expected);
}

{
  const { response } = await invoke({ fetchImpl: async () => new Response('down', { status: 503 }) }, { city: 'New York' });
  assert.equal(response.status, 502);
}

{
  const { response } = await invoke({ fetchImpl: async () => new Response('{not-json', { status: 200 }) }, { city: 'New York' });
  assert.equal(response.status, 500);
}

for (const payload of [
  { lat: true, lon: '-74', display_name: 'x' },
  { lat: [], lon: '-74', display_name: 'x' },
  { lat: '', lon: '-74', display_name: 'x' },
  { lat: '91', lon: '-74', display_name: 'x' },
  { lat: '40', lon: '-181', display_name: 'x' },
  { lat: '40', lon: '-74', display_name: 'x\u0000' },
]) {
  const { response } = await invoke({ fetchImpl: async () => ok([payload]) }, { city: 'New York' });
  assert.equal(response.status, 502);
}

{
  const { response } = await invoke({ fetchImpl: async () => ok(Array.from({ length: 6 }, () => ({ lat: '40', lon: '-74', display_name: 'x' }))) }, { city: 'New York' });
  assert.equal(response.status, 502);
}

{
  const { response } = await invoke({ fetchImpl: async () => ok([]) }, { city: 'Nowhere' });
  assert.equal(response.status, 404);
}

{
  const thrown = { secret: 'provider-secret' };
  let calls = 0;
  const { response, logs } = await invoke({ fetchImpl: async () => { calls += 1; throw thrown; } }, { city: 'New York' });
  assert.equal(response.status, 500);
  assert.equal(calls, 1);
  assert.doesNotMatch(await response.text(), /provider-secret/);
  assert.deepEqual(logs, [['geocodeCity error:', 'object']]);
}

{
  const { response } = await invoke({ fetchImpl: async (_url, options) => {
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.ok(options.signal);
    return ok([{ lat: '40', lon: '-74', display_name: 'x' }]);
  } }, { city: 'New York' });
  assert.equal(response.status, 200);
}

{
  const { response } = await invoke({ fetchImpl: async () => ok([{ lat: '40', lon: '-74', display_name: 'x' }]) }, { city: 'New York' }, 'GET');
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'POST');
}

console.log('geocodeCity runtime contract checks passed');
