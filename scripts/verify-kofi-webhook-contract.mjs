import { readFile } from 'node:fs/promises';

const path = 'base44/functions/kofiWebhook/entry.ts';
const inboxSchemaPath = 'base44/entities/InboxItem.jsonc';
const connectionSchemaPath = 'base44/entities/PlatformConnection.jsonc';
const source = await readFile(path, 'utf8');
const inboxSchema = await readFile(inboxSchemaPath, 'utf8');
const connectionSchema = await readFile(connectionSchemaPath, 'utf8');

const required = [
  'function safeWebhookError()',
  'const messageId = payload.message_id;',
  'Number.isFinite(amount)',
  'processed_webhook_ids',
  'processed_webhook_ids: { $ne: messageId }',
  '$addToSet',
  'external_total: amount',
  'return Response.json({ error: safeWebhookError() }, { status: 500 });',
];

for (const token of required) {
  if (!source.includes(token)) {
    throw new Error(`Missing Ko-fi webhook safety invariant: ${token}`);
  }
}

for (const [name, schema] of [
  ['PlatformConnection', connectionSchema],
  ['InboxItem', inboxSchema],
]) {
  if (!schema.includes('"properties"')) {
    throw new Error(`${name} schema is missing its properties object`);
  }
}

for (const field of [
  'platform',
  'kind',
  'credentials',
  'external_total',
  'external_donor_count',
  'last_synced',
  'last_error',
  'history',
  'processed_webhook_ids',
]) {
  if (!connectionSchema.includes(`"${field}"`)) {
    throw new Error(`PlatformConnection schema lost required existing/new field: ${field}`);
  }
}

for (const field of [
  'user_id',
  'platform',
  'campaign_id',
  'campaign_title',
  'type',
  'author',
  'content',
  'link',
  'status',
  'ai_draft',
  'external_event_id',
]) {
  if (!inboxSchema.includes(`"${field}"`)) {
    throw new Error(`InboxItem schema lost required existing/new field: ${field}`);
  }
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

console.log('Ko-fi webhook durable-claim and schema-preservation contract verified.');
