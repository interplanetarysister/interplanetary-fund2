import assert from 'node:assert/strict';
import fs from 'node:fs';

const handler = fs.readFileSync('base44/functions/wixWebhook/entry.ts', 'utf8');
const entity = fs.readFileSync('base44/entities/ExternalSyncEvent.jsonc', 'utf8');
const shared = fs.readFileSync('base44/functions/getSharedConnectorStatus/entry.ts', 'utf8');

assert.match(handler, /provider: 'wix'/);
assert.match(handler, /event_id: parsed\.eventId/);
assert.match(handler, /duplicate: true/);
assert.match(handler, /ExternalSyncEvent/);
assert.match(handler, /Webhooks are change signals, not proof that money entered IFund custody/);
assert.match(entity, /"event_id"/);
assert.match(entity, /"processed"/);
assert.match(shared, /receive platform-managed webhooks/);
console.log('Wix webhook ingestion contract passed.');
