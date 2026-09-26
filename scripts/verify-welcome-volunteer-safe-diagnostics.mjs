import fs from 'node:fs';

const source = fs.readFileSync('base44/functions/welcomeVolunteer/entry.ts', 'utf8');
const required = [
  ['no direct exception message access', !source.includes('e.message') && !source.includes('error.message')],
  ['bounded classifier', source.includes('classifyThrownValue')],
  ['safe log helper', source.includes('logSafeFailure')],
  ['fixed outer response', source.includes("Unable to send the welcome. Please try again.")],
  ['email failure remains non-fatal', source.includes('welcome email') && source.includes('Notification.create')],
];
const failed = required.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) {
  console.error(`welcomeVolunteer safe-diagnostics verifier failed: ${failed.join(', ')}`);
  process.exit(1);
}
console.log('welcomeVolunteer safe-diagnostics verifier passed');
