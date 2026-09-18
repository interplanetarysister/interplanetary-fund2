import fs from 'node:fs';

const source = fs.readFileSync('base44/functions/deleteAccount/entry.ts', 'utf8');
const checks = [
  ['safe classifier exists', source.includes('function classifyDeleteFailure')],
  ['no raw step message access', !source.includes('stepErr.message')],
  ['no raw request message access', !source.includes('error.message')],
  ['no String(stepErr) interpolation', !source.includes('String(stepErr)')],
  ['bounded step allowlist exists', source.includes('SAFE_DELETE_STEPS')],
  ['safe step name used', source.includes('safeStepName(name)')],
  ['safe audit detail used', source.includes('safeDeleteDetail(safeName, stepErr)')],
  ['safe delete failure detail used', source.includes("safeDeleteDetail('user_delete', delErr)")],
  ['safe request detail used', source.includes("safeDeleteDetail('request', error)")],
  ['stable client error preserved', source.includes('Unable to delete your account. Please try again or contact support.')],
  ['deletion flow preserved', source.includes('account_deletion_cleanup_done') && source.includes('User.delete(user.id)')],
];
const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) {
  console.error(`deleteAccount verifier failed: ${failed.join(', ')}`);
  process.exit(1);
}
console.log(`deleteAccount verifier passed ${checks.length} checks.`);
