import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../base44/functions/recordDonation/entry.ts', import.meta.url), 'utf8');

assert.match(source, /const SAFE_ERROR = ['"]Unable to record the donation\./);
assert.match(source, /return Response\.json\(\{ error: SAFE_ERROR \}, \{ status: 500 \}\)/);
assert.match(source, /Number\.isFinite\(value\)/);
assert.match(source, /MAX_DONATION_AMOUNT/);
assert.match(source, /ALLOWED_PAYMENT_METHODS/);
assert.match(source, /normalizedPaymentMethod/);
assert.match(source, /payment_method:\s*normalizedPaymentMethod/);
assert.match(source, /is_recurring === true/);
assert.match(source, /Recurring donations must use the recurring donation workflow/);
assert.match(source, /is_recurring:\s*false/);
assert.doesNotMatch(source, /recurring_status:\s*['"]active['"]/);
assert.doesNotMatch(source, /return Response\.json\(\{ error: error\.message \}/);
assert.doesNotMatch(source, /return Response\.json\(\{ error: error\?\.message/);

console.log('recordDonation safe-error and recurring-boundary contract passed');
