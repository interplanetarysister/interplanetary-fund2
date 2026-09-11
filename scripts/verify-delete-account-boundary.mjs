import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync('base44/functions/deleteAccount/entry.ts', 'utf8');
assert.match(source, /req\.method !== ALLOWED_METHOD/);
assert.match(source, /Allow: ALLOWED_METHOD/);
assert.match(source, /JSON\.parse\(raw\)/);
assert.match(source, /Object\.keys\(parsed\)\.length > MAX_BODY_KEYS/);
assert.match(source, /diagnosticType\(/);
assert.match(source, /diagnostic_type/);
assert.match(source, /isExplicitNotFound\(/);
assert.match(source, /isExplicitDeletionRefusal\(/);
assert.match(source, /if \(!isExplicitDeletionRefusal\(delErr\)\)/);
assert.match(source, /return Response\.json\(\{ deleted: true, resumed: true \}\)/);
assert.doesNotMatch(source, /error\.message/);
assert.doesNotMatch(source, /String\(stepErr\)/);
assert.doesNotMatch(source, /String\(delErr\)/);
assert.match(source, /return Response\.json\(\{ error: SAFE_ERROR \}/);
console.log('deleteAccount boundary checks passed');
