import fs from 'node:fs';

const source = fs.readFileSync('src/pages/IntegrationsAdmin.jsx', 'utf8');
const required = [
  ['stable auth error', source.includes('SAFE_AUTH_ERROR')],
  ['stable registry error', source.includes('SAFE_REGISTRY_ERROR')],
  ['explicit unavailable state', source.includes('SAFE_REGISTRY_UNAVAILABLE')],
  ['stable health error', source.includes('SAFE_HEALTH_ERROR')],
  ['no raw catch message access', !/catch\s*(?:\([^)]*\))?\s*\{[^}]*\.message/.test(source)],
  ['malformed registry fails closed', source.includes('if (!Array.isArray(list))') && source.includes('setError(SAFE_REGISTRY_UNAVAILABLE)')],
  ['request generation fencing', source.includes('requestIdRef') && source.includes('requestId !== requestIdRef.current')],
  ['unmount fencing', source.includes('let active = true') && source.includes('active = false')],
  ['health single flight ref', source.includes('healthFlightRef') && source.includes('if (healthFlightRef.current) return')],
  ['health finally reset', source.includes('finally {\n        healthFlightRef.current = null;\n        setChecking(false);')],
];

const failures = required.filter(([, ok]) => !ok).map(([name]) => name);
if (failures.length) {
  console.error(`IntegrationsAdmin safe-diagnostics verifier failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('IntegrationsAdmin safe-diagnostics verifier passed');
