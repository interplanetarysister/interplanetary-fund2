import fs from 'node:fs';

const source = fs.readFileSync('src/pages/Connections.jsx', 'utf8');
const checks = [
  ['safe load copy', source.includes('SAFE_LOAD_ERROR')],
  ['safe sync copy', source.includes('SAFE_SYNC_ERROR')],
  ['malformed response copy', source.includes('SAFE_MALFORMED_CONNECTIONS') && source.includes('SAFE_MALFORMED_SYNC')],
  ['no raw message access', !source.includes('e.message') && !source.includes('error.message')],
  ['sync single flight', source.includes('syncInFlight.current')],
  ['finally reset', source.includes('syncInFlight.current = false')],
  ['generation fence', source.includes('generation !== requestGeneration.current')],
  ['unmount fence', source.includes('mountedRef.current = false')],
  ['array guard', source.includes('Array.isArray(nextConnections)')],
  ['bounded PageError', source.includes('<PageError message={error}')],
];
const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error(`Connections verifier failed: ${failed.map(([name]) => name).join(', ')}`);
  process.exit(1);
}
console.log(`Connections verifier passed (${checks.length} checks).`);
