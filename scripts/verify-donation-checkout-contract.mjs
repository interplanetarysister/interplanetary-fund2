import { readFileSync } from 'node:fs';

const checkout = readFileSync('base44/functions/createDonationCheckout/entry.ts', 'utf8');

const requiredFragments = [
  "const MIN_DONATION_USD = 0.5;",
  "const MAX_DONATION_USD = 1000000;",
  'if (!/^\\d+(?:\\.\\d{1,2})?$/.test(text)) return null;',
  'Number.isSafeInteger(cents)',
  'unit_amount: parsedAmount.cents',
  "campaign.status !== 'active'",
  'Campaign.end_date is a date-only field',
  'T23:59:59.999Z',
  'const recurring = is_recurring === true;',
  "mode: recurring ? 'subscription' : 'payment'",
  "is_recurring !== undefined && typeof is_recurring !== 'boolean'",
  "return Response.json({ error: 'Unable to create donation checkout.' }, { status: 500 });",
];

for (const fragment of requiredFragments) {
  if (!checkout.includes(fragment)) {
    throw new Error(`Missing donation checkout security contract: ${fragment}`);
  }
}

if (/Number\.EPSILON/.test(checkout)) {
  throw new Error('Donation checkout must not rely on floating-point EPSILON validation for exact cents');
}
if (!/new Date\(`\$\{campaign\.end_date\}T23:59:59\.999Z`\)/.test(checkout)) {
  throw new Error('Campaign end-date validation must use the documented UTC end-of-day boundary');
}

console.log('Donation checkout contract verification passed.');