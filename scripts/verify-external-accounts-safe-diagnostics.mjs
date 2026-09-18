import fs from 'node:fs';

const source = fs.readFileSync('src/pages/ExternalAccounts.jsx', 'utf8');
const checks = [
  ['stable safe error', source.includes('SAFE_EXTERNAL_ACCOUNTS_ERROR')],
  ['no raw thrown message access', !source.includes('e.message') && !source.includes('errorValue.message')],
  ['no raw thrown interpolation', !source.includes('${errorValue}')],
  ['connections response validation', source.includes('readConnections')],
  ['entity array validation', source.includes('readArray(psResponse') && source.includes('readArray(agsResponse') && source.includes('readArray(campsResponse')],
  ['mounted fencing', source.includes('mountedRef') && source.includes('mountedRef.current')],
  ['generation fencing', source.includes('generationRef') && source.includes('generation !== generationRef.current')],
  ['retry preserves admin flow', source.includes('setRefreshKey((k) => k + 1)')],
];
const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error(`ExternalAccounts verifier failed: ${failed.map(([name]) => name).join(', ')}`);
  process.exit(1);
}
console.log(`ExternalAccounts verifier passed (${checks.length} checks).`);
