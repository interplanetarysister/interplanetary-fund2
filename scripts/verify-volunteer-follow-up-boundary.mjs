import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../base44/functions/volunteerFollowUp/entry.ts', import.meta.url), 'utf8');

for (const token of [
  "req?.method !== 'POST'",
  "Object.keys(body).some((key) => key !== 'signup_id')",
  'function normalizeId',
  'function safeEmail',
  'function diagnosticType',
  'function isNotFoundError',
  'diagnostic_type: diagnosticType(error)',
  "'Unable to send the follow-up. Please try again.'",
]) assert.ok(source.includes(token), `missing contract: ${token}`);

assert.doesNotMatch(source, /console\.error\([^\n]*(error\.message|error\)\s*;)/);
assert.doesNotMatch(source, /Response\.json\(\{\s*error:\s*error\.message/);
assert.doesNotMatch(source, /const\s+\{\s*signup_id\s*\}\s*=\s*await\s+req\.json\(\)/);

console.log('volunteerFollowUp boundary verifier passed');
