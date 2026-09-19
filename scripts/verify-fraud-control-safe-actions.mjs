import fs from 'node:fs';

const source = fs.readFileSync('src/components/platform/FraudControlPanel.jsx', 'utf8');
const checks = [
  ['stable safe error', source.includes('SAFE_FRAUD_ERROR')],
  ['no raw caught-message access', !source.includes('e.message') && !source.includes('error.message')],
  ['array response guards', source.includes('Array.isArray(w)') && source.includes('Array.isArray(c)')],
  ['single-flight action guard', source.includes('actionBusyRef') && source.includes('actionBusyRef.current.has(key)')],
  ['busy state cleanup', source.includes('actionBusyRef.current.delete(key)')],
  ['failure finally cleanup', source.includes('finally {\n      actionBusyRef.current.delete(key);')],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error(`FraudControlPanel verifier failed: ${failed.map(([name]) => name).join(', ')}`);
  process.exit(1);
}

console.log(`FraudControlPanel verifier passed (${checks.length} checks).`);
