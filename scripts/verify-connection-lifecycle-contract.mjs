import assert from 'node:assert/strict';
import fs from 'node:fs';

const verify = fs.readFileSync('base44/functions/verifyPlatformConnection/entry.ts', 'utf8');
const provider = fs.readFileSync('base44/shared/connectionVerification.ts', 'utf8');
const sync = fs.readFileSync('base44/functions/syncConnections/entry.ts', 'utf8');
const health = fs.readFileSync('src/lib/connectionHealth.js', 'utf8');
const disconnect = fs.readFileSync('base44/functions/disconnectPlatformConnection/entry.ts', 'utf8');
const card = fs.readFileSync('src/components/connections/ConnectionCard.jsx', 'utf8');

assert.match(verify, /getCurrentAppUserConnection/);
assert.match(provider, /com\.atproto\.server\.createSession/);
assert.match(provider, /api\/v1\/accounts\/verify_credentials/);
assert.match(verify, /verification_status: 'verified'/);
assert.match(verify, /verification_status: 'unverified'/);
assert.match(sync, /reauthorization_required/);
assert.match(sync, /Scheduled provider verification succeeded/);
assert.match(health, /verification_status === "verified"/);
assert.match(disconnect, /shared_with_agents: false/);
assert.match(disconnect, /automation_enabled: false/);
assert.match(card, /verifyPlatformConnection/);
assert.match(card, /\/>Check/);
console.log('Connection lifecycle and operational health contract verified.');
