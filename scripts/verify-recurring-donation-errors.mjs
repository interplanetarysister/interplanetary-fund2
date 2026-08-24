import { readFile } from 'node:fs/promises';

const path = 'base44/functions/updateRecurringDonation/entry.ts';
const schemaPath = 'base44/entities/Donation.jsonc';
const source = await readFile(path, 'utf8');
const schema = await readFile(schemaPath, 'utf8');

const required = [
  "return 'Unable to update recurring donation. Please try again.';",
  "console.error('updateRecurringDonation error:', error);",
];

for (const token of required) {
  if (!source.includes(token)) {
    throw new Error(`Missing safe recurring-donation error contract: ${token}`);
  }
}

const unsafePatterns = [
  /error\.message\s*\}/,
  /slice\(0,\s*180\)/,
  /return\s+Response\.json\(\{\s*error:\s*message/,
];

for (const pattern of unsafePatterns) {
  if (pattern.test(source)) {
    throw new Error(`Unsafe client error pattern remains: ${pattern}`);
  }
}

// Financial-integrity changes must preserve the pre-existing Donation schema.
// This guard prevents a security sprint from accidentally collapsing unrelated
// payment/institutional fields while adding the recurring Stripe identifier.
const requiredDonationFields = [
  'campaign_id',
  'campaign_title',
  'amount',
  'donor_name',
  'message',
  'is_recurring',
  'recurring_status',
  'donor_user_id',
  'stripe_session_id',
  'stripe_subscription_id',
  'payment_method',
  'is_institutional',
  'cleared',
  'withdrawal_id',
];

for (const field of requiredDonationFields) {
  const fieldPattern = new RegExp(`\\"${field}\\"\\s*:`);
  if (!fieldPattern.test(schema)) {
    throw new Error(`Donation schema field was removed or renamed: ${field}`);
  }
}

if (!schema.includes('"create": false') || !schema.includes('"update": false') || !schema.includes('"delete": false')) {
  throw new Error('Donation financial records must remain service-controlled for create/update/delete.');
}

console.log('Recurring donation error and Donation schema contracts verified.');
