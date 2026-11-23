import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const fn = read('base44/functions/getOwnerFinancialLedger/entry.ts');
const page = read('src/pages/FinancialLedger.jsx');
const app = read('src/App.jsx');
const layout = read('src/components/Layout.jsx');

assert.match(fn, /FinancialOperation\.filter\(\{ campaign_owner_user_id: user\.id \}/);
assert.match(fn, /HoldingLedgerEntry\.filter\(\{ beneficiary_user_id: user\.id \}/);
assert.match(fn, /Campaign\.filter\(\{ created_by_id: user\.id \}/);
assert.doesNotMatch(fn, /provider_transaction_id:/);
assert.doesNotMatch(fn, /payout_destination_ref:/);
assert.match(fn, /settled_held_available/);
assert.match(page, /getOwnerFinancialLedger/);
assert.match(page, /Only canonical financial operations and verified custody movements appear here/);
assert.match(app, /path="\/ledger" element=\{<FinancialLedger \/>\}/);
assert.match(layout, /to: "\/ledger", label: "Financial Ledger"/);

console.log('owner financial ledger contract: PASS');

// Execute the handler against isolated entity stubs: a failed read must never
// become a successful empty report, and sandbox rows must never leak into live history.
const executable = fn.replace(/^import .*;\n/gm, '').replace('export default async function(req)', 'async function handler(req)');
async function invoke(overrides = {}) {
  const entities = Object.fromEntries(['FinancialOperation', 'HoldingLedgerEntry', 'Campaign'].map(name =>
    [name, { filter: async () => overrides[name] instanceof Error ? Promise.reject(overrides[name]) : (Object.hasOwn(overrides, name) ? overrides[name] : []) }]));
  const client = { auth: { me: async () => ({id: 'owner'}) }, entities, asServiceRole: {entities} };
  const run = new Function('createClientFromRequest', 'assertActiveAccount', executable + '; return handler;');
  return run(() => client, async () => ({ok: true}))({});
}
for (const name of ['FinancialOperation', 'HoldingLedgerEntry', 'Campaign']) {
  assert.equal((await invoke({[name]: new Error('read unavailable')})).status, 500);
  assert.equal((await invoke({[name]: null})).status, 500);
}
const mixed = await (await invoke({
  FinancialOperation: [{id:'live'}, {id:'test', environment:'sandbox'}],
  HoldingLedgerEntry: [{id:'test-holding', environment:'sandbox', amount:999, direction:'in', state:'settled'}],
})).json();
assert.equal(mixed.entries.length, 1);
assert.equal(mixed.summary.financial_operations, 1);
assert.equal(mixed.summary.custody_entries, 0);
assert.equal(mixed.summary.settled_held_available, 0);
assert.equal((await invoke({Campaign: Array.from({length:1000}, (_,i)=>({id:String(i)}))})).status, 409);
console.log('owner financial ledger failure and environment isolation: PASS');
