import { readFile } from 'node:fs/promises';

const path = 'base44/functions/updateRecurringDonation/entry.ts';
const source = await readFile(path, 'utf8');

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

console.log('Recurring donation error contract verified.');
