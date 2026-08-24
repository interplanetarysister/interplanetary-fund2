import { readFile } from 'node:fs/promises';

const path = 'base44/functions/kofiWebhook/entry.ts';
const schemaPath = 'base44/entities/PlatformConnection.jsonc';
const source = await readFile(path, 'utf8');
const schema = await readFile(schemaPath, 'utf8');

const required = [
  'function safeWebhookError()',
  'const messageId = payload.message_id;',
  'Number.isFinite(amount)',
  "processed_webhook_ids",
  "processed_webhook_ids: { $ne: messageId }",
  '$addToSet',
  'external_total: amount',
  "return Response.json({ error: safeWebhookError() }, { status: 500 });",
];

for (const token of required) {
  if (!source.includes(token)) {
    throw new Error(`Missing Ko-fi webhook safety invariant: ${token}`);
  }
}

if (!schema.includes('processed_webhook_ids')) {
  throw new Error('PlatformConnection must persist durable Ko-fi webhook claim IDs');
}

for (const pattern of [
  /return\s+Response\.json\(\{\s*error:\s*error\.message/,
  /parseFloat\(payload\.amount\)\s*\|\|\s*0/,
  /slice\(-30\).*messageId/,
]) {
  if (pattern.test(source)) {
    throw new Error(`Unsafe Ko-fi webhook pattern remains: ${pattern}`);
  }
}

if (!source.includes('supportedDonationType(payload.type)')) {
  throw new Error('Ko-fi webhook must classify supported financial event types');
}

console.log('Ko-fi webhook durable-claim contract verified.');
