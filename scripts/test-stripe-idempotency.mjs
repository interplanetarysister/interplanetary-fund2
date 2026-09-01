// Static contract tests for Stripe webhook idempotency (event.id + WebhookEvent).
// No live Stripe call (a valid signature requires the secret, which is held
// out-of-band) — asserts the durable claim/release behavior from source.
import { readFileSync } from 'node:fs';

const source = readFileSync('base44/functions/stripeWebhook/entry.ts', 'utf8');

const checks = [
  ['uses the signed event.id for the dedupe key', /eventKey\s*=\s*`stripe:\$\{event\.id\}`/.test(source)],
  ['checks WebhookEvent before processing', /WebhookEvent\.filter\(\{\s*source:\s*'stripe'[^}]*event_key:\s*eventKey/.test(source)],
  ['creates a claim before side effects', /WebhookEvent\.create\(\s*\{\s*source:\s*'stripe'/.test(source)],
  ['rejects duplicates safely', /return Response\.json\(\{\s*received:\s*true,\s*duplicate:\s*true\s*\}\)/.test(source)],
  ['releases the claim on processing failure', /WebhookEvent\.delete\(claim\.id\)/.test(source)],
  ['still validates the signature', source.includes("return Response.json({ error: 'Invalid signature' }, { status: 400 });")],
  ['safe outer error (no raw exception leak)', source.includes("return Response.json({ error: 'Webhook processing failed.' }, { status: 500 });")],
  ['contribution derived from the authoritative total', /computeContribution\(total,\s*optedIn\)/.test(source)],
  ['raised_amount increments by the gift, not the total', /\$inc:\s*\{\s*raised_amount:\s*gift/.test(source)],
  ['confirms the claim via re-read (simultaneous-duplicate winner)', /WebhookEvent\.filter\(\{\s*source:\s*'stripe',\s*event_key:\s*eventKey\s*\},\s*'created_date'/.test(source)],
  ['loser backs off as a duplicate', /earliest\.id !== claim\.id/.test(source)],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) { console.error(`FAIL ${name}`); failed++; } else { console.log(`ok  ${name}`); }
}

// The claim must be created BEFORE the donation is created (idempotency gate),
// so a duplicate/concurrent event is rejected before any ledger write.
const claimIdx = source.indexOf('WebhookEvent.create');
const donationIdx = source.indexOf('Donation.create');
if (claimIdx === -1 || donationIdx === -1 || claimIdx > donationIdx) {
  console.error('FAIL claim is not created before donation creation'); failed++;
} else { console.log('ok  claim is created before donation creation'); }

if (failed) { console.error(`\n${failed} stripe idempotency test(s) failed.`); process.exit(1); }
console.log('\nAll stripe idempotency tests passed.');