import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('base44/functions/getAgentMailContext/entry.ts', 'utf8');
const transformed = source
  .replace(/^import[^\n]+\n/gm, '')
  .replace(/^export default /m, 'const handler = ')
  .replace(/:\s*[A-Za-z_$][A-Za-z0-9_$<>\[\]| ]*(?=\s*[,)=;])/g, '')
  .replace(/\bas const\b/g, '');

const calls = [];
const auth = { me: async () => ({ id: 'user-1' }) };
const rows = {
  registry: [{ platform: 'email', status: 'ACTIVE', authorized_agents: ['agent-1'] }],
  item: { id: 'item-1', user_id: 'user-1', platform: 'email', type: 'message', author: 'Alice', content: 'hello', link: 'https://example.test', status: 'NEW', ai_draft: null, created_date: '2026-01-01T00:00:00.000Z' },
};
const sr = {
  entities: {
    PlatformAccessRegistry: { filter: async (q) => { calls.push(['registry.filter', q]); return rows.registry; } },
    InboxItem: {
      get: async (id) => { calls.push(['item.get', id]); return id === 'item-1' ? rows.item : null; },
      filter: async (q) => { calls.push(['item.filter', q]); return [rows.item]; },
    },
  },
};
const base44 = { asServiceRole: sr };
const logs = [];
const context = {
  Response,
  console: { error: (...args) => logs.push(args) },
  createClientFromRequest: () => ({ ...base44, auth }),
  logAudit: async (_b, payload) => { calls.push(['audit', payload]); },
};
vm.createContext(context);
vm.runInContext(`${transformed}; globalThis.handler = handler;`, context);
const handler = context.handler;

const makeReq = (method = 'POST', body = {}) => ({ method, json: async () => body });

const unsupported = await handler(makeReq('GET', {}));
assert.equal(unsupported.status, 405, 'GET must be rejected');
assert.equal(unsupported.headers.get('allow'), 'POST');

const badBody = await handler(makeReq('POST', { agent_name: 'agent-1' }));
assert.equal(badBody.status, 400, 'missing user_id must be rejected');

const unauthorized = await handler(makeReq('POST', { agent_name: 'other-agent', user_id: 'user-1' }));
assert.equal(unauthorized.status, 403, 'unknown agent must be denied');

const item = await handler(makeReq('POST', { agent_name: 'agent-1', user_id: 'user-1', item_id: 'item-1' }));
assert.equal(item.status, 200);
const itemBody = await item.json();
assert.equal(itemBody.item.id, 'item-1');
assert.equal(itemBody.item.content, 'hello');
assert.equal(itemBody.item.created_date, undefined, 'single-item response must not leak header-only field');

const missing = await handler(makeReq('POST', { agent_name: 'agent-1', user_id: 'user-1', item_id: 'missing' }));
assert.equal(missing.status, 404);

const list = await handler(makeReq('POST', { agent_name: 'agent-1', user_id: 'user-1' }));
assert.equal(list.status, 200);
const listBody = await list.json();
assert.equal(Array.isArray(listBody.items), true);
assert.equal(listBody.items[0].preview, 'hello');
assert.equal(listBody.items[0].content, undefined, 'list response must not leak full body');

assert.equal(logs.length, 0, 'safe-path tests must not emit error logs');
assert.ok(calls.some(([name]) => name === 'audit'), 'audit must be emitted');
console.log('agent mail context runtime contract: PASS');
