import fs from 'node:fs';
import { SAFE_AUTH_ERROR, SAFE_AUTH_PAYLOAD_ERROR, SAFE_HEALTH_ERROR, SAFE_REGISTRY_ERROR, SAFE_REGISTRY_UNAVAILABLE, classifyRegistryResponse, createSingleFlight, readAdminRole } from '../src/lib/integrations-admin-contract.js';

const source = fs.readFileSync('src/pages/IntegrationsAdmin.jsx', 'utf8');
const forbidden = ['sensitive-admin-registry-error', 'provider-secret-token', 'e.message', 'error.message'];
for (const value of forbidden) {
  if (source.includes(value)) throw new Error(`raw diagnostic leaked into source: ${value}`);
}

for (const value of [SAFE_AUTH_ERROR, SAFE_AUTH_PAYLOAD_ERROR, SAFE_REGISTRY_ERROR, SAFE_REGISTRY_UNAVAILABLE, SAFE_HEALTH_ERROR]) {
  if (!value || value.length > 100) throw new Error('safe diagnostic contract is missing or unbounded');
}
if (!source.includes('requestIdRef') || !source.includes('mountedRef') || !source.includes('healthFlightRef')) {
  throw new Error('request fencing or health single-flight is missing');
}

const hostile = new Proxy({}, {
  get() { throw new Error('hostile getter should never be inspected'); },
  ownKeys() { throw new Error('hostile ownKeys should never be inspected'); },
  getOwnPropertyDescriptor() { throw new Error('hostile descriptor should never be inspected'); },
});

for (const value of [new Error('secret'), 'secret', { message: 'secret' }, null, undefined, 42, true, hostile]) {
  const result = readAdminRole(value);
  if (value === hostile && result.kind !== 'malformed') throw new Error('hostile auth payload was not rejected');
}

if (readAdminRole({ role: 'admin' }).role !== 'admin') throw new Error('admin role was not preserved');
if (classifyRegistryResponse([{ platform: 'paypal' }]).kind !== 'ok') throw new Error('valid registry was rejected');
if (classifyRegistryResponse({}).kind !== 'unavailable') throw new Error('malformed registry was accepted');
if (classifyRegistryResponse(null).kind !== 'unavailable') throw new Error('null registry was accepted');

const flight = createSingleFlight();
let calls = 0;
let release;
const gate = new Promise((resolve) => { release = resolve; });
const first = flight.run(async () => { calls += 1; await gate; return 'done'; });
const second = flight.run(async () => { calls += 1; return 'wrong'; });
if (first !== second || !flight.active) throw new Error('single-flight did not deduplicate re-entry');
release();
if ((await first) !== 'done' || calls !== 1 || flight.active) throw new Error('single-flight did not reset after success');

const failingFlight = createSingleFlight();
await failingFlight.run(async () => { throw new Error('provider secret'); }).then(
  () => { throw new Error('expected rejection'); },
  () => undefined,
);
if (failingFlight.active) throw new Error('single-flight remained stuck after failure');

console.log('IntegrationsAdmin runtime contract passed');
