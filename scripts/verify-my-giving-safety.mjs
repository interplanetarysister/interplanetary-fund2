import fs from 'node:fs';

const source = fs.readFileSync('src/pages/MyGiving.jsx', 'utf8');
const checks = [
  ['stable safe error constant', source.includes('SAFE_GIVING_ERROR')],
  ['no raw exception message access', !source.includes('e.message') && !source.includes('error.message')],
  ['fail-closed donation array validation', source.includes('Array.isArray(value)') && source.includes('normalizeDonations')],
  ['donation identity validation', source.includes('typeof donation.id === "string"')],
  ['finite non-negative amount validation', source.includes('Number.isFinite(donation.amount)')],
  ['mounted fencing', source.includes('mountedRef') && source.includes('requestIdRef')],
  ['safe PageError rendering', source.includes('message={SAFE_GIVING_ERROR}')],
];
const failures = checks.filter(([, ok]) => !ok);
if (failures.length) {
  console.error('MyGiving safety verifier failed:', failures.map(([name]) => name).join(', '));
  process.exit(1);
}
console.log(`MyGiving safety verifier passed (${checks.length} checks).`);
