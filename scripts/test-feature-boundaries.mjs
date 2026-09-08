import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Execute the actual handlers with an in-memory SDK boundary. These tests make
// no provider calls and do not claim to prove hosted Base44 RLS semantics.
let client;
const context = vm.createContext({ Response, console: { error() {} },
  createClientFromRequest: () => client });
const guard = readFileSync('base44/shared/accountGuard.ts', 'utf8').replaceAll('export async function', 'async function');
vm.runInContext(guard, context);
function handler(name) {
  const source = readFileSync(`base44/functions/${name}/entry.ts`, 'utf8')
    .replace(/^import .*;\n/gm, '').replace('export default async function', 'async function handle');
  return vm.runInContext(`(() => { ${source}; return handle; })()`, context);
}
const giving = handler('getMyGiving');
const inbox = handler('updateInboxState');
const req = (body) => new Request('https://example.test', { method: 'POST', body: JSON.stringify(body) });
const base = { id: 'donor', role: 'user' };
let queries = [];
client = { auth: { me: async () => base }, asServiceRole: { entities: {
  Donation: { filter: async (...args) => { queries.push(args); return [
    { id: 'd1', donor_user_id: 'donor', campaign_id: 'c1', payment_verified: true, amount: 10, stripe_session_id: 'secret' },
    { id: 'replay', donor_user_id: 'donor', campaign_id: 'c1', payment_verified: true, amount: 10 },
    { id: 'pending', donor_user_id: 'donor', campaign_id: 'c2', payment_verified: false },
    { id: 'unknown', donor_user_id: 'donor', campaign_id: 'c3' },
    { id: 'foreign', donor_user_id: 'other', campaign_id: 'private', payment_verified: true },
  ]; } },
} } };
assert.deepEqual(await (await giving(req({ projection: 'campaign_ids', donor_user_id: 'other' }))).json(), { campaign_ids: ['c1'] });
assert.equal(queries[0][0].donor_user_id, 'donor');
assert.equal(queries[0][0].payment_verified, true);
assert.equal(queries[0][2], 1000);
base.role = 'admin';
assert.deepEqual(await (await giving(req({ projection: 'campaign_ids' }))).json(), { campaign_ids: ['c1'] });
const history = await (await giving(req({}))).json();
assert.equal(history.donations.length, 2);
assert.ok(!JSON.stringify(history).includes('secret'));
assert.equal((await giving(req({ projection: 'raw' }))).status, 400);
assert.equal((await giving(req(null))).status, 400);
client.auth.me = async () => null;
assert.equal((await giving(req({}))).status, 401);
client.auth.me = async () => base;
client.asServiceRole.entities.Donation.filter = async () => { throw Error('private provider response'); };
assert.equal((await giving(req({}))).status, 500);
assert.ok(!(await (await giving(req({}))).text()).includes('private provider'));

let writes = [];
const records = { own: { id: 'own', user_id: 'donor', status: 'open' },
  other: { id: 'other', user_id: 'other', status: 'open' },
  broken: { id: 'broken', user_id: 'donor', status: 'invalid' } };
