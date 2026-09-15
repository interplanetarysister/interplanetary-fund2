import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('base44/functions/communityMembership/entry.ts', 'utf8');

assert.match(source, /req\?\.method !== 'POST'/);
assert.match(source, /allow: 'POST'/);
assert.match(source, /Array\.isArray\(body\)/);
assert.match(source, /keys\.some\(\(key\) => key !== 'action' && key !== 'community_id'\)/);
assert.match(source, /action !== 'join' && action !== 'leave'/);
assert.match(source, /MAX_ID_LENGTH/);
assert.match(source, /SAFE_ID/);
assert.match(source, /dependency failure/);
assert.doesNotMatch(source, /error\.message/);
assert.doesNotMatch(source, /console\.error\([^\n]*error\)/);

console.log('communityMembership boundary verifier passed');
