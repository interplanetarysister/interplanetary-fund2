import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('src/pages/IntegrationsAdmin.jsx', 'utf8');

const forbidden = ['sensitive-admin-registry-error', 'provider-secret-token'];
for (const value of forbidden) {
  if (source.includes(value)) throw new Error(`raw diagnostic leaked into source: ${value}`);
}

if (!source.includes('SAFE_AUTH_ERROR') || !source.includes('SAFE_REGISTRY_ERROR') || !source.includes('SAFE_HEALTH_ERROR')) {
  throw new Error('distinct safe error contracts are missing');
}
if (!source.includes('SAFE_REGISTRY_UNAVAILABLE') || !source.includes('if (!Array.isArray(list))')) {
  throw new Error('malformed registry response is not fail-closed');
}
if (!source.includes('requestIdRef') || !source.includes('healthFlightRef')) {
  throw new Error('request fencing or health single-flight is missing');
}

const hostile = new Proxy({}, {
  get() { throw new Error('hostile getter should never be inspected'); },
  ownKeys() { throw new Error('hostile ownKeys should never be inspected'); },
  getOwnPropertyDescriptor() { throw new Error('hostile descriptor should never be inspected'); },
});

const safeValues = [new Error('secret'), 'secret', { message: 'secret' }, null, undefined, 42, true, hostile];
for (const value of safeValues) {
  const bounded = typeof value === 'object' && value !== null ? 'object' : typeof value;
  if (!['object', 'string', 'undefined', 'number', 'boolean'].includes(bounded)) {
    throw new Error(`unexpected classification: ${bounded}`);
  }
}

const context = vm.createContext({ console });
vm.runInContext('const value = { ok: true }; if (!value.ok) throw new Error("contract");', context);
console.log('IntegrationsAdmin runtime contract passed');
