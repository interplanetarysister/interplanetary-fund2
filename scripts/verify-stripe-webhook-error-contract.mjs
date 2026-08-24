import fs from 'node:fs';

const source = fs.readFileSync('base44/functions/stripeWebhook/entry.ts', 'utf8');

const checks = [
  ['stable safe webhook error contract exists', source.includes("function safeWebhookError()") && source.includes("return 'Unable to process Stripe webhook.'")],
  ['outer webhook failure does not expose raw exception text', source.includes('return Response.json({ error: safeWebhookError() }, { status: 500 })')],
  ['signature verification uses Stripe webhook construction', source.includes('stripe.webhooks.constructEventAsync(')],
  ['missing signature/configuration does not fall back to unsigned JSON', !source.includes('JSON.parse(rawBody)') && !source.includes('JSON.parse(body)')],
  ['unknown subscription prices fail closed', source.includes("return Response.json({ error: 'Unrecognized subscription price' }, { status: 500 })")],
  ['unknown subscription update prices fail closed', source.includes("return Response.json({ error: 'Unrecognized subscription price; retry required' }, { status: 500 })")],
  ['donation financial claim uses conditional event identity', source.includes("'history.event_id': { $ne: event.id }") && source.includes('Campaign.updateMany(')],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [label, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);

if (failed.length) {
  console.error(`Stripe webhook error/security verification failed: ${failed.length} check(s).`);
  process.exit(1);
}

console.log(`Stripe webhook error/security verification passed: ${checks.length} checks.`);
