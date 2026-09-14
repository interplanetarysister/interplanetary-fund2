import fs from 'node:fs';

const source = fs.readFileSync('src/components/platform/ServiceHealthPanel.jsx', 'utf8');
const required = [
  ['safe service error constant', source.includes('SAFE_SERVICE_ERROR')],
  ['raw exception not rendered', !source.includes('error: e.message')],
  ['bounded failure classifier', source.includes('function classifyServiceFailure(value)')],
  ['fixed failure vocabulary', source.includes('const FAILURE_TYPES = new Set([') && source.includes('return FAILURE_TYPES.has(type) ? type : "object"')],
  ['classifier avoids raw value serialization', !source.includes('JSON.stringify(e)')],
  ['sanitized service name helper', source.includes('function sanitizeServiceName(name)')],
  ['safe service-name validation', source.includes('/^[A-Za-z0-9 &-]{1,64}$/')],
  ['single bounded diagnostic argument', source.includes('console.error(`Service health check failed for ${sanitizeServiceName(s.name)} (${failureType}).`)')],
  ['safe error rendered', source.includes('error: SAFE_SERVICE_ERROR')],
];

const failures = required.filter(([, ok]) => !ok).map(([name]) => name);
if (failures.length) {
  console.error(`Service-health safe-error verification failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('Service-health safe-error verification passed.');
