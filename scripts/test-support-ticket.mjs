import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

let user = { id: 'owner', full_name: 'Account name', email: 'account@example.test', role: 'user', account_status: 'active' };
let rows = [], buckets = [], audits = [], calls = [];
let failLookup = false, failLimiter = false, failCreate = false, lostResponse = false, failAudit = false;
const client = { auth: { me: async () => user }, asServiceRole: { entities: {
  User: { get: async () => user },
  SupportTicket: {
    filter: async (query, sort, limit) => {
      calls.push({ query, sort, limit });
      if (failLookup) throw Error('private lookup failure');
      return rows.filter(x => x.user_id === query.user_id && x.request_id === query.request_id).slice(0, limit);
    },
    create: async data => {
      if (failCreate) throw Error('private create failure');
      const row = { ...data, id: `ticket-${rows.length + 1}` };
      rows.push(row);
      if (lostResponse) { lostResponse = false; throw Error('response lost after commit'); }
      return row;
    },
  },
  RateLimitBucket: {
    filter: async ({ key }) => { if (failLimiter) throw Error('private limiter failure'); return buckets.filter(x => x.key === key); },
    create: async data => { const row = { ...data, id: `bucket-${buckets.length}` }; buckets.push(row); return row; },
    update: async (id, data) => Object.assign(buckets.find(x => x.id === id), data),
    updateMany: async ({ id }, update) => { buckets.find(x => x.id === id).count += update.$inc.count; return { success: true, updated: 1 }; },
  },
  AuditLog: { create: async data => { if (failAudit) throw Error('private audit failure'); audits.push(data); } },
} } };
const context = vm.createContext({ Response, Date, console: { error() {} }, createClientFromRequest: () => client });
for (const file of ['accountGuard.ts', 'rateLimit.ts', 'auditLog.ts']) {
  vm.runInContext(readFileSync(`base44/shared/${file}`, 'utf8').replaceAll('export async function', 'async function'), context);
}
const source = readFileSync('base44/functions/submitSupportTicket/entry.ts', 'utf8');
const handler = vm.runInContext(source.replace(/^import .*;\n/gm, '').replace('export default async function', 'async function handle') + '\nhandle;', context);
const key = n => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const body = (n = 1) => ({ request_id: key(n), subject: '  Help\r\nplease ', message: ' My private question\u0000 ' });
const req = data => new Request('https://example.test', { method: 'POST', body: JSON.stringify(data) });
const call = async data => { const response = await handler(req(data)); return { status: response.status, body: await response.json(), headers: response.headers }; };
const expectStatus = async (data, status) => assert.equal((await call(data)).status, status);
const savedUser = user;
user = null;
await expectStatus(body(), 401);
user = { ...savedUser, account_status: 'disabled' };
await expectStatus(body(), 403);
user = { ...savedUser, account_deletion_pending: true };
await expectStatus(body(), 403);
user = savedUser;
for (const bad of [null, [], {}, { ...body(), user_id: 'victim' }, { ...body(), email: 'forged' },
  { ...body(), name: 'forged' }, { ...body(), status: 'closed' }, { ...body(), request_id: 'bad' },
  { ...body(), subject: 'x'.repeat(201) }, { ...body(), message: 'x'.repeat(10001) },
  { ...body(), message: ' \r\n\u0000 ' }, { ...body(), message: { text: 'not a string' } }]) await expectStatus(bad, 400);
assert.equal(rows.length, 0);
let result = await call(body());
assert.equal(result.status, 200);
assert.deepEqual(result.body, { success: true, ticket_id: 'ticket-1', duplicate: false });
assert.equal(rows[0].name, savedUser.full_name);
assert.equal(rows[0].email, savedUser.email);
assert.equal(rows[0].status, 'open');
assert.equal(rows[0].user_id, 'owner');
assert.equal(rows[0].subject, 'Help\nplease');
assert.equal(rows[0].message, 'My private question');
assert.equal(calls[0].limit, 2);
assert.ok(!JSON.stringify(audits).includes('My private question'));
assert.ok(!JSON.stringify(audits).includes('account@example.test'));
assert.equal(audits[0].target_id, rows[0].id);
result = await call(body());
assert.equal(result.body.duplicate, true);
assert.equal(rows.length, 1);
assert.equal(audits.length, 1);
assert.equal(buckets[0].count, 1); // retries don't consume another slot
await expectStatus({ ...body(), message: 'different payload, same intent' }, 409);
// Admin is still a requester, never allowed to create a ticket as someone else.
user = { ...savedUser, id: 'admin', role: 'admin' };
await expectStatus({ ...body(), user_id: 'owner' }, 400);
await expectStatus(body(), 200);
assert.equal(rows[1].user_id, 'admin');
user = savedUser;
failLookup = true;
result = await call(body(2));
assert.equal(result.status, 500);
assert.ok(!JSON.stringify(result.body).includes('private lookup'));
assert.equal(rows.length, 2);
failLookup = false;
failLimiter = true;
result = await call(body(2));
assert.equal(result.status, 503);
assert.equal(result.headers.get('Retry-After'), '60');
assert.equal(rows.length, 2);
// Preserve legacy fail-open behavior for callers that did not opt into the new policy.
assert.equal((await vm.runInContext('checkRateLimit', context)(client, 'legacy', 5, 3600)).allowed, true);
failLimiter = false;
failCreate = true;
await expectStatus(body(2), 500);
assert.equal(rows.length, 2);
failCreate = false;
lostResponse = true;
await expectStatus(body(2), 500);
const committedCount = rows.length;
result = await call(body(2));
assert.equal(result.body.duplicate, true);
assert.equal(rows.length, committedCount); // recover successful write with lost acknowledgement
failAudit = true;
await expectStatus(body(3), 200);
failAudit = false;
await expectStatus(body(4), 200);
result = await call(body(5));
assert.equal(result.status, 429);
assert.ok(Number(result.headers.get('Retry-After')) > 0);
// Existing intent can be acknowledged even when the new-submission limit is reached.
await expectStatus(body(2), 200);
const schema = JSON.parse(readFileSync('base44/entities/SupportTicket.jsonc', 'utf8'));
assert.equal(schema.rls.create, false);
assert.deepEqual(schema.rls.read, { $or: [{ 'data.user_id': '{{user.id}}' }, { user_condition: { role: 'admin' } }] });
assert.deepEqual(schema.rls.update, { user_condition: { role: 'admin' } });
const ui = readFileSync('src/pages/Help.jsx', 'utf8');
assert.doesNotMatch(ui, /entities\.SupportTicket\.create/);
assert.match(ui, /inFlight\.current/);
assert.match(ui, /attempt\.current/);
console.log('Support tests passed: identity, private schema, validation, sequential replay, lost acknowledgement, safe failures, audit minimization, fail-closed limiter, legacy limiter compatibility.');
console.log('Not runtime proof: hosted RLS and cross-worker concurrent uniqueness remain release gates.');
