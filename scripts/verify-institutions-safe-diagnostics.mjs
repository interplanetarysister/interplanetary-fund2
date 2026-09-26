import fs from 'node:fs';

const source = fs.readFileSync('src/pages/Institutions.jsx', 'utf8');
const checks = [
  ['stable safe institutions error constant', source.includes('SAFE_INSTITUTIONS_ERROR')],
  ['raw exception message is not rendered', !source.includes('e.message')],
  ['catch discards thrown value', source.includes('.catch(() => setError(SAFE_INSTITUTIONS_ERROR))')],
  ['retry clears error state', source.includes('setError(null)')],
  ['retry clears stale institutions', source.includes('setInstitutions(null)')],
  ['PageError receives bounded message', source.includes('<PageError message={error} onRetry=')],
];
const failures = checks.filter(([, passed]) => !passed).map(([name]) => name);
if (failures.length) {
  console.error(`Institutions safe-diagnostics verifier failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log(`Institutions safe-diagnostics verifier passed (${checks.length} checks).`);
