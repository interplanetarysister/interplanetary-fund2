import { readFile } from 'node:fs/promises';

const source = await readFile('base44/functions/kofiWebhook/entry.ts', 'utf8');
const connectionSchema = await readFile('base44/entities/PlatformConnection.jsonc', 'utf8');
const inboxSchema = await readFile('base44/entities/InboxItem.jsonc', 'utf8');
const notificationSchema = await readFile('base44/entities/Notification.jsonc', 'utf8');
const ledgerSchema = await readFile('base44/entities/KoFiWebhookEvent.jsonc', 'utf8');

const required = [
  'function safeWebhookError()',
  'async function ensureSideEffects',
  'async function ensureEventLedgerUnderClaim',
  'async function syncFinancialStateFromLedger',
  'async function applyFinancialClaim',
  'async function completeEventLedger',
  'async function recoverClaimedEvent',
  'async function acquireRecoveryClaim',
  'async function processClaimedEvent',
  'async function clearActiveClaim',
  'async function markRecoveryRequired',
  'const messageId = payload.message_id;',
  'const eventId = `kofi:${connection.id}:${messageId}`;',
  'Number.isFinite(amount)',
  'kofi_active_event_id: { $exists: false }',
  'kofi_active_event_id: eventId',
  'kofi_active_event_claimed_at: claimedAt',
  'kofi_active_event_claim_token: claimToken',
  'kofi_active_event_financial_applied: true',
  'kofi_recovery_required: true',
  'kofi_recovery_required: false',
  '$inc',
  'external_total: amount',
  'await syncFinancialStateFromLedger(sr, connection.id, eventId, claimToken, ledger);',
  'await applyFinancialClaim(sr, connection.id, eventId, claimToken, amount);',
  'await ensureSideEffects(sr, connection, payload, amount, eventId);',
  'KoFiWebhookEvent.filter({ event_id: eventId })',
  'KoFiWebhookEvent.create({',
  'financial_applied: false',
  'side_effects_complete: false',
  'await processClaimedEvent(',
  'return Response.json({ ok: true, duplicate: true, retry: true }, { status: 202 });',
  '$unset:',
];

for (const token of required) {
  if (!source.includes(token)) throw new Error(`Missing Ko-fi webhook safety invariant: ${token}`);
}

for (const [name, schema] of [
  ['PlatformConnection', connectionSchema],
  ['InboxItem', inboxSchema],
  ['Notification', notificationSchema],
  ['KoFiWebhookEvent', ledgerSchema],
]) {
  if (!schema.includes('"properties"')) throw new Error(`${name} schema is missing its properties object`);
}

for (const field of [
  'platform', 'kind', 'credentials', 'external_total', 'external_donor_count',
  'last_synced', 'last_error', 'history', 'kofi_active_event_id',
  'kofi_active_event_claimed_at', 'kofi_active_event_claim_token',
  'kofi_active_event_financial_applied', 'kofi_recovery_required',
]) {
  if (!connectionSchema.includes(`"${field}"`)) {
    throw new Error(`PlatformConnection schema lost required existing/new field: ${field}`);
  }
}

for (const retiredField of ['processed_webhook_ids', 'kofi_recovery_claim_token', 'kofi_recovery_claimed_at']) {
  if (connectionSchema.includes(`"${retiredField}"`)) {
    throw new Error(`PlatformConnection must not retain retired Ko-fi field: ${retiredField}`);
  }
}

for (const field of [
  'user_id', 'platform', 'campaign_id', 'campaign_title', 'type', 'author',
  'content', 'link', 'status', 'ai_draft', 'external_event_id',
]) {
  if (!inboxSchema.includes(`"${field}"`)) throw new Error(`InboxItem schema lost required field: ${field}`);
}

if (!notificationSchema.includes('"external_event_id"')) {
  throw new Error('Notification schema must retain the durable webhook event identity for recovery.');
}

for (const field of [
  'event_id', 'provider', 'message_id', 'connection_id', 'user_id', 'amount',
  'event_type', 'claimed_at', 'financial_applied', 'side_effects_complete', 'last_error',
]) {
  if (!ledgerSchema.includes(`"${field}"`)) throw new Error(`KoFiWebhookEvent schema missing durable ledger field: ${field}`);
}

