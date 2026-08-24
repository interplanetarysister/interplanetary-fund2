import { readFile } from 'node:fs/promises';

const path = 'base44/functions/kofiWebhook/entry.ts';
const inboxSchemaPath = 'base44/entities/InboxItem.jsonc';
const connectionSchemaPath = 'base44/entities/PlatformConnection.jsonc';
const notificationSchemaPath = 'base44/entities/Notification.jsonc';
const ledgerSchemaPath = 'base44/entities/KoFiWebhookEvent.jsonc';
const source = await readFile(path, 'utf8');
const inboxSchema = await readFile(inboxSchemaPath, 'utf8');
const connectionSchema = await readFile(connectionSchemaPath, 'utf8');
const notificationSchema = await readFile(notificationSchemaPath, 'utf8');
const ledgerSchema = await readFile(ledgerSchemaPath, 'utf8');

const required = [
  'function safeWebhookError()',
  'async function ensureSideEffects',
  'async function reconcileEventLedger',
  'async function completeEventLedger',
  'async function recoverClaimedEvent',
  'async function acquireRecoveryClaim',
  'async function processClaimedEvent',
  'async function clearActiveClaim',
  'const messageId = payload.message_id;',
  'const eventId = `kofi:${messageId}`;',
  'Number.isFinite(amount)',
  'kofi_active_event_id: { $exists: false }',
  'kofi_active_event_id: eventId',
  'kofi_active_event_claimed_at: claimedAt',
  'kofi_active_event_claim_token: claimToken',
  'kofi_active_event_claim_token: recoveryToken',
  'kofi_recovery_claim_token',
  'kofi_recovery_claimed_at',
  'kofi_active_event_claimed_at: { $lt: staleBefore }',
  '$inc',
  'external_total: amount',
  'await ensureSideEffects(sr, connection, payload, amount, eventId);',
  'KoFiWebhookEvent.filter({ event_id: eventId })',
  'KoFiWebhookEvent.create({',
  'side_effects_complete: false',
  'await processClaimedEvent(',
  'return Response.json({ ok: true, duplicate: true, retry: true }, { status: 202 });',
  '$unset:',
];

for (const token of required) {
  if (!source.includes(token)) {
    throw new Error(`Missing Ko-fi webhook safety invariant: ${token}`);
  }
}

for (const [name, schema] of [
  ['PlatformConnection', connectionSchema],
  ['InboxItem', inboxSchema],
  ['Notification', notificationSchema],
  ['KoFiWebhookEvent', ledgerSchema],
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
  'kofi_active_event_id',
  'kofi_active_event_claimed_at',
  'kofi_active_event_claim_token',
  'kofi_recovery_claim_token',
  'kofi_recovery_claimed_at',
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

if (!notificationSchema.includes('"external_event_id"')) {
  throw new Error('Notification schema must retain the durable webhook event identity for recovery.');
}

for (const field of [
  'event_id',
  'provider',
  'message_id',
  'connection_id',
  'user_id',
  'amount',
  'event_type',
  'claimed_at',
  'side_effects_complete',
  'last_error',
]) {
  if (!ledgerSchema.includes(`"${field}"`)) {
    throw new Error(`KoFiWebhookEvent schema missing durable ledger field: ${field}`);
  }
}

for (const pattern of [
  /return\s+Response\.json\(\{\s*error:\s*error\.message/,
  /parseFloat\(payload\.amount\)\s*\|\|\s*0/,
  /processed_webhook_ids:\s*\{\s*\$ne:/,
  /\$addToSet:\s*\{\s*processed_webhook_ids/,
  /\$pull:\s*\{\s*processed_webhook_ids/,
]) {
  if (pattern.test(source)) {
    throw new Error(`Unsafe or retired Ko-fi webhook pattern remains: ${pattern}`);
  }
}

if (!source.includes('supportedDonationType(payload.type)')) {
  throw new Error('Ko-fi webhook must classify supported financial event types');
}

if (!source.includes('kofi_active_event_id: eventId') || !source.includes('kofi_active_event_claim_token: claimToken')) {
  throw new Error('Ko-fi financial processing must retain a durable event claim token through side-effect completion.');
}

if (!source.includes('kofi_active_event_claimed_at: { $lt: staleBefore }') || !source.includes('kofi_recovery_claimed_at: { $lt: staleBefore }')) {
  throw new Error('Ko-fi recovery must require both a bounded-stale active claim and a bounded-stale recovery claim before takeover.');
}

if (!source.includes('const RECOVERY_CLAIM_STALE_MS = 5 * 60 * 1000;')) {
  throw new Error('Ko-fi recovery stale-claim bound must remain explicit and finite.');
}

if (!source.includes('kofi_active_event_claim_token: claimToken')) {
  throw new Error('Ko-fi claim clearing must be conditional on the current owner token.');
}

console.log('Ko-fi webhook durable single-winner claim, event-ledger recovery, idempotent side-effect boundary, stale recovery ownership, and schema-preservation contract verified.');
