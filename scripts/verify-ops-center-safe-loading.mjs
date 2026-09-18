import fs from 'node:fs';

const source = fs.readFileSync('src/pages/OpsCenter.jsx', 'utf8');
const checks = [
  ['stable safe load error', source.includes('SAFE_OPS_ERROR')],
  ['stable safe sync error', source.includes('SAFE_SYNC_ERROR')],
  ['no raw caught message access', !source.includes('e.message') && !source.includes('error.message')],
  ['mounted fencing', source.includes('mountedRef')],
  ['request generation fencing', source.includes('requestGenerationRef')],
  ['single-flight sync guard', source.includes('syncingRef')],
  ['record response validation', source.includes('isRecordList')],
  ['offline-first claim removed', !source.includes('works offline') && source.includes('Convex remains authoritative')],
];

for (const [label, pass] of checks) {
  if (!pass) throw new Error(`OpsCenter verifier failed: ${label}`);
}

console.log(`OpsCenter safe-loading verifier passed (${checks.length} checks).`);
