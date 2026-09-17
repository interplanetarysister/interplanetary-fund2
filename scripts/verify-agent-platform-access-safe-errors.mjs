import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('base44/functions/verifyAgentPlatformAccess/entry.ts', 'utf8');

assert.match(source, /req\?\.method !== 'POST'/);
assert.match(source, /status: 405/);
assert.match(source, /allow: 'POST'/);
assert.match(source, /function diagnosticType/);
assert.match(source, /Object\.prototype\.toString\.call/);
assert.match(source, /diagnostic_type: diagnosticType\(error\)/);
assert.match(source, /reason: 'verification failed'/);
assert.doesNotMatch(source, /error\.message/);
assert.doesNotMatch(source, /error:\s*error/);
assert.doesNotMatch(source, /agent \"\$\{agentName\}/);
assert.match(source, /const allowedKeys = new Set/);
assert.match(source, /normalizeId\(body\.agent_name\)/);
assert.match(source, /normalizeId\(body\.platform\)/);

console.log('verify-agent-platform-access-safe-errors: PASS');
