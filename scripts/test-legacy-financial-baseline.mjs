import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('base44/shared/convexFinancial.ts', 'utf8');
assert.match(source, /function legacyConfirmed\(donation\)/);
assert.match(source, /if \(donation\.is_institutional\) \{\s*return donation\.cleared === true && donation\.payment_verified === true;/s);
assert.match(source, /return donation\.payment_verified === true;/);
assert.match(source, /if \(!donation \|\| donation\.canonical_operation_id\) return false;/);

function giftOf(donation) {
  return Number(donation.amount || donation.amount_cents / 100 || 0);
}
function legacyConfirmed(donation) {
  if (!donation || donation.canonical_operation_id) return false;
  if (donation.is_institutional) {
    return donation.cleared === true && donation.payment_verified === true;
  }
  return donation.payment_verified === true;
}
function baseline(rows) {
  const legacy = rows.filter(legacyConfirmed);
  const raised = Math.round(legacy.reduce((sum, row) => sum + giftOf(row), 0) * 100) / 100;
  const available = Math.round(legacy.filter((row) => !row.withdrawal_id).reduce((sum, row) => sum + giftOf(row), 0) * 100) / 100;
  return { count: legacy.length, raised, available };
}

const rows = [
  { id: 'n-true', amount: 10, payment_verified: true },
  { id: 'n-false', amount: 20, payment_verified: false },
  { id: 'n-undefined', amount: 30 },
  { id: 'n-null', amount: 40, payment_verified: null },
  { id: 'i-valid', amount: 50, is_institutional: true, cleared: true, payment_verified: true },
  { id: 'i-not-cleared', amount: 60, is_institutional: true, cleared: false, payment_verified: true },
  { id: 'i-unverified', amount: 70, is_institutional: true, cleared: true, payment_verified: false },
  { id: 'i-undefined', amount: 80, is_institutional: true, cleared: true },
  { id: 'canonical', amount: 90, payment_verified: true, canonical_operation_id: 'op-1' },
  { id: 'withdrawn', amount: 5, payment_verified: true, withdrawal_id: 'w-1' },
];

assert.equal(legacyConfirmed(rows[0]), true);
assert.equal(legacyConfirmed(rows[1]), false);
assert.equal(legacyConfirmed(rows[2]), false);
assert.equal(legacyConfirmed(rows[3]), false);
assert.equal(legacyConfirmed(rows[4]), true);
assert.equal(legacyConfirmed(rows[5]), false);
assert.equal(legacyConfirmed(rows[6]), false);
assert.equal(legacyConfirmed(rows[7]), false);
assert.equal(legacyConfirmed(rows[8]), false);
assert.deepEqual(baseline(rows), { count: 3, raised: 65, available: 60 });

console.log('legacy financial baseline matrix passed: true/false/undefined/null, institutional gating, canonical exclusion, totals/count/available');