for (const pattern of [
  /return\s+Response\.json\(\{\s*error:\s*error\.message/,
  /parseFloat\(payload\.amount\)\s*\|\|\s*0/,
  /processed_webhook_ids/,
  /kofi_recovery_claim_token/,
  /kofi_recovery_claimed_at/,
  /kofi_active_event_claimed_at:\s*\{\s*\$lt:/,
]) {
  if (pattern.test(source)) throw new Error(`Unsafe or retired Ko-fi webhook pattern remains: ${pattern}`);
}

if (!source.includes('supportedDonationType(payload.type)')) {
  throw new Error('Ko-fi webhook must classify supported financial event types');
}

const handlerStart = source.indexOf('export default async function(req)');
const handlerBody = handlerStart >= 0 ? source.slice(handlerStart) : '';
const handlerClaimIndex = handlerBody.indexOf('const claim = await sr.entities.PlatformConnection.updateMany(');
const handlerLedgerLookupIndex = handlerBody.indexOf('KoFiWebhookEvent.filter({ event_id: eventId })');
if (handlerClaimIndex < 0) throw new Error('Ko-fi webhook must acquire the connection-level claim.');
if (handlerLedgerLookupIndex < 0) throw new Error('Ko-fi webhook must reconcile the durable event ledger after claiming.');
if (handlerLedgerLookupIndex < handlerClaimIndex) {
  throw new Error('Durable event-ledger lookup must occur only after the connection-level claim is acquired.');
}

const processStart = source.indexOf('async function processClaimedEvent');
const processEnd = source.indexOf('\n}\n\nasync function recoverClaimedEvent', processStart);
const processBody = processStart >= 0 && processEnd > processStart ? source.slice(processStart, processEnd) : '';
if (!processBody.includes('ledger = await ensureEventLedgerUnderClaim')) throw new Error('Durable event ledger must be created/reconciled while the connection claim is held.');
if (!processBody.includes('await syncFinancialStateFromLedger(sr, connection.id, eventId, claimToken, ledger);')) throw new Error('Existing durable financial state must be restored before retrying a claimed event.');
if (!processBody.includes('await applyFinancialClaim(sr, connection.id, eventId, claimToken, amount);')) throw new Error('Financial application must remain inside the claimed event lifecycle.');
if (!processBody.includes('await ensureSideEffects(sr, connection, payload, amount, eventId);')) throw new Error('Downstream side effects must remain inside the claimed event lifecycle.');

const ledgerFnStart = source.indexOf('async function ensureEventLedgerUnderClaim');
const ledgerFnEnd = source.indexOf('\n}\n\nasync function syncFinancialStateFromLedger', ledgerFnStart);
const ledgerFnBody = ledgerFnStart >= 0 && ledgerFnEnd > ledgerFnStart ? source.slice(ledgerFnStart, ledgerFnEnd) : '';
if (!ledgerFnBody.includes('KoFiWebhookEvent.create({')) throw new Error('Durable provider-event ledger creation is missing.');

const ledgerCallIndex = processBody.indexOf('ledger = await ensureEventLedgerUnderClaim');
const financialApplyIndex = processBody.indexOf('await applyFinancialClaim(sr, connection.id, eventId, claimToken, amount);');
const sideEffectIndex = processBody.indexOf('await ensureSideEffects(sr, connection, payload, amount, eventId);');
if (ledgerCallIndex < 0 || financialApplyIndex < 0 || ledgerCallIndex > financialApplyIndex) throw new Error('Financial application must occur only after ledger reconciliation is invoked under the claim.');
if (sideEffectIndex < 0 || sideEffectIndex < financialApplyIndex) throw new Error('Downstream side effects must occur only after the financial application claim.');

const recoveryStart = source.indexOf('async function recoverClaimedEvent');
const recoveryEnd = source.indexOf('\n}\n\n// Live Ko-fi', recoveryStart);
const recoveryBody = recoveryStart >= 0 && recoveryEnd > recoveryStart ? source.slice(recoveryStart, recoveryEnd) : '';
if (!recoveryBody.includes('const recoveryToken = await acquireRecoveryClaim')) throw new Error('Recovery must acquire an explicit recovery marker before takeover.');
if (!recoveryBody.includes('throw new Error(\'Ko-fi event recovery is not explicitly available yet. Retry later.\');')) throw new Error('Recovery must fail closed when no explicit recovery marker exists.');

if (source.includes('RECOVERY_CLAIM_STALE_MS') || source.includes('staleBefore')) {
  throw new Error('Ko-fi recovery must not use a time-only lease takeover.');
}

if (!source.includes('await markRecoveryRequired(sr, connection.id, eventId, claimToken);')) {
  throw new Error('Post-claim failures must explicitly mark the event for later recovery.');
}

if (!source.includes('kofi_recovery_required: true') || !source.includes('kofi_recovery_required: false')) {
  throw new Error('Ko-fi recovery ownership must be explicitly transferred through the recovery-required marker.');
}

if (!source.includes('The connection-level active-event claim is the')) {
  throw new Error('Ko-fi source must document the connection-level claim as the authoritative single-winner boundary.');
}

console.log('Ko-fi webhook claim-before-ledger lifecycle, durable event ledger, explicit recovery ownership, safe errors, financial completion marker, idempotent side-effect identity, and schema-preservation contract verified.');
