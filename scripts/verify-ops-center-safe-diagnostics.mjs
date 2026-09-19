import fs from 'node:fs';

const source = fs.readFileSync('src/pages/OpsCenter.jsx', 'utf8');
const checks = [
  ['stable Ops Center copy', source.includes('SAFE_OPS_ERROR')],
  ['stable sync copy', source.includes('SAFE_SYNC_ERROR')],
  ['no direct e.message propagation', !source.includes('e.message')],
  ['load failure reset', source.includes('setLoading(false);')],
  ['sync failure reset', source.includes('setSyncing(false);')],
  ['guarded hostile message access', source.includes('typeof value.message === "string"') && source.includes('catch {')],
];
const failures = checks.filter(([, ok]) => !ok).map(([name]) => name);
if (failures.length) {
  console.error(`OpsCenter safe-diagnostics verification failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('OpsCenter safe-diagnostics verification passed');
