import fs from 'node:fs';

const source = fs.readFileSync('src/pages/Connections.jsx', 'utf8');
const required = [
  ['bounded load error', source.includes('SAFE_LOAD_ERROR')],
  ['bounded sync error', source.includes('SAFE_SYNC_ERROR')],
  ['malformed connection fail-closed', source.includes('SAFE_MALFORMED_CONNECTIONS')],
  ['malformed sync fail-closed', source.includes('SAFE_MALFORMED_SYNC')],
  ['no raw exception message access', !source.includes('e.message') && !source.includes('error.message')],
  ['sync single-flight guard', source.includes('syncInFlight.current')],
  ['sync finally reset', source.includes('finally {') && source.includes('syncInFlight.current = false')],
  ['load generation fencing', source.includes('requestGeneration') && source.includes('generation !== requestGeneration.current')],
  ['unmount fencing', source.includes('mountedRef.current = false')],
  ['array response validation', source.includes('Array.isArray(nextConnections)')],
  ['stable error rendering', source.includes('<PageError message={error}')],
];
const failed = required.filter(([, ok]) => !ok);
if (failed.length) {
  console.error(`Connections verifier failed: ${failed.map(([name]) => name).join(', ')}`);
  process.exit(1);
}
console.log(`Connections verifier passed (${required.length} checks).`);
