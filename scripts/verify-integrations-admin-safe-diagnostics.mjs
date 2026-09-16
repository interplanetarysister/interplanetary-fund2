import fs from 'node:fs';

const source = fs.readFileSync('src/pages/IntegrationsAdmin.jsx', 'utf8');
const required = [
  ['stable registry error', source.includes('SAFE_REGISTRY_ERROR')],
  ['stable health error', source.includes('SAFE_HEALTH_ERROR')],
  ['no raw catch message access', !/catch\s*\([^)]*\)\s*\{[^}]*\.message/.test(source)],
  ['array response guard', source.includes('Array.isArray(list)')],
  ['unmount fencing', source.includes('let active = true') && source.includes('active = false')],
  ['health single flight', source.includes('if (checking) return')],
  ['health finally reset', source.includes('finally {\n      setChecking(false);')],
];

const failures = required.filter(([, ok]) => !ok).map(([name]) => name);
if (failures.length) {
  console.error(`IntegrationsAdmin safe-diagnostics verifier failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('IntegrationsAdmin safe-diagnostics verifier passed');
