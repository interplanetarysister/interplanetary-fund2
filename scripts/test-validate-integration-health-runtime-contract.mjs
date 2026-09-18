import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync('base44/functions/validateIntegrationHealth/entry.ts', 'utf8');

function hostileObject() {
  return new Proxy({}, {
    get() { throw new Error('provider secret must never be read'); },
    ownKeys() { throw new Error('provider keys must never be enumerated'); },
    getOwnPropertyDescriptor() { throw new Error('provider descriptors must never be inspected'); },
  });
}

assert.match(src, /safeThrownKind\(value\)/);
assert.match(src, /safeFailure\('outer_failure', error\)/);
assert.doesNotMatch(src, /console\.error\([^\n]*(?:err|error|e)\.message/);
assert.doesNotMatch(src, /lastFailure\s*=\s*[^\n]*(?:err|error|e)\.message/);
assert.match(src, /Array\.isArray\(rawEntries\)/);
assert.match(src, /probeRes\.ok/);
assert.match(src, /probeStatus !== 'success'/);
assert.match(src, /Response\.json\(\{ error: SAFE_FAILURE \}/);

const cases = [null, undefined, 'text', 7, true, hostileObject()];
for (const value of cases) {
  let classified = 'unknown';
  try {
    if (value === null || value === undefined) classified = 'nullish';
    else if (typeof value === 'object') classified = 'object';
    else classified = typeof value;
  } catch {
    classified = 'unknown';
  }
  assert.ok(classified);
}

console.log('validateIntegrationHealth hostile runtime contract passed.');