const entity = {
  get: async id => records[id] || null,
  update: async (id, fields) => { writes.push({ id, fields }); Object.assign(records[id], fields); },
  updateMany: async (query, update) => { writes.push({ query, update }); return { success: true, has_more: true }; },
};
client.asServiceRole.entities = { User: { get: async () => ({ ...base, account_status: 'active' }) }, InboxItem: entity, Notification: entity };
assert.equal((await inbox(req({ action: 'complete', id: 'other' }))).status, 404);
assert.equal((await inbox(req({ action: 'complete', id: 'missing' }))).status, 404);
assert.equal(writes.length, 0); // includes the authenticated admin case
assert.equal((await inbox(req({ action: 'complete', id: 'own', user_id: 'other' }))).status, 400);
assert.equal((await inbox(req({ action: '__proto__', id: 'own' }))).status, 400);
assert.equal((await inbox(req({ action: 'save_draft', id: 'own', draft: 'x'.repeat(5001) }))).status, 400);
assert.equal((await inbox(req({ action: 'complete', id: 'broken' }))).status, 409);
base.role = 'user';
assert.equal((await inbox(req({ action: 'complete', id: 'own' }))).status, 200);
assert.equal((await inbox(req({ action: 'complete', id: 'own' }))).status, 200);
assert.equal(writes.length, 1); // idempotent completion
assert.deepEqual(await (await inbox(req({ action: 'save_draft', id: 'own', draft: 'Hello\u0000\nworld' }))).json(), { success: true, draft: 'Hello\nworld' });
assert.equal(records.own.status, 'done'); // draft never reopens or sends
assert.equal(Object.keys(writes.at(-1).fields).join(), 'ai_draft');
assert.equal((await inbox(req({ action: 'read_notification', id: 'own' }))).status, 200);
const before = writes.length;
assert.equal((await inbox(req({ action: 'read_notification', id: 'own' }))).status, 200);
assert.equal(writes.length, before);
assert.deepEqual(await (await inbox(req({ action: 'read_all_notifications' }))).json(), { success: true, has_more: true });
assert.equal(writes.at(-1).query.user_id, 'donor');
entity.updateMany = async () => ({ success: false });
assert.equal((await inbox(req({ action: 'read_all_notifications' }))).status, 500);
entity.update = async () => { throw Error('private provider response'); };
const failed = await inbox(req({ action: 'save_draft', id: 'own', draft: 'retry' }));
assert.equal(failed.status, 500);
assert.ok(!(await failed.text()).includes('private provider'));
entity.update = async (id, fields) => Object.assign(records[id], fields);
assert.equal((await inbox(req({ action: 'save_draft', id: 'own', draft: 'retry' }))).status, 200);
client.asServiceRole.entities.User.get = async () => ({ ...base, account_status: 'disabled' });
assert.equal((await inbox(req({ action: 'complete', id: 'own' }))).status, 403);
client.auth.me = async () => null;
assert.equal((await inbox(req({ action: 'complete', id: 'own' }))).status, 401);
for (const name of ['InboxItem', 'Notification']) {
  assert.equal(JSON.parse(readFileSync(`base44/entities/${name}.jsonc`, 'utf8')).rls.update, false);
}
for (const path of ['src/pages/Notifications.jsx', 'src/components/NotificationBell.jsx', 'src/components/inbox/InboxItemCard.jsx']) {
  assert.doesNotMatch(readFileSync(path, 'utf8'), /entities\.(Notification|InboxItem)\.update/);
}

const recommendationSource = readFileSync('src/components/discover/RecommendedCampaigns.jsx', 'utf8');
const rankingSource = recommendationSource.slice(recommendationSource.indexOf('const momentum'), recommendationSource.indexOf('// A personalized'))
  .replace('export function', 'function');
const rank = vm.runInNewContext(`${rankingSource}; rankRecommendations;`);
const campaigns = [
  { id: 'a', category: 'health', status: 'active', raised_amount: 20 },
  { id: 'b', category: 'health', status: 'active', raised_amount: 20 },
  { id: 'c', category: 'animals', status: 'active', raised_amount: 30 },
  { id: 'mine', category: 'health', created_by_id: 'donor', status: 'active' },
  { id: 'supported', category: 'health', status: 'completed' },
  { id: 'invalid', status: 'draft', raised_amount: 999999 },
];
const serialize = x => JSON.parse(JSON.stringify(x));
assert.deepEqual(serialize(rank(campaigns).recs.map(c => c.id)), ['c', 'a', 'b']);
const personalized = rank(campaigns, 'donor', ['supported'], []);
assert.equal(personalized.mode, 'recommended');
assert.deepEqual(serialize(personalized.recs.map(c => c.id)), ['a', 'b', 'c']);
assert.deepEqual(serialize(rank(campaigns, 'donor', ['supported', 'supported'], [{ user_id: 'donor', campaign_id: 'supported' }])), serialize(personalized));
assert.deepEqual(serialize(rank([...campaigns].reverse(), 'donor', ['supported'])), serialize(personalized));
assert.deepEqual(serialize(rank(campaigns, 'donor', [], [{ user_id: 'other', campaign_id: 'a' }])), serialize(rank(campaigns, 'donor')));
assert.equal(rank([]).recs.length, 0);
assert.doesNotMatch(recommendationSource, /entities\.Donation|Math\.random/);
console.log('Feature boundary tests passed: giving projection, owner isolation, draft/completion replay, safe failure/retry, deterministic recommendations.');
