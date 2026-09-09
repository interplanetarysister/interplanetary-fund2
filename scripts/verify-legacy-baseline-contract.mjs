import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('base44/shared/convexFinancial.ts', 'utf8');

const predicateMatches = source.match(/function legacyConfirmed\(donation\)/g) || [];
assert.equal(predicateMatches.length, 1, 'legacy confirmation predicate must have exactly one source definition');
assert.match(
  source,
  /if \(!donation \|\| donation\.canonical_operation_id\) return false;/,
  'canonical-operation rows must be excluded before legacy confirmation'
);
assert.match(
  source,
  /if \(donation\.is_institutional\) \{\s*return donation\.cleared === true && donation\.payment_verified === true;/s,
  'institutional legacy rows must require cleared and explicit payment verification'
);
assert.match(
  source,
  /return donation\.payment_verified === true;/,
  'non-institutional legacy rows must require explicit payment verification'
);
assert.match(
  source,
  /const legacy = rows\.filter\(legacyConfirmed\);/,
  'legacy baseline must use the canonical predicate rather than a parallel inline rule'
);
assert.match(
  source,
  /legacyAvailableBalance.*legacy\.filter\(\(d\) => !d\.withdrawal_id\)/s,
  'available balance must derive from the same confirmed legacy set'
);

console.log('legacy baseline contract verified: single predicate, canonical exclusion, strict payment checks, shared baseline derivation');
