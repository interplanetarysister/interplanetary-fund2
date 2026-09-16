import fs from 'node:fs';

const source = fs.readFileSync('src/pages/OpsCenter.jsx', 'utf8');
const required = [
  ['stable Ops Center copy', source.includes('SAFE_OPS_ERROR')],
  ['stable sync copy', source.includes('SAFE_SYNC_ERROR')],
  ['no direct e.message UI propagation', !source.includes('e.message')],
  ['load finally reset', source.includes('setLoading(false);') && source.includes('} finally {')],
  ['sync finally reset', source.includes('setSyncing(false);') && source.includes('} finally {')],
  ['hostile property guard', source.includes('try {') && source.includes('typeof value.message')],
];
const failures = required.filter(([, ok]) => !ok).map(([name]) => name);
if (failures.length) {
  console.error(`OpsCenter safe-diagnostics verification failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('OpsCenter safe-diagnostics verification passed');
