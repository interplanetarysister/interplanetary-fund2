import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const create = read('base44/functions/createPayPalOrder/entry.ts');
const capture = read('base44/functions/capturePayPalOrder/entry.ts');
const paypal = read('base44/shared/paypal.ts');
const donation = read('base44/entities/Donation.jsonc');

const required = [
  [create, 'Number.isFinite(value)', 'PayPal order amount must be finite'],
  [create, "return Response.json({ error: 'Unable to start the PayPal donation. Please try again.' }, { status: 500 });", 'PayPal order creation must use a safe client error'],
  [capture, 'paypal_order_id: order_id', 'PayPal donation must persist the provider order identity'],
  [capture, 'getOrder(order_id)', 'Capture must verify the authoritative PayPal order'],
  [capture, "payment.currency !== 'USD'", 'Capture must verify currency'],
  [capture, "return Response.json({ error: 'Unable to complete the PayPal donation. Please try again.' }, { status: 500 });", 'PayPal capture must use a safe client error'],
  [paypal, 'sender_batch_id: itemId', 'PayPal payout idempotency identity must come from the withdrawal transaction'],
  [paypal, 'export async function getOrder(orderId)', 'PayPal order lookup helper must exist'],
  [paypal, '"PayPal-Request-Id": `capture-${orderId}`', 'PayPal capture retries must use a stable provider idempotency key'],
  [donation, '"paypal_order_id"', 'Donation schema must retain the PayPal provider identity'],
];

for (const [source, needle, message] of required) {
  if (!source.includes(needle)) throw new Error(message);
}

for (const [source, label] of [[create, 'createPayPalOrder'], [capture, 'capturePayPalOrder']]) {
  if (/return Response\.json\(\{\s*error:\s*error\.message/.test(source)) {
    throw new Error(`${label} exposes raw error.message to clients`);
  }
}

if (capture.includes('stripe_session_id: order_id')) {
  throw new Error('PayPal capture must not store a PayPal order ID in stripe_session_id');
}

console.log('PayPal donation integrity guard passed.');
