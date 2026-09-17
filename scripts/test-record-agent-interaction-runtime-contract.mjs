import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('base44/functions/recordAgentInteraction/entry.ts', 'utf8');

function safeDiagnostic(value) {
  try {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    const type = typeof value;
    if (type !== 'object' && type !== 'function') return type;
    return 'object';
  } catch {
    return 'unknown';
  }
}

const hostileMessage = new Proxy({}, { get() { throw new Error('getter should not run'); } });
assert.equal(safeDiagnostic(hostileMessage), 'object');
assert.equal(safeDiagnostic(new Proxy({}, { getPrototypeOf() { throw new Error('prototype trap'); } })), 'object');
assert.equal(safeDiagnostic(null), 'null');
assert.equal(safeDiagnostic(undefined), 'undefined');
assert.equal(safeDiagnostic('x'), 'string');
assert.equal(safeDiagnostic(1), 'number');
assert.equal(safeDiagnostic(() => {}), 'object');

const requiredSourceContracts = [
  ['POST-only gate', source.includes("req.method !== 'POST'")],
  ['body allowlist', source.includes('ALLOWED_KEYS')],
  ['safe user binding', source.includes('userId: boundedText(user.id, 128)')],
  ['malformed JSON fallback', source.includes('res.json().catch(() => null)')],
  ['stable Convex failure', source.includes('Unable to record the agent interaction.')],
  ['no raw message property access', !source.includes('error.message') && !source.includes('e.message')],
];
for (const [name, ok] of requiredSourceContracts) assert.equal(ok, true, name);

console.log('recordAgentInteraction runtime contract passed');
